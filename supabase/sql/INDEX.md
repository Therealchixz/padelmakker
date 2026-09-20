# Hvilken fil gælder? — genereret oversigt

**Rediger ikke denne fil i hånden.** Kør `npm run db:sql-index`.

`supabase/migrations/` er det der kører i produktion — det er rækkefølgen
`supabase db push` udfører. `supabase/sql/` er et arkiv af løse scripts, hvor
samme funktion kan optræde i flere filer i flere generationer.

Tabellen nedenfor siger, for hver funktion, hvilken migration der gælder, og
hvilken arkivfil (hvis nogen) der er identisk med den. Sammenligningen er på
funktionens krop, normaliseret på samme måde som Postgres gemmer den, så den
kan efterprøves direkte mod den kørende database.

## Tal

| | Antal |
|---|---|
| Funktioner i migrations (= i drift) | 149 |
| ...med en identisk fil i `supabase/sql/` | 121 |
| ...hvor ingen arkivfil matcher (alle er forældede) | 18 |
| ...som slet ikke findes i arkivet | 10 |
| Funktioner kun i arkivet (aldrig deployet herfra) | 0 |

## Funktioner i drift

| Funktion | Gældende migration | Identisk arkivfil | Forældede kopier |
|---|---|---|---|
| `_admin_audit_log` | `20260519194714_admin_delete_user_audit.sql` | — | 3 |
| `_americano_entity_finished_at` | `00000000000000_baseline_schema.sql` | `americano_liga_completed_at.sql` | — |
| `_growth_user_qualified` | `20260824231412_growth_campaign_qualify_email_sms.sql` | `growth_campaign_first_200.sql` | — |
| `_insert_system_notification` | `00000000000000_baseline_schema.sql` | — | — |
| `_league_entity_finished_at` | `00000000000000_baseline_schema.sql` | `americano_liga_completed_at.sql` | — |
| `_result_error_entity_completed_at` | `00000000000000_baseline_schema.sql` | `americano_liga_completed_at.sql` | 2 |
| `_rpc_rate_limit_or_raise` | `00000000000000_baseline_schema.sql` | `security_hardening_phase2.sql` | — |
| `_skip_duplicate_entity_notification` | `00000000000000_baseline_schema.sql` | — | — |
| `_skip_duplicate_match_notification` | `00000000000000_baseline_schema.sql` | — | — |
| `admin_adjust_americano_elo` | `20260528195947_admin_adjust_americano_elo_skip_trigger_fix.sql` | `admin_adjust_americano_elo.sql` | — |
| `admin_adjust_elo` | `20260519194505_admin_security_phase3_rpc_fixes.sql` | `_p3b.sql`<br>`admin_security_phase3_deploy.sql`<br>`admin_security_phase3_rpc.sql` | 4 |
| `admin_audit_log_recent` | `20260519194714_admin_delete_user_audit.sql` | — | 3 |
| `admin_clear_pin_session` | `20260519194102_admin_security_phase3_pin.sql` | `admin_pin_guard.sql` | — |
| `admin_correct_americano_tournament` | `00000000000000_baseline_schema.sql` | — | 3 |
| `admin_correct_league_match` | `00000000000000_baseline_schema.sql` | `_p3b.sql`<br>`admin_security_phase3_deploy.sql` | 1 |
| `admin_correct_match_result_and_recalc_elo` | `00000000000000_baseline_schema.sql` | — | 3 |
| `admin_delete_match` | `20260608144351_admin_delete_match.sql` | `admin_delete_match.sql` | — |
| `admin_delete_user` | `00000000000000_baseline_schema.sql` | — | 3 |
| `admin_draw_growth_campaign` | `20260819195423_growth_campaign_admin_draw.sql` | `growth_campaign_admin_draw.sql` | — |
| `admin_get_dm_messages_between` | `00000000000000_baseline_schema.sql` | `admin_dm_report_context.sql` | — |
| `admin_get_growth_campaign_draw_status` | `20260819195423_growth_campaign_admin_draw.sql` | `growth_campaign_admin_draw.sql` | — |
| `admin_list_admin_ids` | `00000000000000_baseline_schema.sql` | `admin_list_admin_ids.sql`<br>`security_hardening_phase2.sql` | — |
| `admin_list_growth_campaign_entries` | `20260819193705_growth_campaign_first_200.sql` | `growth_campaign_first_200.sql` | — |
| `admin_open_result_error_reports_count` | `00000000000000_baseline_schema.sql` | `feature_result_error_reports.sql` | — |
| `admin_open_user_reports_count` | `00000000000000_baseline_schema.sql` | `user_blocks_and_reports.sql`<br>`user_report_admin_notify.sql` | — |
| `admin_pin_status` | `20260519194102_admin_security_phase3_pin.sql` | `admin_pin_guard.sql` | — |
| `admin_profiles_with_email` | `20260729181407_pii_lockdown_email_columns.sql` | `pentest_pii_lockdown.sql` | — |
| `admin_restore_deleted_profile` | `20260519194505_admin_security_phase3_rpc_fixes.sql` | `_p3b.sql`<br>`admin_security_phase3_deploy.sql`<br>`admin_security_phase3_rpc.sql` | — |
| `admin_set_phone_verification_exempt` | `20260520091905_phone_exempt_skip_onboarding.sql` | `phone_exempt_skip_onboarding.sql` | 3 |
| `admin_setup_pin` | `20260918234636_security_hardening_match_writes_and_admin_pin.sql` | `security_hardening_match_writes_and_admin_pin.sql` | 4 |
| `admin_verify_pin` | `20260519194102_admin_security_phase3_pin.sql` | `admin_pin_guard.sql` | 3 |
| `americano_internal_tournament_creator` | `20260519195659_fix_americano_rls_helper_grants.sql` | `americano_rls_visibility.sql`<br>`americano_schema.sql` | — |
| `americano_internal_tournament_status` | `20260519195659_fix_americano_rls_helper_grants.sql` | `americano_rls_visibility.sql`<br>`americano_schema.sql` | — |
| `americano_is_participant` | `20260519195659_fix_americano_rls_helper_grants.sql` | `americano_rls_visibility.sql`<br>`americano_schema.sql` | — |
| `americano_match_count_is_valid` | `20260527211843_americano_expected_match_count_v2.sql` | `americano_expected_match_count_v2.sql` | — |
| `americano_round_robin_base_rounds` | `20260527211843_americano_expected_match_count_v2.sql` | `americano_expected_match_count_v2.sql` | — |
| `apply_americano_elo_for_tournament` | `00000000000000_baseline_schema.sql` | `_americano_auth_fix.sql`<br>`_p3b.sql`<br>`admin_security_phase3_deploy.sql`<br>`americano_elo_rating.sql` | — |
| `apply_elo_for_match` | `00000000000000_baseline_schema.sql` | — | 4 |
| `apply_elo_for_match_core` | `00000000000000_baseline_schema.sql` | — | 1 |
| `apply_elo_for_match_system` | `00000000000000_baseline_schema.sql` | — | 1 |
| `apply_glicko2_shadow_for_match` | `00000000000000_baseline_schema.sql` | `elo_v2_glicko2_shadow.sql` | — |
| `approve_match_join_request` | `20260713183802_join_request_team_race_fix.sql` | `approve_match_join_request_rpc.sql`<br>`join_request_team_race_fix.sql` | 1 |
| `archive_profile_before_delete` | `00000000000000_baseline_schema.sql` | — | — |
| `auto_confirm_expired_match_results` | `20260729102910_fix_auto_confirm_score_display_column.sql` | — | 1 |
| `block_user` | `00000000000000_baseline_schema.sql` | `user_blocks_and_reports.sql` | — |
| `can_confirm_match_result` | `20260918234636_security_hardening_match_writes_and_admin_pin.sql` | `security_hardening_match_writes_and_admin_pin.sql` | 2 |
| `cancel_play_intent` | `20260820171616_play_intent_pool_functions.sql` | `play_intent_pool.sql` | — |
| `canonical_app_region` | `20260820163108_canonical_app_region_notify_fix.sql` | `canonical_app_region_notify_fix.sql` | — |
| `check_rate_limit` | `00000000000000_baseline_schema.sql` | — | 1 |
| `complete_americano_tournament` | `00000000000000_baseline_schema.sql` | `_americano_auth_fix.sql`<br>`_p3b.sql`<br>`admin_security_phase3_deploy.sql`<br>`americano_elo_rating.sql`<br>`americano_liga_completed_at.sql` | — |
| `confirm_match_result_and_apply_elo` | `20260705185329_confirm_match_result_and_apply_elo.sql` | `confirm_match_result_and_apply_elo.sql` | — |
| `create_notification_for_user` | `20260815151045_admin_caller_match_notifications.sql` | `notification_rate_limits_restore.sql` | 5 |
| `create_notifications_for_users` | `20260714184211_notification_batch_and_americano_lock.sql` | `notification_rate_limits_restore.sql` | 3 |
| `create_play_intent` | `20260822131252_create_play_intent_open_matches.sql` | `play_intent_open_match_notify.sql` | 1 |
| `create_rating_admin_flag` | `00000000000000_baseline_schema.sql` | `elo_guardrails_admin_flags.sql` | — |
| `detect_and_flag_suspicious_2v2_match` | `00000000000000_baseline_schema.sql` | `elo_guardrails_admin_flags.sql` | — |
| `discovery_notifications_today_count` | `20260528150000_discovery_notification_limits_separate.sql` | `discovery_notification_limits.sql` | 1 |
| `dispatch_push_to_user` | `20260919005225_anon_key_from_app_config.sql` | `anon_key_from_app_config.sql` | 1 |
| `dm_message_preview` | `20260531205308_dm_chat_enhancements_rpc.sql` | `dm_chat_enhancements.sql` | — |
| `dm_users_blocked` | `00000000000000_baseline_schema.sql` | `user_blocks_and_reports.sql` | — |
| `enforce_max_players` | `00000000000000_baseline_schema.sql` | — | — |
| `enroll_growth_campaign` | `20260918234636_security_hardening_match_writes_and_admin_pin.sql` | `security_hardening_match_writes_and_admin_pin.sql` | 1 |
| `expected_americano_match_count` | `20260527211843_americano_expected_match_count_v2.sql` | `americano_expected_match_count_v2.sql` | — |
| `expected_americano_match_count_legacy` | `20260527211843_americano_expected_match_count_v2.sql` | `americano_expected_match_count_v2.sql` | — |
| `expire_abandoned_in_progress_matches` | `20260914205556_app_audit_false_positive_guards.sql` | `match_proposal_reminders.sql` | — |
| `expire_stale_play_intents` | `20260820182416_play_intent_pool_cron_cleanup.sql` | `play_intent_pool.sql` | — |
| `expire_unstarted_matches` | `20260914204354_reminder_guards_played_matches.sql` | `match_proposal_reminders.sql` | — |
| `fetch_match_message_counts` | `20260714212957_fetch_match_message_counts_participants_only.sql` | `fetch_match_message_counts_participants_only.sql`<br>`fetch_match_message_counts_rpc.sql` | — |
| `format_padel_level` | `20260820172047_notify_makker_level_format_trim.sql` | `canonical_app_region_notify_fix.sql` | — |
| `get_due_reactivation_nudges` | `20260914205611_app_audit_reactivation_and_watchers.sql` | `reactivation_nudges.sql` | — |
| `get_due_reminders` | `20260914204354_reminder_guards_played_matches.sql` | `match_proposal_reminders.sql` | — |
| `get_growth_campaign_public` | `20260819195423_growth_campaign_admin_draw.sql` | `growth_campaign_admin_draw.sql` | 1 |
| `get_my_growth_campaign_status` | `20260819195423_growth_campaign_admin_draw.sql` | `growth_campaign_admin_draw.sql` | 1 |
| `glicko2_shadow_update_one` | `00000000000000_baseline_schema.sql` | `elo_v2_glicko2_shadow.sql` | — |
| `guard_americano_complete_transition` | `20260527211843_americano_expected_match_count_v2.sql` | `americano_expected_match_count_v2.sql` | — |
| `guard_americano_participant_insert` | `20260914210450_expire_anon_and_americano_date_guard.sql` | `harden_kampe_lifecycle_guards.sql` | — |
| `guard_match_result_confirmation` | `00000000000000_baseline_schema.sql` | — | 3 |
| `guard_matches_client_update` | `20260918234636_security_hardening_match_writes_and_admin_pin.sql` | `security_hardening_match_writes_and_admin_pin.sql` | — |
| `handle_new_user` | `00000000000000_baseline_schema.sql` | — | — |
| `has_admin_role` | `20260519193959_admin_security_phase3_core.sql` | `_p3a.sql`<br>`add_admin_role.sql`<br>`admin_security_phase3.sql`<br>`admin_security_phase3_deploy.sql` | — |
| `has_valid_match_result_confirmation` | `20260519194754_admin_americano_pin_auth.sql` | `_p3b.sql`<br>`admin_security_phase3_deploy.sql`<br>`admin_security_phase3_rpc.sql`<br>`security_hardening_phase2.sql` | 2 |
| `haversine_km` | `20260819221257_reactivation_nudges.sql` | `reactivation_nudges.sql` | — |
| `is_admin` | `20260519193959_admin_security_phase3_core.sql` | `_p3a.sql`<br>`admin_security_phase3.sql`<br>`admin_security_phase3_deploy.sql` | 1 |
| `is_banned` | `00000000000000_baseline_schema.sql` | `admin_ban_feature.sql` | — |
| `is_league_participant` | `20260531130644_league_team_chat.sql` | `league_team_chat.sql` | — |
| `is_user_admin_verified` | `00000000000000_baseline_schema.sql` | `security_hardening_phase2.sql` | — |
| `join_match` | `00000000000000_baseline_schema.sql` | — | — |
| `join_open_match` | `20260826201359_join_open_match_court_side_param.sql` | `join_open_match_court_side_param.sql`<br>`join_open_match_rpc.sql` | 1 |
| `kampe_unread_badge_count` | `20260919003249_kampe_unread_badge_count_rpc.sql` | `kampe_unread_badge_count.sql` | — |
| `kick_player_from_match` | `20260815151019_harden_kick_player_and_admin_notify.sql` | `kick_player_from_match.sql` | — |
| `league_team_messages_set_league_id` | `20260531130644_league_team_chat.sql` | `league_team_chat.sql` | — |
| `leave_match` | `20260714184211_notification_batch_and_americano_lock.sql` | — | 1 |
| `list_dm_conversation_summaries` | `20260531205308_dm_chat_enhancements_rpc.sql` | `dm_chat_enhancements.sql` | 2 |
| `list_pending_match_proposals` | `20260825202121_list_open_match_proposals_after_accept.sql` | `play_intent_pool.sql` | — |
| `makker_feed_is_active` | `20260822133300_makker_feed_is_active.sql` | `canonical_app_region_notify_fix.sql`<br>`seeking_makker_match.sql` | — |
| `makker_filter_availability_overlap` | `20260528130000_makker_availability_flexible.sql` | `makker_availability_flexible.sql`<br>`makker_filter_v2.sql` | — |
| `makker_filter_court_side_ok` | `20260527120000_makker_filter_v2.sql` | `makker_filter_v2.sql` | — |
| `makker_filter_intent_compat_score` | `20260527120000_makker_filter_v2.sql` | `makker_filter_v2.sql` | — |
| `makker_filter_intent_ok` | `20260527120000_makker_filter_v2.sql` | `makker_filter_v2.sql` | — |
| `makker_filter_level_bounds` | `20260527120000_makker_filter_v2.sql` | `makker_filter_v2.sql` | — |
| `makker_filter_normalize_intent` | `20260527120000_makker_filter_v2.sql` | `makker_filter_v2.sql` | — |
| `makker_filter_normalize_side` | `20260527120000_makker_filter_v2.sql` | `makker_filter_v2.sql` | — |
| `makker_filter_partner_court_side_ok` | `20260528120000_makker_partner_court_side.sql` | `makker_partner_court_side.sql` | — |
| `makker_filter_play_style_ok` | `20260527120000_makker_filter_v2.sql` | `makker_filter_v2.sql` | — |
| `makker_filter_resolve_partner_court_side` | `20260528120000_makker_partner_court_side.sql` | `makker_partner_court_side.sql` | — |
| `match_filter_level_window_from_prefs` | `20260525140000_match_filter_level_window_pad_realistic.sql` | `match_filter_niveau.sql` | — |
| `match_filter_prefs_level` | `20260524120000_match_filter_niveau.sql` | `match_filter_niveau.sql` | — |
| `match_players_fill_court_side` | `20260826200208_match_player_court_side_join_fix.sql` | `match_player_court_side.sql`<br>`match_player_court_side_join_fix.sql` | — |
| `match_players_free_court_side` | `20260826200208_match_player_court_side_join_fix.sql` | `match_player_court_side.sql`<br>`match_player_court_side_join_fix.sql` | — |
| `messages_enforce_dm_block` | `00000000000000_baseline_schema.sql` | `user_blocks_and_reports.sql` | — |
| `notifications_dispatch_match_proposal` | `20260914205556_app_audit_false_positive_guards.sql` | `dispatch_push_on_match_proposal.sql` | — |
| `notify_auto_confirmed_match_result` | `00000000000000_baseline_schema.sql` | — | — |
| `notify_creator_join_request` | `20260416135303_notify_creator_join_request_rpc.sql` | — | 1 |
| `notify_elo_changes_for_match` | `00000000000000_baseline_schema.sql` | — | — |
| `notify_league_invite` | `20260417103431_notify_league_invite_rpc.sql` | — | 1 |
| `notify_league_invite_accepted` | `20260520123829_notifications_remaining_v2.sql` | — | 1 |
| `notify_league_invite_declined` | `20260520123829_notifications_remaining_v2.sql` | — | — |
| `notify_makker_watchers` | `20260822133340_notify_makker_watchers_seeking_match.sql` | `canonical_app_region_notify_fix.sql`<br>`seeking_makker_match.sql` | 3 |
| `notify_match_creator_on_join` | `20260714184211_notification_batch_and_americano_lock.sql` | `notify_match_creator_on_join_only.sql` | 2 |
| `notify_match_watchers` | `20260914205631_app_audit_play_intent_window.sql` | `play_intent_open_match_notify.sql` | 5 |
| `padel_elo_to_level` | `20260524120000_match_filter_niveau.sql` | `match_filter_niveau.sql` | — |
| `padel_level_to_elo` | `20260524120000_match_filter_niveau.sql` | `match_filter_niveau.sql` | — |
| `parse_clock_time` | `20260822131205_play_intent_open_match_notify.sql` | `play_intent_open_match_notify.sql`<br>`play_intent_pool.sql` | — |
| `play_intent_overlaps_match_time` | `20260822131205_play_intent_open_match_notify.sql` | `play_intent_open_match_notify.sql` | 1 |
| `protect_elo_fields` | `20260520084506_phone_verification_exempt_hardening.sql` | `_p3b.sql`<br>`admin_security_phase3_deploy.sql`<br>`admin_security_phase3_rpc.sql` | 3 |
| `public_americano_preview` | `20260819203028_public_share_pages.sql` | `public_share_pages.sql` | — |
| `public_match_preview` | `20260819203028_public_share_pages.sql` | `public_share_pages.sql` | — |
| `public_platform_stats` | `00000000000000_baseline_schema.sql` | `public_platform_stats_rpc.sql` | — |
| `public_upcoming_americano_events` | `00000000000000_baseline_schema.sql` | `_alle_fixes.sql` | 1 |
| `recalc_americano_elo_from_history` | `00000000000000_baseline_schema.sql` | `_p3b.sql`<br>`admin_correct_americano_and_recalc_elo.sql`<br>`admin_security_phase3_deploy.sql` | — |
| `recalc_americano_profile_stats` | `00000000000000_baseline_schema.sql` | `fix_americano_visibility_and_stats.sql` | 2 |
| `recalc_profile_stats_from_elo_history` | `00000000000000_baseline_schema.sql` | — | 5 |
| `report_americano_match_score` | `20260714184211_notification_batch_and_americano_lock.sql` | — | 1 |
| `report_user` | `20260520193927_notification_invite_push_fixes.sql` | — | 3 |
| `respond_to_match_proposal` | `20260820171645_play_intent_pool_respond.sql` | `play_intent_pool.sql` | — |
| `set_dm_message_reaction` | `20260531205308_dm_chat_enhancements_rpc.sql` | `dm_chat_enhancements.sql` | — |
| `set_league_team_message_reaction` | `20260531205308_dm_chat_enhancements_rpc.sql` | `dm_chat_enhancements.sql` | — |
| `set_match_player_court_side` | `20260826200208_match_player_court_side_join_fix.sql` | `match_player_court_side.sql`<br>`match_player_court_side_join_fix.sql` | — |
| `set_match_player_team` | `20260826193743_match_player_team_clears_side.sql` | `match_player_court_side.sql`<br>`set_match_player_team_rpc.sql` | 1 |
| `submit_result_error_report` | `00000000000000_baseline_schema.sql` | `feature_result_error_reports.sql` | — |
| `trg_americano_elo_history_sync_profile` | `20260528195947_admin_adjust_americano_elo_skip_trigger_fix.sql` | `admin_adjust_americano_elo.sql`<br>`americano_elo_history_sync_profile.sql` | — |
| `trg_americano_match_recalc_stats` | `00000000000000_baseline_schema.sql` | `_alle_fixes.sql`<br>`americano_profile_stats.sql` | — |
| `trg_elo_history_auto_flag_match` | `00000000000000_baseline_schema.sql` | `elo_guardrails_admin_flags.sql` | — |
| `trg_elo_history_sync_profile` | `00000000000000_baseline_schema.sql` | `_alle_fixes.sql`<br>`sync_profiles_from_elo_history.sql` | — |
| `trg_set_americano_elo_history_engine_meta` | `00000000000000_baseline_schema.sql` | `elo_guardrails_admin_flags.sql` | — |
| `trg_set_elo_history_engine_meta` | `00000000000000_baseline_schema.sql` | `elo_guardrails_admin_flags.sql` | — |
| `try_form_match_proposal` | `20260820171616_play_intent_pool_functions.sql` | `play_intent_pool.sql` | — |
| `unblock_user` | `00000000000000_baseline_schema.sql` | `user_blocks_and_reports.sql` | — |
| `user_is_phone_verification_exempt` | `20260520085148_user_phone_verification_exempt_rpc.sql` | `user_phone_verification_exempt_rpc.sql` | — |

