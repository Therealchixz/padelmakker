-- Opfølgning på sikkerhedsgennemgangen: ydelse og oprydning i RLS.
--
-- 1) 34 foreign keys manglede et index. Vigtigst ved sletning: admin_delete_user
--    og sletning af en kamp rører mange underordnede tabeller, og uden index
--    skal Postgres gennemlæse hver enkelt tabel for hver sletning.
--
-- 2) Fire funktioner havde ikke fast search_path (security advisor).
--
-- 3) growth_campaign_entries_own_read kaldte auth.uid() pr. række.
--
-- 4) Op til tre overlappende RLS-policies pr. tabel og handling. Permissive
--    policies lægges sammen med OR, så Postgres evaluerer dem alle for hver
--    række. De slås sammen til én pr. tabel og handling.
--
--    Adgangen er bevidst uændret. De ældste "admin"-policies tjekker kun
--    profiles.role = 'admin', mens is_admin() også kræver en bekræftet
--    admin-PIN. Fordi den svageste vandt sammenlægningen, er den samlede
--    policy skrevet med has_admin_role() — nøjagtig samme adgang som i dag.
--    Grunden til ikke at stramme her: liga-administration ligger i den
--    almindelige Liga-fane bag et rent rolle-tjek i klienten, ikke bag
--    AdminPinGate. Et krav om PIN i databasen ville braekke det flow.
--    Se noten nederst.

-- ─── 1) Manglende indexes på foreign keys ───────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_target_user_id ON public.admin_audit_log (target_user_id);
CREATE INDEX IF NOT EXISTS idx_americano_matches_team_a_p1 ON public.americano_matches (team_a_p1);
CREATE INDEX IF NOT EXISTS idx_americano_matches_team_a_p2 ON public.americano_matches (team_a_p2);
CREATE INDEX IF NOT EXISTS idx_americano_matches_team_b_p1 ON public.americano_matches (team_b_p1);
CREATE INDEX IF NOT EXISTS idx_americano_matches_team_b_p2 ON public.americano_matches (team_b_p2);
CREATE INDEX IF NOT EXISTS idx_bookings_court_id ON public.bookings (court_id);
CREATE INDEX IF NOT EXISTS idx_bookings_user_id ON public.bookings (user_id);
CREATE INDEX IF NOT EXISTS idx_court_slots_booked_by ON public.court_slots (booked_by);
CREATE INDEX IF NOT EXISTS idx_court_slots_court_id ON public.court_slots (court_id);
CREATE INDEX IF NOT EXISTS idx_deleted_players_archive_deleted_by ON public.deleted_players_archive (deleted_by);
CREATE INDEX IF NOT EXISTS idx_deleted_players_archive_restored_by ON public.deleted_players_archive (restored_by);
CREATE INDEX IF NOT EXISTS idx_deleted_players_archive_restored_user_id ON public.deleted_players_archive (restored_user_id);
CREATE INDEX IF NOT EXISTS idx_growth_campaigns_drawn_by ON public.growth_campaigns (drawn_by);
CREATE INDEX IF NOT EXISTS idx_league_matches_reported_by ON public.league_matches (reported_by);
CREATE INDEX IF NOT EXISTS idx_league_matches_team1_id ON public.league_matches (team1_id);
CREATE INDEX IF NOT EXISTS idx_league_matches_team2_id ON public.league_matches (team2_id);
CREATE INDEX IF NOT EXISTS idx_league_matches_winner_id ON public.league_matches (winner_id);
CREATE INDEX IF NOT EXISTS idx_league_team_messages_sender_id ON public.league_team_messages (sender_id);
CREATE INDEX IF NOT EXISTS idx_leagues_created_by ON public.leagues (created_by);
CREATE INDEX IF NOT EXISTS idx_match_photos_user_id ON public.match_photos (user_id);
CREATE INDEX IF NOT EXISTS idx_match_proposal_members_intent_id ON public.match_proposal_members (intent_id);
CREATE INDEX IF NOT EXISTS idx_match_proposals_match_id ON public.match_proposals (match_id);
CREATE INDEX IF NOT EXISTS idx_match_results_confirmed_by ON public.match_results (confirmed_by);
CREATE INDEX IF NOT EXISTS idx_match_results_submitted_by ON public.match_results (submitted_by);
CREATE INDEX IF NOT EXISTS idx_match_results_team1_player1_id ON public.match_results (team1_player1_id);
CREATE INDEX IF NOT EXISTS idx_match_results_team1_player2_id ON public.match_results (team1_player2_id);
CREATE INDEX IF NOT EXISTS idx_match_results_team2_player1_id ON public.match_results (team2_player1_id);
CREATE INDEX IF NOT EXISTS idx_match_results_team2_player2_id ON public.match_results (team2_player2_id);
CREATE INDEX IF NOT EXISTS idx_matches_court_id ON public.matches (court_id);
CREATE INDEX IF NOT EXISTS idx_matches_started_by ON public.matches (started_by);
CREATE INDEX IF NOT EXISTS idx_rating_admin_flags_reviewed_by ON public.rating_admin_flags (reviewed_by);
CREATE INDEX IF NOT EXISTS idx_result_error_reports_resolved_by ON public.result_error_reports (resolved_by);
CREATE INDEX IF NOT EXISTS idx_user_reports_reporter_id ON public.user_reports (reporter_id);
CREATE INDEX IF NOT EXISTS idx_user_reports_resolved_by ON public.user_reports (resolved_by);

