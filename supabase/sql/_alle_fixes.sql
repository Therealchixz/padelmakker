-- =============================================================================
-- ALLE FIXES — copy-paste hele denne fil i Supabase → SQL Editor → Run
-- Alle statements er idempotente (CREATE OR REPLACE, IF NOT EXISTS, osv.)
-- =============================================================================


-- ─────────────────────────────────────────────────────────────────────────────
-- 1) ELO-funktion: tilføj row_security = off (KRITISK)
--    Uden dette kørte beregningen under brugerens RLS og gav forkerte ratings.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.apply_elo_for_match(p_match_result_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $function$
DECLARE
  v_mr match_results%ROWTYPE;
  v_match matches%ROWTYPE;
  v_t1_avg REAL; v_t2_avg REAL; v_t1_won BOOLEAN;
  v_k1 INTEGER; v_k2 INTEGER; v_k_avg REAL;
  v_min_t1 INTEGER; v_min_t2 INTEGER;
  v_player RECORD;
  v_rp REAL; v_opp_avg REAL; v_e REAL; v_raw REAL;
  v_delta INTEGER; v_old_elo REAL; v_new_elo REAL; v_won BOOLEAN;
  v_updated_count INTEGER := 0;
  v_t1_games INTEGER; v_t2_games INTEGER; v_margin INTEGER; v_margin_mult REAL;
  v_t1_changes INTEGER[] := ARRAY[]::INTEGER[];
  v_t2_changes INTEGER[] := ARRAY[]::INTEGER[];
BEGIN
  SELECT * INTO v_mr FROM match_results WHERE id = p_match_result_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('error', 'Match result not found'); END IF;
  IF v_mr.confirmed IS NOT TRUE THEN RETURN jsonb_build_object('error', 'Match result not confirmed yet'); END IF;

  SELECT * INTO v_match FROM matches WHERE id = v_mr.match_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('error', 'Match not found'); END IF;
  IF v_match.status = 'completed' THEN RETURN jsonb_build_object('error', 'ELO already calculated for this match'); END IF;

  SELECT COALESCE(MIN(COALESCE(p.games_played, 0)), 0) INTO v_min_t1
  FROM match_players mp JOIN profiles p ON p.id = mp.user_id
  WHERE mp.match_id = v_mr.match_id AND mp.team = 1;

  SELECT COALESCE(MIN(COALESCE(p.games_played, 0)), 0) INTO v_min_t2
  FROM match_players mp JOIN profiles p ON p.id = mp.user_id
  WHERE mp.match_id = v_mr.match_id AND mp.team = 2;

  v_k1 := CASE WHEN v_min_t1 < 10 THEN 40 ELSE 24 END;
  v_k2 := CASE WHEN v_min_t2 < 10 THEN 40 ELSE 24 END;
  v_k_avg := (v_k1::REAL + v_k2::REAL) / 2.0;

  SELECT COALESCE(AVG(p.elo_rating), 1000) INTO v_t1_avg
  FROM match_players mp JOIN profiles p ON p.id = mp.user_id
  WHERE mp.match_id = v_mr.match_id AND mp.team = 1;

  SELECT COALESCE(AVG(p.elo_rating), 1000) INTO v_t2_avg
  FROM match_players mp JOIN profiles p ON p.id = mp.user_id
  WHERE mp.match_id = v_mr.match_id AND mp.team = 2;

  v_t1_won := (v_mr.match_winner = 'team1');
  v_t1_games := COALESCE(v_mr.set1_team1,0)+COALESCE(v_mr.set2_team1,0)+COALESCE(v_mr.set3_team1,0);
  v_t2_games := COALESCE(v_mr.set1_team2,0)+COALESCE(v_mr.set2_team2,0)+COALESCE(v_mr.set3_team2,0);
  v_margin := abs(v_t1_games - v_t2_games);
  v_margin_mult := CASE WHEN v_margin<=4 THEN 1.0 WHEN v_margin<=9 THEN 1.12 WHEN v_margin<=14 THEN 1.24 ELSE 1.35 END;

  FOR v_player IN
    SELECT mp.user_id, mp.team, p.elo_rating, p.games_played, p.games_won
    FROM match_players mp JOIN profiles p ON p.id = mp.user_id
    WHERE mp.match_id = v_mr.match_id ORDER BY mp.team, mp.user_id
  LOOP
    v_rp := COALESCE(v_player.elo_rating, 1000)::REAL;
    IF v_player.team = 1 THEN v_opp_avg := v_t2_avg; v_won := v_t1_won;
    ELSE v_opp_avg := v_t1_avg; v_won := NOT v_t1_won; END IF;
    v_e := 1.0 / (1.0 + power(10.0, (v_opp_avg - v_rp) / 400.0));
    IF v_won THEN v_raw := v_k_avg * (1.0 - v_e); ELSE v_raw := v_k_avg * (0.0 - v_e); END IF;
    v_delta := round(v_raw * v_margin_mult);
    IF v_delta = 0 AND v_raw <> 0.0 THEN v_delta := CASE WHEN v_raw > 0 THEN 1 ELSE -1 END; END IF;
    v_old_elo := v_rp;
    v_new_elo := GREATEST(100, v_old_elo + v_delta::REAL);
    UPDATE profiles SET elo_rating=v_new_elo, games_played=COALESCE(games_played,0)+1,
      games_won=COALESCE(games_won,0)+CASE WHEN v_won THEN 1 ELSE 0 END WHERE id=v_player.user_id;
    INSERT INTO elo_history (user_id,match_id,old_rating,new_rating,change,result)
    VALUES (v_player.user_id,v_mr.match_id,v_old_elo,v_new_elo,v_delta,CASE WHEN v_won THEN 'win' ELSE 'loss' END);
    v_updated_count := v_updated_count + 1;
    IF v_player.team = 1 THEN v_t1_changes := array_append(v_t1_changes, v_delta);
    ELSE v_t2_changes := array_append(v_t2_changes, v_delta); END IF;
  END LOOP;

  UPDATE matches SET status = 'completed' WHERE id = v_mr.match_id;
  RETURN jsonb_build_object('success',true,'model','individual_vs_opp_team_avg',
    'players_updated',v_updated_count,'k_team1',v_k1,'k_team2',v_k2,'k_avg',v_k_avg,
    'team1_player_changes',to_jsonb(v_t1_changes),'team2_player_changes',to_jsonb(v_t2_changes),
    'winner',v_mr.match_winner,'games_margin',v_margin,'margin_multiplier',v_margin_mult);
END;
$function$;


-- ─────────────────────────────────────────────────────────────────────────────
-- 2) Americano stats-trigger: STATEMENT-niveau (undgår N+1 storm) + REVOKE
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS americano_wins integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS americano_losses integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS americano_draws integer NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.recalc_americano_profile_stats(p_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public SET row_security = off AS $$
DECLARE w int; l int; d int;
BEGIN
  IF p_user_id IS NULL THEN RETURN; END IF;
  SELECT COUNT(*)::int INTO w FROM public.americano_matches m
  WHERE m.team_a_score IS NOT NULL AND m.team_b_score IS NOT NULL AND m.team_a_score <> m.team_b_score
    AND ((EXISTS(SELECT 1 FROM public.americano_participants p WHERE p.user_id=p_user_id AND p.id IN (m.team_a_p1,m.team_a_p2)) AND m.team_a_score>m.team_b_score)
      OR (EXISTS(SELECT 1 FROM public.americano_participants p WHERE p.user_id=p_user_id AND p.id IN (m.team_b_p1,m.team_b_p2)) AND m.team_b_score>m.team_a_score));
  SELECT COUNT(*)::int INTO l FROM public.americano_matches m
  WHERE m.team_a_score IS NOT NULL AND m.team_b_score IS NOT NULL AND m.team_a_score <> m.team_b_score
    AND ((EXISTS(SELECT 1 FROM public.americano_participants p WHERE p.user_id=p_user_id AND p.id IN (m.team_a_p1,m.team_a_p2)) AND m.team_b_score>m.team_a_score)
      OR (EXISTS(SELECT 1 FROM public.americano_participants p WHERE p.user_id=p_user_id AND p.id IN (m.team_b_p1,m.team_b_p2)) AND m.team_a_score>m.team_b_score));
  SELECT COUNT(*)::int INTO d FROM public.americano_matches m
  WHERE m.team_a_score IS NOT NULL AND m.team_b_score IS NOT NULL AND m.team_a_score = m.team_b_score
    AND (EXISTS(SELECT 1 FROM public.americano_participants p WHERE p.user_id=p_user_id AND p.id IN (m.team_a_p1,m.team_a_p2))
      OR EXISTS(SELECT 1 FROM public.americano_participants p WHERE p.user_id=p_user_id AND p.id IN (m.team_b_p1,m.team_b_p2)));
  UPDATE public.profiles SET americano_wins=COALESCE(w,0), americano_losses=COALESCE(l,0), americano_draws=COALESCE(d,0) WHERE id=p_user_id;
END; $$;

CREATE OR REPLACE FUNCTION public.trg_americano_match_recalc_stats()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public SET row_security = off AS $$
DECLARE uid uuid;
BEGIN
  FOR uid IN
    SELECT DISTINCT ap.user_id FROM public.americano_participants ap
    WHERE ap.tournament_id IN (SELECT DISTINCT tournament_id FROM changed_rows)
  LOOP PERFORM public.recalc_americano_profile_stats(uid); END LOOP;
  RETURN NULL;
END; $$;

DROP TRIGGER IF EXISTS trg_americano_matches_recalc ON public.americano_matches;
DROP TRIGGER IF EXISTS trg_americano_matches_recalc_ins_upd ON public.americano_matches;
DROP TRIGGER IF EXISTS trg_americano_matches_recalc_ins ON public.americano_matches;
DROP TRIGGER IF EXISTS trg_americano_matches_recalc_upd ON public.americano_matches;
DROP TRIGGER IF EXISTS trg_americano_matches_recalc_del ON public.americano_matches;

-- PostgreSQL kræver separate triggers pr. event når transition tables bruges
CREATE TRIGGER trg_americano_matches_recalc_ins
  AFTER INSERT ON public.americano_matches
  REFERENCING NEW TABLE AS changed_rows
  FOR EACH STATEMENT EXECUTE FUNCTION public.trg_americano_match_recalc_stats();

CREATE TRIGGER trg_americano_matches_recalc_upd
  AFTER UPDATE ON public.americano_matches
  REFERENCING NEW TABLE AS changed_rows
  FOR EACH STATEMENT EXECUTE FUNCTION public.trg_americano_match_recalc_stats();

CREATE TRIGGER trg_americano_matches_recalc_del
  AFTER DELETE ON public.americano_matches
  REFERENCING OLD TABLE AS changed_rows
  FOR EACH STATEMENT EXECUTE FUNCTION public.trg_americano_match_recalc_stats();

REVOKE ALL ON FUNCTION public.recalc_americano_profile_stats(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.trg_americano_match_recalc_stats() FROM PUBLIC;


-- ─────────────────────────────────────────────────────────────────────────────
-- 3) ELO-historik sync: REVOKE trigger og recalc-funktion fra PUBLIC
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.recalc_profile_stats_from_elo_history(p_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public SET row_security = off AS $$
DECLARE v_first numeric; v_delta numeric; v_games int; v_wins int;
BEGIN
  SELECT COUNT(*)::int INTO v_games FROM public.elo_history e
  WHERE e.user_id=p_user_id AND e.old_rating IS NOT NULL AND e.match_id IS NOT NULL;
  IF v_games IS NULL OR v_games = 0 THEN
    UPDATE public.profiles SET elo_rating=1000, games_played=0, games_won=0 WHERE id=p_user_id; RETURN;
  END IF;
  SELECT e.old_rating::numeric INTO v_first FROM public.elo_history e
  WHERE e.user_id=p_user_id AND e.old_rating IS NOT NULL AND e.match_id IS NOT NULL
  ORDER BY e.date ASC NULLS LAST, e.match_id ASC NULLS LAST, e.id ASC NULLS LAST LIMIT 1;
  SELECT COALESCE(SUM(CASE WHEN e.change IS NOT NULL THEN e.change::numeric
    WHEN e.new_rating IS NOT NULL AND e.old_rating IS NOT NULL THEN (e.new_rating-e.old_rating)::numeric
    ELSE 0::numeric END),0) INTO v_delta
  FROM public.elo_history e WHERE e.user_id=p_user_id AND e.old_rating IS NOT NULL AND e.match_id IS NOT NULL;
  SELECT COUNT(*)::int INTO v_wins FROM public.elo_history e
  WHERE e.user_id=p_user_id AND e.old_rating IS NOT NULL AND e.match_id IS NOT NULL AND lower(COALESCE(e.result,''))='win';
  UPDATE public.profiles AS p SET
    elo_rating=GREATEST(100,ROUND(COALESCE(v_first,1000)+COALESCE(v_delta,0))::int),
    games_played=v_games, games_won=v_wins WHERE p.id=p_user_id;
END; $$;

CREATE OR REPLACE FUNCTION public.trg_elo_history_sync_profile()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public SET row_security = off AS $$
DECLARE uid uuid;
BEGIN
  IF tg_op='DELETE' THEN uid:=OLD.user_id; ELSE uid:=NEW.user_id; END IF;
  IF uid IS NOT NULL THEN PERFORM public.recalc_profile_stats_from_elo_history(uid); END IF;
  IF tg_op='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS elo_history_sync_profile ON public.elo_history;
CREATE TRIGGER elo_history_sync_profile
  AFTER INSERT OR UPDATE OR DELETE ON public.elo_history
  FOR EACH ROW EXECUTE FUNCTION public.trg_elo_history_sync_profile();

REVOKE ALL ON FUNCTION public.recalc_profile_stats_from_elo_history(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.recalc_profile_stats_from_elo_history(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.trg_elo_history_sync_profile() FROM PUBLIC;


-- ─────────────────────────────────────────────────────────────────────────────
-- 4) Notifikationer: row_security = off inline + policies
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  type text NOT NULL DEFAULT 'info',
  title text NOT NULL,
  body text,
  match_id uuid,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
GRANT SELECT, UPDATE, DELETE ON public.notifications TO authenticated;

DROP POLICY IF EXISTS "notifications_select_own" ON public.notifications;
CREATE POLICY "notifications_select_own" ON public.notifications FOR SELECT TO authenticated USING ((select auth.uid())=user_id);
DROP POLICY IF EXISTS "notifications_update_own" ON public.notifications;
CREATE POLICY "notifications_update_own" ON public.notifications FOR UPDATE TO authenticated USING ((select auth.uid())=user_id) WITH CHECK ((select auth.uid())=user_id);
DROP POLICY IF EXISTS "notifications_delete_own" ON public.notifications;
CREATE POLICY "notifications_delete_own" ON public.notifications FOR DELETE TO authenticated USING ((select auth.uid())=user_id);

CREATE OR REPLACE FUNCTION public.create_notification_for_user(p_user_id uuid, p_type text, p_title text, p_body text, p_match_id uuid DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public SET row_security = off AS $$
BEGIN
  IF (SELECT auth.uid()) IS NULL THEN RAISE EXCEPTION 'Ikke logget ind'; END IF;
  IF p_user_id = (SELECT auth.uid()) THEN
    INSERT INTO public.notifications (user_id,type,title,body,match_id,read) VALUES (p_user_id,p_type,p_title,p_body,p_match_id,false); RETURN;
  END IF;
  IF p_match_id IS NULL THEN RAISE EXCEPTION 'Manglende match_id for notifikation til anden bruger'; END IF;
  IF EXISTS(SELECT 1 FROM public.match_players mp WHERE mp.match_id=p_match_id AND mp.user_id=(SELECT auth.uid()))
    OR EXISTS(SELECT 1 FROM public.matches m WHERE m.id=p_match_id AND m.creator_id=(SELECT auth.uid())) THEN
    INSERT INTO public.notifications (user_id,type,title,body,match_id,read) VALUES (p_user_id,p_type,p_title,p_body,p_match_id,false); RETURN;
  END IF;
  RAISE EXCEPTION 'Ingen adgang til at sende denne notifikation';
END; $$;
REVOKE ALL ON FUNCTION public.create_notification_for_user(uuid,text,text,text,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_notification_for_user(uuid,text,text,text,uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.notify_match_creator_on_join(p_match_id uuid, p_title text, p_body text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public SET row_security = off AS $$
DECLARE v_creator uuid; v_joiner uuid;
BEGIN
  v_joiner := (SELECT auth.uid());
  IF v_joiner IS NULL THEN RAISE EXCEPTION 'Ikke logget ind'; END IF;
  SELECT m.creator_id INTO v_creator FROM public.matches m WHERE m.id=p_match_id;
  IF v_creator IS NULL OR v_creator=v_joiner THEN RETURN; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.match_players mp WHERE mp.match_id=p_match_id AND mp.user_id=v_joiner) THEN
    RAISE EXCEPTION 'Du er ikke tilmeldt denne kamp';
  END IF;
  INSERT INTO public.notifications (user_id,type,title,body,match_id,read) VALUES (v_creator,'match_join',p_title,p_body,p_match_id,false);
END; $$;
REVOKE ALL ON FUNCTION public.notify_match_creator_on_join(uuid,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.notify_match_creator_on_join(uuid,text,text) TO authenticated;


-- ─────────────────────────────────────────────────────────────────────────────
-- 5) Indexes + CHECK constraint på americano_matches
-- ─────────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_americano_participants_user_id ON public.americano_participants (user_id);
CREATE INDEX IF NOT EXISTS idx_americano_matches_team_a_p1 ON public.americano_matches (team_a_p1);
CREATE INDEX IF NOT EXISTS idx_americano_matches_team_a_p2 ON public.americano_matches (team_a_p2);
CREATE INDEX IF NOT EXISTS idx_americano_matches_team_b_p1 ON public.americano_matches (team_b_p1);
CREATE INDEX IF NOT EXISTS idx_americano_matches_team_b_p2 ON public.americano_matches (team_b_p2);

ALTER TABLE public.americano_matches DROP CONSTRAINT IF EXISTS americano_matches_players_distinct;
ALTER TABLE public.americano_matches ADD CONSTRAINT americano_matches_players_distinct CHECK (
  team_a_p1<>team_a_p2 AND team_a_p1<>team_b_p1 AND team_a_p1<>team_b_p2 AND
  team_a_p2<>team_b_p1 AND team_a_p2<>team_b_p2 AND team_b_p1<>team_b_p2);


-- ─────────────────────────────────────────────────────────────────────────────
-- 6) public_upcoming_americano_events: N+1 fix (LEFT JOIN i stedet for subquery)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.public_upcoming_americano_events(p_limit integer DEFAULT 24)
RETURNS TABLE (id uuid, name text, tournament_date date, time_slot text, player_slots integer,
  points_per_match integer, status text, description text, participant_count bigint, court_name text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public SET row_security = off AS $$
  SELECT t.id, t.name, t.tournament_date, t.time_slot, t.player_slots, t.points_per_match,
    t.status, t.description, count(p.id)::bigint AS participant_count, c.name AS court_name
  FROM public.americano_tournaments t
  LEFT JOIN public.courts c ON c.id=t.court_id
  LEFT JOIN public.americano_participants p ON p.tournament_id=t.id
  WHERE t.tournament_date>=(timezone('Europe/Copenhagen',now()))::date AND t.status IN ('registration','playing')
  GROUP BY t.id, c.id
  ORDER BY t.tournament_date ASC, t.time_slot ASC, t.created_at ASC
  LIMIT greatest(1,least(coalesce(p_limit,24),100));
$$;
REVOKE ALL ON FUNCTION public.public_upcoming_americano_events(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_upcoming_americano_events(integer) TO anon, authenticated;


-- ─────────────────────────────────────────────────────────────────────────────
-- 7) elo_history: aktiver RLS + policy der tillader alle loggede at læse alt
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.elo_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS elo_history_select_own ON public.elo_history;
DROP POLICY IF EXISTS elo_history_select_authenticated ON public.elo_history;
CREATE POLICY elo_history_select_authenticated ON public.elo_history FOR SELECT TO authenticated USING (true);


-- ─────────────────────────────────────────────────────────────────────────────
-- 8) elo_history.created_at: tilføj kolonne + NOT NULL efter backfill
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.elo_history ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
UPDATE public.elo_history SET created_at=date::timestamptz WHERE created_at IS NULL;
ALTER TABLE public.elo_history ALTER COLUMN created_at SET NOT NULL;


-- ─────────────────────────────────────────────────────────────────────────────
-- 9) Security advisor: fastlås search_path på alle SECURITY DEFINER-funktioner
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname IN (
      'protect_elo_fields','handle_new_user','apply_elo_for_match',
      'recalc_profile_stats_from_elo_history','recalc_americano_profile_stats',
      'trg_americano_match_recalc_stats','trg_elo_history_sync_profile',
      'create_notification_for_user','notify_match_creator_on_join','public_upcoming_americano_events')
  LOOP
    EXECUTE format('ALTER FUNCTION %s SET search_path = public', r.sig);
    RAISE NOTICE 'SET search_path på %', r.sig;
  END LOOP;
END $$;

DROP POLICY IF EXISTS "Slots insertable" ON public.court_slots;


-- ─────────────────────────────────────────────────────────────────────────────
-- 10) Constraints: time_slot format, birth_year range, notifications FK
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.americano_tournaments DROP CONSTRAINT IF EXISTS americano_tournaments_time_slot_format;
ALTER TABLE public.americano_tournaments ADD CONSTRAINT americano_tournaments_time_slot_format CHECK (time_slot ~ '^\d{2}:\d{2}$');

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_birth_year_range;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_birth_year_range CHECK (birth_year IS NULL OR (birth_year BETWEEN 1920 AND 2015));

-- Ryd forældreløse match_id værdier op inden FK oprettes
UPDATE public.notifications
SET match_id = NULL
WHERE match_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.matches m WHERE m.id = notifications.match_id);

ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_match_id_fkey;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_match_id_fkey FOREIGN KEY (match_id) REFERENCES public.matches (id) ON DELETE SET NULL;


-- =============================================================================
-- FÆRDIG. Tjek at der ikke er fejl i output ovenfor.
-- =============================================================================
