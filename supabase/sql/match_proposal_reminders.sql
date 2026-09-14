-- Påmindelse når et kampforslag nærmer sig svarfristen.
--
-- Et forslag dør, hvis bare én af de fire aldrig svarer. Den oprindelige besked
-- kan let drukne i en travl dag, så her gives der ét skub, mens der stadig er
-- tid til at nå det.
--
-- Påmindelsen hægtes på den eksisterende reminder-pipeline frem for en ny cron:
-- get_due_reminders() leverer rækkerne, send-reminders sender dem, og
-- reminder_log sikrer at hver spiller kun skubbes én gang pr. forslag.

CREATE OR REPLACE FUNCTION public.get_due_reminders()
RETURNS TABLE (
  kind text, entity_type text, entity_id uuid, user_id uuid,
  match_id uuid, label text, fmt text, start_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  with m as (
    select mt.id, mt.court_name, mt.creator_id, mt.started_at,
      ((mt.date::text || ' ' || coalesce(nullif(mt.time,''),'00:00'))::timestamp
        at time zone 'Europe/Copenhagen') as start_at,
      case when mt.time_end ~ '^\d{1,2}:\d{2}'
        then ((mt.date::text || ' ' || mt.time_end)::timestamp at time zone 'Europe/Copenhagen')
        else ((mt.date::text || ' ' || coalesce(nullif(mt.time,''),'00:00'))::timestamp
              at time zone 'Europe/Copenhagen') + interval '90 minutes'
      end as end_at,
      (select count(*) from match_players mp where mp.match_id = mt.id) as player_count
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
      -- Åbne kampe uden fire spillere er ikke en kamp endnu.
      and m.player_count >= 4
  ),
  result_nudges as (
    select 'result_nudge'::text as kind, 'match'::text as entity_type, m.id as entity_id,
           m.creator_id as user_id, m.id as match_id, m.court_name as label, null::text as fmt, m.start_at
    from m
    where m.creator_id is not null
      and m.end_at between now()-interval '2 hours 30 minutes' and now()-interval '1 hour 30 minutes'
      and not exists (select 1 from match_results r where r.match_id = m.id)
      -- Kun kampe der faktisk blev startet med et fuldt hold.
      and m.player_count >= 4
      and m.started_at is not null
  ),
  am as (
    select t.id, t.name, t.format, t.player_slots,
      ((t.tournament_date::text || ' ' || substring(t.time_slot from '^\d{1,2}:\d{2}'))::timestamp
        at time zone 'Europe/Copenhagen') as start_at,
      (select count(*) from americano_participants ap where ap.tournament_id = t.id) as participant_count
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
      and am.participant_count >= coalesce(am.player_slots, 4)
  ),
  -- Kun dem der endnu ikke har svaret. `start_at` bærer her svarfristen, så
  -- send-reminders kan skrive klokkeslættet uden at kende til puljemodellen.
  proposal_deadlines as (
    select 'proposal_deadline'::text as kind,
           'match_proposal'::text as entity_type,
           pr.id as entity_id,
           mem.user_id,
           null::uuid as match_id,
           to_char(pr.play_date, 'DD/MM') || ' kl. ' || to_char(pr.start_time, 'HH24:MI') as label,
           null::text as fmt,
           pr.expires_at as start_at
    from match_proposals pr
    join match_proposal_members mem on mem.proposal_id = pr.id
    where pr.status = 'pending'
      and mem.response = 'pending'
      -- Under 20 minutter når skubbet ikke frem i tide; cron kører hvert kvarter.
      and pr.expires_at between now() + interval '20 minutes' and now() + interval '3 hours'
      -- Forslag med kort lunte er lige blevet varslet — undgå dobbeltbesked.
      and pr.created_at <= now() - interval '45 minutes'
      -- Et rigtigt puljeforslag har fire spillere. Enkeltmands-rækker er støj.
      and (select count(*) from match_proposal_members mem_all where mem_all.proposal_id = pr.id) >= 4
  ),
  all_due as (
    select * from match_reminders
    union all select * from result_nudges
    union all select * from am_reminders
    union all select * from proposal_deadlines
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

REVOKE ALL ON FUNCTION public.get_due_reminders() FROM public, anon, authenticated;

-- Åbne/fulde kampe der aldrig blev startet, skal ikke ligge i Kampe efter sluttid.
CREATE OR REPLACE FUNCTION public.expire_unstarted_matches()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_count integer := 0;
BEGIN
  UPDATE public.matches mt
  SET status = 'cancelled',
      seeking_player = false,
      current_players = 0
  WHERE mt.status IN ('open', 'full')
    AND mt.started_at IS NULL
    AND mt.time ~ '^\d{1,2}:\d{2}'
    AND (
      CASE
        WHEN mt.time_end ~ '^\d{1,2}:\d{2}'
          THEN ((mt.date::text || ' ' || mt.time_end)::timestamp AT TIME ZONE 'Europe/Copenhagen')
        ELSE ((mt.date::text || ' ' || coalesce(nullif(mt.time, ''), '00:00'))::timestamp
              AT TIME ZONE 'Europe/Copenhagen') + interval '90 minutes'
      END
    ) < now();

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.expire_unstarted_matches() FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.expire_unstarted_matches() TO service_role;

-- Kampe der blev startet, men aldrig fik resultat, skal ikke ligge som "I gang" evigt.
CREATE OR REPLACE FUNCTION public.expire_abandoned_in_progress_matches()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_count integer := 0;
BEGIN
  UPDATE public.matches mt
  SET status = 'cancelled',
      seeking_player = false
  WHERE mt.status = 'in_progress'
    AND mt.time ~ '^\d{1,2}:\d{2}'
    AND NOT EXISTS (SELECT 1 FROM public.match_results r WHERE r.match_id = mt.id)
    AND (
      CASE
        WHEN mt.time_end ~ '^\d{1,2}:\d{2}'
          THEN ((mt.date::text || ' ' || mt.time_end)::timestamp AT TIME ZONE 'Europe/Copenhagen')
        ELSE ((mt.date::text || ' ' || coalesce(nullif(mt.time, ''), '00:00'))::timestamp
              AT TIME ZONE 'Europe/Copenhagen') + interval '90 minutes'
      END
    ) < now() - interval '48 hours';

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.expire_abandoned_in_progress_matches() FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.expire_abandoned_in_progress_matches() TO service_role;