-- ─── 2) Fast search_path på de sidste fire funktioner ───────────────────────
ALTER FUNCTION public.haversine_km(double precision, double precision, double precision, double precision)
  SET search_path TO 'public';
ALTER FUNCTION public.parse_clock_time(text)
  SET search_path TO 'public';
ALTER FUNCTION public.play_intent_overlaps_match_time(time without time zone, time without time zone, text, text)
  SET search_path TO 'public';
ALTER FUNCTION public.makker_feed_is_active(jsonb, timestamp with time zone)
  SET search_path TO 'public';

-- ─── 3) auth.uid() én gang i stedet for pr. række ───────────────────────────
DROP POLICY IF EXISTS growth_campaign_entries_own_read ON public.growth_campaign_entries;
CREATE POLICY growth_campaign_entries_own_read
  ON public.growth_campaign_entries
  FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

-- ─── 4) Én policy pr. tabel og handling ────────────────────────────────────

-- leagues DELETE var: is_admin() / (created_by ELLER is_admin()) / role='admin'
DROP POLICY IF EXISTS leagues_admin_delete ON public.leagues;
DROP POLICY IF EXISTS leagues_creator_delete ON public.leagues;
DROP POLICY IF EXISTS leagues_delete_admin ON public.leagues;
DROP POLICY IF EXISTS leagues_delete ON public.leagues;
CREATE POLICY leagues_delete
  ON public.leagues FOR DELETE TO authenticated
  USING ((created_by = (select auth.uid())) OR (select public.has_admin_role()));

-- leagues INSERT var: is_admin() / created_by / role='admin'
DROP POLICY IF EXISTS leagues_admin_insert ON public.leagues;
DROP POLICY IF EXISTS leagues_creator_insert ON public.leagues;
DROP POLICY IF EXISTS leagues_insert_admin ON public.leagues;
DROP POLICY IF EXISTS leagues_insert ON public.leagues;
CREATE POLICY leagues_insert
  ON public.leagues FOR INSERT TO authenticated
  WITH CHECK ((created_by = (select auth.uid())) OR (select public.has_admin_role()));

-- leagues UPDATE var: is_admin() / created_by / role='admin'
DROP POLICY IF EXISTS leagues_admin_update ON public.leagues;
DROP POLICY IF EXISTS leagues_creator_update ON public.leagues;
DROP POLICY IF EXISTS leagues_update_admin ON public.leagues;
DROP POLICY IF EXISTS leagues_update ON public.leagues;
CREATE POLICY leagues_update
  ON public.leagues FOR UPDATE TO authenticated
  USING ((created_by = (select auth.uid())) OR (select public.has_admin_role()))
  WITH CHECK ((created_by = (select auth.uid())) OR (select public.has_admin_role()));

-- Identisk dublet: begge var USING (true) for authenticated.
DROP POLICY IF EXISTS leagues_read_all ON public.leagues;
DROP POLICY IF EXISTS lteams_read_all ON public.league_teams;
DROP POLICY IF EXISTS lmatches_read_all ON public.league_matches;

-- league_teams INSERT var: player1 / (player1 ELLER player2)
DROP POLICY IF EXISTS league_teams_insert ON public.league_teams;
DROP POLICY IF EXISTS lteams_insert_self ON public.league_teams;
CREATE POLICY league_teams_insert
  ON public.league_teams FOR INSERT TO authenticated
  WITH CHECK (
    (player1_id = (select auth.uid()))
    OR (player2_id = (select auth.uid()))
  );

-- league_teams UPDATE var: (player2 ELLER role='admin') / role='admin'
DROP POLICY IF EXISTS league_teams_update ON public.league_teams;
DROP POLICY IF EXISTS lteams_update_admin ON public.league_teams;
CREATE POLICY league_teams_update
  ON public.league_teams FOR UPDATE TO authenticated
  USING ((player2_id = (select auth.uid())) OR (select public.has_admin_role()));

-- match_join_requests SELECT var: egen anmodning / anmodning til egen kamp
DROP POLICY IF EXISTS join_req_select_creator ON public.match_join_requests;
DROP POLICY IF EXISTS join_req_select_own ON public.match_join_requests;
DROP POLICY IF EXISTS join_req_select ON public.match_join_requests;
CREATE POLICY join_req_select
  ON public.match_join_requests FOR SELECT TO authenticated
  USING (
    (user_id = (select auth.uid()))
    OR EXISTS (
      SELECT 1 FROM public.matches m
      WHERE m.id = match_join_requests.match_id
        AND m.creator_id = (select auth.uid())
    )
  );

-- match_results DELETE: den ene policy var helt indeholdt i den anden.
DROP POLICY IF EXISTS match_results_delete_by_submitter_or_admin ON public.match_results;

-- elo_history: "no_*"-policerne gav false for PUBLIC ved siden af admin-
-- policerne. Uden dem falder adgangen tilbage til RLS' eget afslag, så
-- resultatet er det samme med én policy mindre at evaluere pr. række.
DROP POLICY IF EXISTS elo_history_no_delete ON public.elo_history;
DROP POLICY IF EXISTS elo_history_no_insert ON public.elo_history;
DROP POLICY IF EXISTS elo_history_no_update ON public.elo_history;

-- NOTE til senere beslutning: admin-handlinger på ligaer, liga-hold og
-- liga-kampe kræver kun admin-rollen, ikke en bekræftet admin-PIN, i
-- modsætning til sletning af brugere og ELO-justering. Skal de også bag
-- PIN-gaten, kræver det både denne policy-ændring og at Liga-fanen sender
-- admin-handlinger gennem AdminPinGate.
