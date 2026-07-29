-- Hardening (Supabase advisors):
-- A) 'function_search_path_mutable': fastlås search_path på app-funktioner.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'enforce_max_players','padel_level_to_elo','padel_elo_to_level',
        'match_filter_prefs_level','match_filter_level_window_from_prefs',
        'makker_filter_normalize_side','makker_filter_court_side_ok',
        'admin_adjust_elo','expected_americano_match_count',
        'glicko2_shadow_update_one','makker_filter_play_style_ok',
        'makker_filter_availability_overlap','americano_match_count_is_valid',
        'americano_round_robin_base_rounds','expected_americano_match_count_legacy',
        'join_match','kick_player_from_match','makker_filter_normalize_intent',
        'makker_filter_intent_compat_score','makker_filter_intent_ok',
        'makker_filter_level_bounds','makker_filter_resolve_partner_court_side',
        'recalc_profile_stats_from_elo_history','makker_filter_partner_court_side_ok',
        'dm_message_preview'
      )
      AND NOT EXISTS (
        SELECT 1 FROM unnest(coalesce(p.proconfig, '{}'::text[])) cfg
        WHERE cfg LIKE 'search_path=%'
      )
  LOOP
    EXECUTE format('ALTER FUNCTION %s SET search_path = public', r.sig);
  END LOOP;
END $$;

-- B) 'anon_security_definer_function_executable': fjern anon-EXECUTE på interne
-- SECURITY DEFINER-funktioner. Friholdt: public_platform_stats og
-- public_upcoming_americano_events (kaldes før login) samt funktioner brugt i
-- RLS-policies (americano_is_participant, americano_internal_tournament_*,
-- is_league_participant).
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef
      AND p.proname IN (
        '_insert_system_notification','_skip_duplicate_entity_notification',
        '_skip_duplicate_match_notification','admin_adjust_americano_elo',
        'admin_delete_match','confirm_match_result_and_apply_elo',
        'create_notification_for_user','create_notifications_for_users',
        'discovery_notifications_today_count','guard_americano_participant_insert',
        'has_admin_role','join_open_match','league_team_messages_set_league_id',
        'notify_auto_confirmed_match_result','notify_elo_changes_for_match',
        'notify_league_invite','notify_league_invite_accepted',
        'notify_league_invite_declined','notify_makker_watchers',
        'notify_match_watchers','report_americano_match_score',
        'set_dm_message_reaction','set_league_team_message_reaction',
        'set_match_player_team','trg_americano_elo_history_sync_profile',
        'user_is_phone_verification_exempt'
      )
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM anon', r.sig);
  END LOOP;
END $$;
