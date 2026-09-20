-- Scheduled reminders (Phase 2 #1): 24h + 1h match/tournament reminders + result nudge.
-- Idempotent. The matching Edge Function `send-reminders` is deployed separately
-- (supabase/functions/send-reminders); the cron below invokes it every 15 min and
-- authenticates via the shared secret stored in public.app_config (never committed).

create extension if not exists pg_net;

-- Dedup log: one row per (entity, kind, user) once a reminder has been sent.
create table if not exists public.reminder_log (
  entity_type text not null,
  entity_id   uuid not null,
  kind        text not null,
  user_id     uuid not null,
  sent_at     timestamptz not null default now(),
  primary key (entity_type, entity_id, kind, user_id)
);
alter table public.reminder_log enable row level security;  -- service-role only

-- Locked-down config table for server-side shared secrets.
create table if not exists public.app_config (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);
alter table public.app_config enable row level security;    -- service-role only

-- Random cron secret, generated server-side (no secret literal committed).
insert into public.app_config (key, value)
values ('reminder_cron_secret', gen_random_uuid()::text || gen_random_uuid()::text)
on conflict (key) do nothing;

-- Returns the reminders that are currently due (timezone-correct, Europe/Copenhagen),
-- excluding any already recorded in reminder_log.
create or replace function public.get_due_reminders()
returns table (
  kind text, entity_type text, entity_id uuid, user_id uuid,
  match_id uuid, label text, fmt text, start_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  with m as (
    select mt.id, mt.court_name, mt.creator_id,
      ((mt.date::text || ' ' || coalesce(nullif(mt.time,''),'00:00'))::timestamp
        at time zone 'Europe/Copenhagen') as start_at,
      case when mt.time_end ~ '^\d{1,2}:\d{2}'
        then ((mt.date::text || ' ' || mt.time_end)::timestamp at time zone 'Europe/Copenhagen')
        else ((mt.date::text || ' ' || coalesce(nullif(mt.time,''),'00:00'))::timestamp
              at time zone 'Europe/Copenhagen') + interval '90 minutes'
      end as end_at
    from matches mt
    where mt.status in ('open','full','in_progress') and mt.time ~ '^\d{1,2}:\d{2}'
  ),
  match_reminders as (
    select k.kind, 'match'::text as entity_type, m.id as entity_id, mp.user_id,
           m.id as match_id, m.court_name as label, null::text as fmt, m.start_at
    from m
    join match_players mp on mp.match_id = m.id
    cross join lateral (values
      ('reminder_24h', m.start_at between now()+interval '23 hours 45 minutes' and now()+interval '24 hours 15 minutes'),
      ('reminder_1h',  m.start_at between now()+interval '45 minutes' and now()+interval '75 minutes')
    ) as k(kind, due)
    where k.due
  ),
  result_nudges as (
    select 'result_nudge'::text as kind, 'match'::text as entity_type, m.id as entity_id,
           m.creator_id as user_id, m.id as match_id, m.court_name as label, null::text as fmt, m.start_at
    from m
    where m.creator_id is not null
      and m.end_at between now()-interval '2 hours 30 minutes' and now()-interval '1 hour 30 minutes'
      and not exists (select 1 from match_results r where r.match_id = m.id)
  ),
  am as (
    select t.id, t.name, t.format,
      ((t.tournament_date::text || ' ' || substring(t.time_slot from '^\d{1,2}:\d{2}'))::timestamp
        at time zone 'Europe/Copenhagen') as start_at
    from americano_tournaments t
    where t.status not in ('completed','cancelled') and t.time_slot ~ '^\d{1,2}:\d{2}'
  ),
  am_reminders as (
    select k.kind, 'americano'::text as entity_type, am.id as entity_id, ap.user_id,
           null::uuid as match_id, am.name as label, am.format as fmt, am.start_at
    from am
    join americano_participants ap on ap.tournament_id = am.id
    cross join lateral (values
      ('reminder_24h', am.start_at between now()+interval '23 hours 45 minutes' and now()+interval '24 hours 15 minutes'),
      ('reminder_1h',  am.start_at between now()+interval '45 minutes' and now()+interval '75 minutes')
    ) as k(kind, due)
    where k.due
  ),
  all_due as (
    select * from match_reminders
    union all select * from result_nudges
    union all select * from am_reminders
  )
  select d.kind, d.entity_type, d.entity_id, d.user_id, d.match_id, d.label, d.fmt, d.start_at
  from all_due d
  where d.user_id is not null
    and not exists (
      select 1 from reminder_log rl
      where rl.entity_type = d.entity_type and rl.entity_id = d.entity_id
        and rl.kind = d.kind and rl.user_id = d.user_id
    );
$$;

revoke all on function public.get_due_reminders() from public, anon, authenticated;

-- Schedule: invoke send-reminders every 15 minutes.
-- The Authorization header carries the PUBLISHABLE anon key (safe to commit; it is
-- shipped in the web client) so Supabase's API gateway accepts the request; the real
-- auth is the x-cron-secret read from app_config at call time.
do $$
begin
  if exists (select 1 from cron.job where jobname = 'send-reminders') then
    perform cron.unschedule('send-reminders');
  end if;
  perform cron.schedule('send-reminders', '*/15 * * * *', $cmd$
    select net.http_post(
      url := 'https://hzmrsqrerkoftcppfklu.supabase.co/functions/v1/send-reminders',
      headers := jsonb_build_object(
        'Content-Type','application/json',
        'Authorization','Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6bXJzcXJlcmtvZnRjcHBma2x1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUxNzEwNTIsImV4cCI6MjA5MDc0NzA1Mn0.ApMY3hPJ5SdlXWgUeZ5odDWt5Z0PYnQqihSJbQ6gqgM',
        'x-cron-secret', (select value from public.app_config where key='reminder_cron_secret')
      ),
      body := '{}'::jsonb
    );
  $cmd$);
end$$;
