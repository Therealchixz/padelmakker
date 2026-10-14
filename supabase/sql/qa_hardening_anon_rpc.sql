-- =============================================================================
-- QA-gennemgang 14. okt. 2026: stram adgangen for ikke-loggede besøgende
-- =============================================================================
-- 1. Disse database-funktioner kræver alle login. De afviser allerede en
--    besøgende uden login inde i funktionen, men de bør slet ikke kunne kaldes
--    uden login. Login-brugere (authenticated) beholder adgangen.
--    De offentlige funktioner (forside-tal, delte kampe/turneringer, kampagnens
--    offentlige side) er bevidst IKKE med her.
-- 2. consent_log: samme regel som før (man ser kun sin egen accept), men skrevet
--    så databasen kun slår brugeren op én gang pr. forespørgsel.
-- =============================================================================

REVOKE EXECUTE ON FUNCTION public.admin_draw_growth_campaign(text, boolean) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_get_growth_campaign_draw_status(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_list_growth_campaign_entries(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.cancel_play_intent(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.create_play_intent(date, time, time) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.enroll_growth_campaign(text, boolean) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_my_growth_campaign_status(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_league_participant(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.join_open_match(uuid, integer, text, text, text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.list_pending_match_proposals() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.respond_to_match_proposal(uuid, boolean) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.set_match_player_court_side(uuid, uuid, text) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.admin_draw_growth_campaign(text, boolean) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_get_growth_campaign_draw_status(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_list_growth_campaign_entries(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.cancel_play_intent(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_play_intent(date, time, time) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.enroll_growth_campaign(text, boolean) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_my_growth_campaign_status(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_league_participant(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.join_open_match(uuid, integer, text, text, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.list_pending_match_proposals() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.respond_to_match_proposal(uuid, boolean) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.set_match_player_court_side(uuid, uuid, text) TO authenticated, service_role;

DROP POLICY IF EXISTS consent_log_select_own ON public.consent_log;
CREATE POLICY consent_log_select_own ON public.consent_log
  FOR SELECT TO authenticated
  USING (user_id = (select auth.uid()));
