-- Den ugentlige "kom tilbage"-paamindelse har koert hver dag kl. 07 i maanedsvis
-- og naaet NUL mennesker. To uafhaengige grunde:
--
-- 1. Den kraevede en push-abonnering. 32 brugere opfyldte alt andet. Ingen af
--    dem havde push. Push kraever, at appen er installeret som PWA - det har
--    2 ud af 98 gjort. Kravet er byttet ud med "kan overhovedet naas":
--    push ELLER mail slaaet til. Det aabner for 31.
--
-- 2. Den taeller kun AABNE KAMPE, og der er ingen. Ikke nul denne uge - nul
--    fremadrettet overhovedet. Imens soeger 17 spillere en makker. Paamindelsen
--    taeller nu begge dele, saa den har noget at sige.
--
-- Returtypen faar to nye kolonner (seeking_count, has_push), saa edge-
-- funktionen kan skrive den rigtige tekst og vaelge kanal. Derfor DROP foerst -
-- CREATE OR REPLACE kan ikke aendre en returtype.
--
-- Uaendret: kun brugere med 0 spillede kampe, mindst 2 ting at fortaelle om,
-- 60 km, og hoejst én paamindelse per uge (reactivation_log + week_start).

DROP FUNCTION IF EXISTS public.get_due_reactivation_nudges();

CREATE FUNCTION public.get_due_reactivation_nudges()
RETURNS TABLE(
  user_id uuid,
  city_label text,
  open_count integer,
  seeking_count integer,
  has_push boolean,
  week_start date
)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  with week_bounds as (
    select
      (date_trunc('week', timezone('Europe/Copenhagen', now())))::date as week_start,
      ((date_trunc('week', timezone('Europe/Copenhagen', now())))::date + interval '7 days')::date as week_end,
      (timezone('Europe/Copenhagen', now()))::date as today_cph
  ),
  open_matches as (
    select
      m.id,
      m.creator_id,
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
      and (
        case
          when m.time ~ '^\d{1,2}:\d{2}' then
            (
              case
                when m.time_end ~ '^\d{1,2}:\d{2}'
                  then ((m.date::text || ' ' || m.time_end)::timestamp at time zone 'Europe/Copenhagen')
                else ((m.date::text || ' ' || m.time)::timestamp at time zone 'Europe/Copenhagen') + interval '90 minutes'
              end
            ) >= now()
          else m.date::date >= wb.today_cph
        end
      )
  ),
  -- Nyt: spillere der soeger makker lige nu. Markeringen udloeber ikke, saa
  -- den er gyldig, til de selv slaar den fra.
  seekers as (
    select sp.id, sp.latitude as seeker_lat, sp.longitude as seeker_lon, sp.area as seeker_area
    from public.profiles sp
    where coalesce(sp.is_banned, false) = false
      and public.makker_feed_is_active(sp.makker_search_prefs, sp.seeking_match_at)
  ),
  candidates as (
    select
      p.id as user_id,
      nullif(trim(coalesce(p.city, '')), '') as city_label,
      p.latitude as user_lat,
      p.longitude as user_lon,
      p.area as user_area,
      exists (select 1 from public.push_subscriptions ps where ps.user_id = p.id) as has_push,
      case
        when coalesce(nullif(trim(p.notification_prefs->>'reactivationOpenMatches'), ''), 'weekly')
          in ('off', 'weekly', 'daily')
          then coalesce(nullif(trim(p.notification_prefs->>'reactivationOpenMatches'), ''), 'weekly')
        else 'weekly'
      end as nudge_freq
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
      -- Kan personen overhovedet naas? Push ELLER mail. Foer stod her et rent
      -- push-krav, og det tomte listen fuldstaendigt.
      and (
        exists (select 1 from public.push_subscriptions ps where ps.user_id = p.id)
        or coalesce((p.notification_prefs->'email'->>'opdagelse')::boolean, false) = true
      )
      and coalesce(p.notification_prefs->>'pushLevel', 'all') <> 'off'
      and coalesce(nullif(trim(p.notification_prefs->>'reactivationOpenMatches'), ''), 'weekly') <> 'off'
  ),
  counted as (
    select
      c.user_id,
      c.city_label,
      c.nudge_freq,
      c.has_push,
      (
        select count(distinct om.id)::integer
        from open_matches om
        where om.creator_id <> c.user_id
          and (
            (om.creator_lat is not null and om.creator_lon is not null
             and public.haversine_km(c.user_lat, c.user_lon, om.creator_lat, om.creator_lon) <= 60)
            or ((om.creator_lat is null or om.creator_lon is null)
             and lower(trim(coalesce(om.creator_area, ''))) = lower(trim(coalesce(c.user_area, ''))))
          )
      ) as open_count,
      (
        select count(distinct s.id)::integer
        from seekers s
        where s.id <> c.user_id
          and (
            (s.seeker_lat is not null and s.seeker_lon is not null
             and public.haversine_km(c.user_lat, c.user_lon, s.seeker_lat, s.seeker_lon) <= 60)
            or ((s.seeker_lat is null or s.seeker_lon is null)
             and lower(trim(coalesce(s.seeker_area, ''))) = lower(trim(coalesce(c.user_area, ''))))
          )
      ) as seeking_count
    from candidates c
  )
  select t.user_id, t.city_label, t.open_count, t.seeking_count, t.has_push, wb.week_start
  from counted t
  cross join week_bounds wb
  -- Mindst to ting at fortaelle om, uanset hvilken slags. Én enkelt er ikke
  -- nok til at vaere en mail vaerd.
  where (t.open_count + t.seeking_count) >= 2
    and not exists (
      select 1
      from public.reactivation_log rl
      where rl.user_id = t.user_id
        and rl.kind = 'open_matches_weekly'
        and (
          (t.nudge_freq = 'weekly' and rl.week_start = wb.week_start)
          or (t.nudge_freq = 'daily' and rl.sent_at >= wb.today_cph)
        )
    );
$function$;

REVOKE ALL ON FUNCTION public.get_due_reactivation_nudges() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_due_reactivation_nudges() FROM anon;
REVOKE ALL ON FUNCTION public.get_due_reactivation_nudges() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.get_due_reactivation_nudges() TO service_role;
