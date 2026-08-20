-- Sovende brugere (0 kampe): ugentlig push når der er åbne kampe nær byen.
-- Edge function: send-reactivation (cron ugentlig).

create extension if not exists pg_net;

-- Haversine-afstand (km) — genbruges til geo-match i nudges.
create or replace function public.haversine_km(
  lat1 double precision,
  lon1 double precision,
  lat2 double precision,
  lon2 double precision
)
returns double precision
language sql
immutable
parallel safe
as $$
  select case
    when lat1 is null or lon1 is null or lat2 is null or lon2 is null then null
    else 6371.0 * 2 * asin(sqrt(
      power(sin(radians(lat2 - lat1) / 2), 2) +
      cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lon2 - lon1) / 2), 2)
    ))
  end;
$$;

revoke all on function public.haversine_km(double precision, double precision, double precision, double precision)
  from public, anon, authenticated;

-- Dedup: max én reactivation-push pr. bruger pr. uge.
create table if not exists public.reactivation_log (
  user_id     uuid not null references public.profiles(id) on delete cascade,
  kind        text not null default 'open_matches_weekly',
  week_start  date not null,
  sent_at     timestamptz not null default now(),
  primary key (user_id, kind, week_start)
);

alter table public.reactivation_log enable row level security;

comment on table public.reactivation_log is
  'Dedup-log for ugentlige genaktiverings-push til sovende profiler (0 kampe).';

-- Returnerer brugere der skal have ugentlig "åbne kampe nær [by]"-nudge.
create or replace function public.get_due_reactivation_nudges()
returns table (
  user_id uuid,
  city_label text,
  open_count integer,
  week_start date
)
language sql
security definer
set search_path = public
as $$
  with week_bounds as (
    select
      (date_trunc('week', timezone('Europe/Copenhagen', now())))::date as week_start,
      ((date_trunc('week', timezone('Europe/Copenhagen', now())))::date + interval '7 days')::date as week_end
  ),
  open_matches as (
    select
      m.id,
      m.creator_id,
      m.date::date as match_date,
      cr.latitude as creator_lat,
      cr.longitude as creator_lon,
      cr.area as creator_area
    from public.matches m
    join public.profiles cr on cr.id = m.creator_id
    cross join week_bounds wb
    where coalesce(m.status, '') = 'open'
      and coalesce(m.match_type, 'open') <> 'closed'
      and coalesce(m.current_players, 0) < coalesce(m.max_players, 4)
      and m.date is not null
      and m.date::date >= wb.week_start
      and m.date::date < wb.week_end
  ),
  candidates as (
    select
      p.id as user_id,
      nullif(trim(coalesce(p.city, '')), '') as city_label,
      p.latitude as user_lat,
      p.longitude as user_lon,
      p.area as user_area
    from public.profiles p
    where coalesce(p.is_banned, false) = false
      and coalesce(p.games_played, 0) = 0
      and nullif(trim(coalesce(p.area, '')), '') is not null
      and nullif(trim(coalesce(p.city, '')), '') is not null
      and p.latitude is not null
      and p.longitude is not null
      and p.birth_year is not null
      and nullif(trim(coalesce(p.play_style, '')), '') is not null
      and trim(coalesce(p.play_style, '')) <> 'Ved ikke endnu'
      and cardinality(coalesce(p.availability, '{}'::text[])) > 0
      and exists (
        select 1 from public.push_subscriptions ps where ps.user_id = p.id
      )
      and coalesce(p.notification_prefs->>'pushLevel', 'all') <> 'off'
      and coalesce((p.notification_prefs->'push'->>'opdagelse')::boolean, true) = true
  ),
  scored as (
    select
      c.user_id,
      c.city_label,
      count(distinct om.id)::integer as open_count
    from candidates c
    cross join week_bounds wb
    join open_matches om on om.creator_id <> c.user_id
    where (
      (
        om.creator_lat is not null
        and om.creator_lon is not null
        and public.haversine_km(c.user_lat, c.user_lon, om.creator_lat, om.creator_lon) <= 60
      )
      or (
        (om.creator_lat is null or om.creator_lon is null)
        and lower(trim(coalesce(om.creator_area, ''))) = lower(trim(coalesce(c.user_area, '')))
      )
    )
    group by c.user_id, c.city_label
    having count(distinct om.id) >= 2
  )
  select s.user_id, s.city_label, s.open_count, wb.week_start
  from scored s
  cross join week_bounds wb
  where not exists (
    select 1
    from public.reactivation_log rl
    where rl.user_id = s.user_id
      and rl.kind = 'open_matches_weekly'
      and rl.week_start = wb.week_start
  );
$$;

revoke all on function public.get_due_reactivation_nudges() from public, anon, authenticated;

-- Ugentlig cron: mandag kl. 08:00 UTC (ca. 09/10 dansk tid).
do $$
begin
  if exists (select 1 from cron.job where jobname = 'send-reactivation-weekly') then
    perform cron.unschedule('send-reactivation-weekly');
  end if;
  perform cron.schedule(
    'send-reactivation-weekly',
    '0 8 * * 1',
    $cmd$
      select net.http_post(
        url := 'https://hzmrsqrerkoftcppfklu.supabase.co/functions/v1/send-reactivation',
        headers := jsonb_build_object(
          'Content-Type','application/json',
          'Authorization','Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6bXJzcXJlcmtvZnRjcHBma2x1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUxNzEwNTIsImV4cCI6MjA5MDc0NzA1Mn0.ApMY3hPJ5SdlXWgUeZ5odDWt5Z0PYnQqihSJbQ6gqgM',
          'x-cron-secret', (select value from public.app_config where key='reminder_cron_secret')
        ),
        body := '{}'::jsonb
      );
    $cmd$
  );
end$$;