## I databasen, men i ingen migration

Oejebliksbillede fra **2026-09-20** (projekt `hzmrsqrerkoftcppfklu`).
Ikke auto-genereret — se `live-only-functions.json` for hvordan det opdateres.

**49 funktioner koerer i produktion, som ingen migration opretter.**
En database bygget fra `supabase/migrations/` alene ville mangle dem, saa et
nyt miljoe (staging, gendannelse efter nedbrud) kan ikke bygges fra historikken
som den er nu.

| Funktion | Findes i arkivet? |
|---|---|
| `_americano_entity_finished_at` | `americano_liga_completed_at.sql` |
| `_insert_system_notification` | **nej** |
| `_league_entity_finished_at` | `americano_liga_completed_at.sql` |
| `_result_error_entity_completed_at` | `americano_liga_completed_at.sql`<br>`feature_result_error_reports.sql`<br>`fix_result_error_completion_time.sql` |
| `_rpc_rate_limit_or_raise` | `security_hardening_phase2.sql` |
| `_skip_duplicate_entity_notification` | **nej** |
| `_skip_duplicate_match_notification` | **nej** |
| `admin_correct_americano_tournament` | `_p3b.sql`<br>`admin_correct_americano_and_recalc_elo.sql`<br>`admin_security_phase3_deploy.sql` |
| `admin_correct_league_match` | `_p3b.sql`<br>`admin_correct_league_match.sql`<br>`admin_security_phase3_deploy.sql` |
| `admin_correct_match_result_and_recalc_elo` | `_p3b.sql`<br>`admin_correct_match_result_and_recalc_elo.sql`<br>`admin_security_phase3_deploy.sql` |
| `admin_delete_user` | `admin_delete_user.sql`<br>`admin_delete_user.sql`<br>`admin_security_phase3_deploy.sql` |
| `admin_get_dm_messages_between` | `admin_dm_report_context.sql` |
| `admin_list_admin_ids` | `admin_list_admin_ids.sql`<br>`security_hardening_phase2.sql` |
| `admin_open_result_error_reports_count` | `feature_result_error_reports.sql` |
| `admin_open_user_reports_count` | `user_blocks_and_reports.sql`<br>`user_report_admin_notify.sql` |
| `apply_americano_elo_for_tournament` | `_americano_auth_fix.sql`<br>`_p3b.sql`<br>`admin_security_phase3_deploy.sql`<br>`americano_elo_rating.sql` |
| `apply_elo_for_match` | `_alle_fixes.sql`<br>`apply_elo_dynamic_k.sql`<br>`elo_v2_glicko2_shadow.sql`<br>`match_result_opponent_confirmation_guard.sql` |
| `apply_elo_for_match_core` | `elo_v2_glicko2_shadow.sql` |
| `apply_elo_for_match_system` | `elo_v2_glicko2_shadow.sql` |
| `apply_glicko2_shadow_for_match` | `elo_v2_glicko2_shadow.sql` |
| `archive_profile_before_delete` | **nej** |
| `block_user` | `user_blocks_and_reports.sql` |
| `check_rate_limit` | `rate_limit.sql` |
| `complete_americano_tournament` | `_americano_auth_fix.sql`<br>`_p3b.sql`<br>`admin_security_phase3_deploy.sql`<br>`americano_elo_rating.sql`<br>`americano_liga_completed_at.sql` |
| `create_rating_admin_flag` | `elo_guardrails_admin_flags.sql` |
| `detect_and_flag_suspicious_2v2_match` | `elo_guardrails_admin_flags.sql` |
| `dm_users_blocked` | `user_blocks_and_reports.sql` |
| `enforce_max_players` | **nej** |
| `glicko2_shadow_update_one` | `elo_v2_glicko2_shadow.sql` |
| `guard_match_result_confirmation` | `elo_security_hardening.sql`<br>`fix_force_start_and_confirm_trigger.sql`<br>`match_result_opponent_confirmation_guard.sql` |
| `handle_new_user` | **nej** |
| `is_banned` | `admin_ban_feature.sql` |
| `is_user_admin_verified` | `security_hardening_phase2.sql` |
| `join_match` | **nej** |
| `messages_enforce_dm_block` | `user_blocks_and_reports.sql` |
| `notify_auto_confirmed_match_result` | **nej** |
| `notify_elo_changes_for_match` | **nej** |
| `public_platform_stats` | `public_platform_stats_rpc.sql` |
| `public_upcoming_americano_events` | `_alle_fixes.sql`<br>`public_upcoming_americano_events.sql` |
| `recalc_americano_elo_from_history` | `_p3b.sql`<br>`admin_correct_americano_and_recalc_elo.sql`<br>`admin_security_phase3_deploy.sql` |
| `recalc_americano_profile_stats` | `_alle_fixes.sql`<br>`americano_profile_stats.sql`<br>`fix_americano_visibility_and_stats.sql` |
| `recalc_profile_stats_from_elo_history` | `_alle_fixes.sql`<br>`deep_fix_elo_sync.sql`<br>`fix_elo_sync_logic.sql`<br>`sync_profiles_from_elo_history.sql`<br>`unlock_and_sync_elo.sql` |
| `submit_result_error_report` | `feature_result_error_reports.sql` |
| `trg_americano_match_recalc_stats` | `_alle_fixes.sql`<br>`americano_profile_stats.sql` |
| `trg_elo_history_auto_flag_match` | `elo_guardrails_admin_flags.sql` |
| `trg_elo_history_sync_profile` | `_alle_fixes.sql`<br>`sync_profiles_from_elo_history.sql` |
| `trg_set_americano_elo_history_engine_meta` | `elo_guardrails_admin_flags.sql` |
| `trg_set_elo_history_engine_meta` | `elo_guardrails_admin_flags.sql` |
| `unblock_user` | `user_blocks_and_reports.sql` |

