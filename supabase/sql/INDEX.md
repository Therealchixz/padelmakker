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
| Funktioner i migrations (= i drift) | 157 |
| ...med en identisk fil i `supabase/sql/` | 111 |
| ...hvor ingen arkivfil matcher (alle er forældede) | 29 |
| ...som slet ikke findes i arkivet | 17 |
| Funktioner kun i arkivet (aldrig deployet herfra) | 0 |

## Funktioner i drift

| Funktion | Gældende migration | Identisk arkivfil | Forældede kopier |
|---|---|---|---|
| `_admin_audit_log` | `00000000000000_baseline_schema.sql` | `_p3a.sql`<br>`admin_security_phase3.sql`<br>`admin_security_phase3_deploy.sql` | — |
| `_americano_entity_finished_at` | `00000000000000_baseline_schema.sql` | `americano_liga_completed_at.sql` | — |
| `_growth_user_qualified` | `00000000000000_baseline_schema.sql` | `growth_campaign_first_200.sql` | — |
| `_insert_system_notification` | `00000000000000_baseline_schema.sql` | — | — |
| `_league_entity_finished_at` | `00000000000000_baseline_schema.sql` | `americano_liga_completed_at.sql` | — |
| `_result_error_entity_completed_at` | `00000000000000_baseline_schema.sql` | `americano_liga_completed_at.sql` | 2 |
| `_rpc_rate_limit_or_raise` | `00000000000000_baseline_schema.sql` | `security_hardening_phase2.sql` | — |
| `_skip_duplicate_entity_notification` | `00000000000000_baseline_schema.sql` | — | — |
| `_skip_duplicate_match_notification` | `00000000000000_baseline_schema.sql` | — | — |
| `admin_adjust_americano_elo` | `00000000000000_baseline_schema.sql` | `admin_adjust_americano_elo.sql` | — |
| `admin_adjust_elo` | `00000000000000_baseline_schema.sql` | — | 7 |
| `admin_audit_log_recent` | `00000000000000_baseline_schema.sql` | `_p3a.sql`<br>`admin_security_phase3.sql`<br>`admin_security_phase3_deploy.sql` | — |
| `admin_clear_pin_session` | `00000000000000_baseline_schema.sql` | `admin_pin_guard.sql` | — |
| `admin_correct_americano_tournament` | `00000000000000_baseline_schema.sql` | — | 3 |
| `admin_correct_league_match` | `00000000000000_baseline_schema.sql` | `_p3b.sql`<br>`admin_security_phase3_deploy.sql` | 1 |
| `admin_correct_match_result_and_recalc_elo` | `00000000000000_baseline_schema.sql` | — | 3 |
| `admin_delete_match` | `00000000000000_baseline_schema.sql` | `admin_delete_match.sql` | — |
| `admin_delete_user` | `00000000000000_baseline_schema.sql` | — | 3 |
| `admin_draw_growth_campaign` | `00000000000000_baseline_schema.sql` | `growth_campaign_admin_draw.sql` | — |
| `admin_get_dm_messages_between` | `00000000000000_baseline_schema.sql` | `admin_dm_report_context.sql` | — |
| `admin_get_growth_campaign_draw_status` | `00000000000000_baseline_schema.sql` | `growth_campaign_admin_draw.sql` | — |
| `admin_list_admin_ids` | `00000000000000_baseline_schema.sql` | `admin_list_admin_ids.sql`<br>`security_hardening_phase2.sql` | — |
| `admin_list_growth_campaign_entries` | `00000000000000_baseline_schema.sql` | `growth_campaign_first_200.sql` | — |
| `admin_open_result_error_reports_count` | `00000000000000_baseline_schema.sql` | `feature_result_error_reports.sql` | — |
| `admin_open_user_reports_count` | `00000000000000_baseline_schema.sql` | `user_blocks_and_reports.sql`<br>`user_report_admin_notify.sql` | — |
| `admin_pin_status` | `00000000000000_baseline_schema.sql` | `admin_pin_guard.sql` | — |
| `admin_profiles_with_email` | `00000000000000_baseline_schema.sql` | `pentest_pii_lockdown.sql` | — |
| `admin_restore_deleted_profile` | `00000000000000_baseline_schema.sql` | `_p3b.sql`<br>`admin_security_phase3_deploy.sql`<br>`admin_security_phase3_rpc.sql` | — |
| `admin_set_phone_verification_exempt` | `00000000000000_baseline_schema.sql` | `phone_exempt_skip_onboarding.sql` | 3 |
| `admin_setup_pin` | `00000000000000_baseline_schema.sql` | `security_hardening_match_writes_and_admin_pin.sql` | 4 |
| `admin_verify_pin` | `00000000000000_baseline_schema.sql` | `_p3a.sql`<br>`admin_pin_shorter_session.sql`<br>`admin_security_phase3_deploy.sql` | 1 |
| `americano_internal_tournament_creator` | `00000000000000_baseline_schema.sql` | `americano_rls_visibility.sql`<br>`americano_schema.sql` | — |
| `americano_internal_tournament_status` | `00000000000000_baseline_schema.sql` | `americano_rls_visibility.sql`<br>`americano_schema.sql` | — |
| `americano_is_participant` | `00000000000000_baseline_schema.sql` | `americano_rls_visibility.sql`<br>`americano_schema.sql` | — |
| `americano_match_count_is_valid` | `00000000000000_baseline_schema.sql` | — | 1 |
| `americano_round_robin_base_rounds` | `00000000000000_baseline_schema.sql` | `americano_expected_match_count_v2.sql` | — |
| `app_region_neighbours` | `20260922210546_app_region_neighbours_for_match_discovery.sql` | — | — |
| `apply_americano_elo_for_tournament` | `00000000000000_baseline_schema.sql` | `_americano_auth_fix.sql`<br>`_p3b.sql`<br>`admin_security_phase3_deploy.sql`<br>`americano_elo_rating.sql` | — |
| `apply_elo_for_match` | `00000000000000_baseline_schema.sql` | — | 4 |
| `apply_elo_for_match_core` | `00000000000000_baseline_schema.sql` | — | 1 |
| `apply_elo_for_match_system` | `00000000000000_baseline_schema.sql` | — | 1 |
| `apply_glicko2_shadow_for_match` | `00000000000000_baseline_schema.sql` | `elo_v2_glicko2_shadow.sql` | — |
| `approve_match_join_request` | `00000000000000_baseline_schema.sql` | `approve_match_join_request_rpc.sql`<br>`join_request_team_race_fix.sql` | 1 |
| `archive_profile_before_delete` | `00000000000000_baseline_schema.sql` | — | — |
| `auto_confirm_expired_match_results` | `00000000000000_baseline_schema.sql` | — | 1 |
| `block_user` | `00000000000000_baseline_schema.sql` | `user_blocks_and_reports.sql` | — |
| `can_confirm_match_result` | `00000000000000_baseline_schema.sql` | `security_hardening_match_writes_and_admin_pin.sql` | 2 |
| `cancel_play_intent` | `00000000000000_baseline_schema.sql` | `play_intent_pool.sql` | — |
| `canonical_app_region` | `00000000000000_baseline_schema.sql` | — | 1 |
| `check_rate_limit` | `00000000000000_baseline_schema.sql` | — | 1 |
| `claim_email_send_slot` | `20260923103039_discovery_email_cap_one_per_day.sql` | — | — |
| `complete_americano_tournament` | `00000000000000_baseline_schema.sql` | `_americano_auth_fix.sql`<br>`_p3b.sql`<br>`admin_security_phase3_deploy.sql`<br>`americano_elo_rating.sql`<br>`americano_liga_completed_at.sql` | — |
| `confirm_match_result_and_apply_elo` | `00000000000000_baseline_schema.sql` | `confirm_match_result_and_apply_elo.sql` | — |
| `create_notification_for_user` | `00000000000000_baseline_schema.sql` | `notification_rate_limits_restore.sql` | 5 |
| `create_notifications_for_users` | `00000000000000_baseline_schema.sql` | `notification_rate_limits_restore.sql` | 3 |
| `create_play_intent` | `00000000000000_baseline_schema.sql` | — | 2 |
| `create_rating_admin_flag` | `00000000000000_baseline_schema.sql` | `elo_guardrails_admin_flags.sql` | — |
| `detect_and_flag_suspicious_2v2_match` | `00000000000000_baseline_schema.sql` | `elo_guardrails_admin_flags.sql` | — |
| `discovery_notifications_today_count` | `00000000000000_baseline_schema.sql` | `discovery_notification_limits.sql` | 1 |
| `dispatch_push_to_user` | `20260921074448_raise_pg_net_timeout_for_push_and_reminders.sql` | — | 2 |
| `dm_message_preview` | `00000000000000_baseline_schema.sql` | `dm_chat_enhancements.sql` | — |
| `dm_users_blocked` | `00000000000000_baseline_schema.sql` | `user_blocks_and_reports.sql` | — |
| `email_unsub_token_for` | `20260922223032_email_unsubscribe_rpcs.sql` | — | — |
| `email_unsubscribe_by_token` | `20260922223032_email_unsubscribe_rpcs.sql` | — | — |
| `enforce_max_players` | `00000000000000_baseline_schema.sql` | — | — |
| `enroll_growth_campaign` | `00000000000000_baseline_schema.sql` | `security_hardening_match_writes_and_admin_pin.sql` | 1 |
| `ensure_email_unsub_token` | `20260922223016_email_unsubscribe_tokens.sql` | — | — |
| `expected_americano_match_count` | `00000000000000_baseline_schema.sql` | `americano_expected_match_count_v2.sql` | — |
| `expected_americano_match_count_legacy` | `00000000000000_baseline_schema.sql` | `americano_expected_match_count_v2.sql` | — |
| `expire_abandoned_in_progress_matches` | `00000000000000_baseline_schema.sql` | `match_proposal_reminders.sql` | — |
| `expire_stale_play_intents` | `00000000000000_baseline_schema.sql` | — | 1 |
| `expire_unstarted_matches` | `00000000000000_baseline_schema.sql` | `match_proposal_reminders.sql` | — |
| `fetch_match_message_counts` | `00000000000000_baseline_schema.sql` | `fetch_match_message_counts_participants_only.sql`<br>`fetch_match_message_counts_rpc.sql` | — |
| `format_padel_level` | `00000000000000_baseline_schema.sql` | `canonical_app_region_notify_fix.sql` | — |
| `get_discovery_digest_candidates` | `20260923213710_discovery_daily_digest.sql` | `discovery_daily_digest.sql` | — |
| `get_due_reactivation_nudges` | `20260923095114_reactivation_nudge_reaches_by_email_and_counts_makkere.sql` | — | 1 |
| `get_due_reminders` | `00000000000000_baseline_schema.sql` | — | 1 |
| `get_growth_campaign_public` | `00000000000000_baseline_schema.sql` | `growth_campaign_admin_draw.sql` | 1 |
| `get_my_growth_campaign_status` | `00000000000000_baseline_schema.sql` | `growth_campaign_admin_draw.sql` | 1 |
| `glicko2_shadow_update_one` | `00000000000000_baseline_schema.sql` | `elo_v2_glicko2_shadow.sql` | — |
| `guard_americano_complete_transition` | `00000000000000_baseline_schema.sql` | `americano_expected_match_count_v2.sql` | — |
| `guard_americano_participant_insert` | `00000000000000_baseline_schema.sql` | `harden_kampe_lifecycle_guards.sql` | — |
| `guard_match_result_confirmation` | `00000000000000_baseline_schema.sql` | — | 3 |
| `guard_matches_client_update` | `00000000000000_baseline_schema.sql` | `security_hardening_match_writes_and_admin_pin.sql` | — |
| `handle_new_user` | `00000000000000_baseline_schema.sql` | — | — |
| `has_admin_role` | `00000000000000_baseline_schema.sql` | `_p3a.sql`<br>`add_admin_role.sql`<br>`admin_security_phase3.sql`<br>`admin_security_phase3_deploy.sql` | — |
| `has_valid_match_result_confirmation` | `00000000000000_baseline_schema.sql` | `_p3b.sql`<br>`admin_security_phase3_deploy.sql`<br>`admin_security_phase3_rpc.sql`<br>`security_hardening_phase2.sql` | 2 |
| `haversine_km` | `00000000000000_baseline_schema.sql` | `reactivation_nudges.sql` | — |
| `is_admin` | `00000000000000_baseline_schema.sql` | `_p3a.sql`<br>`admin_security_phase3.sql`<br>`admin_security_phase3_deploy.sql` | 1 |
| `is_banned` | `00000000000000_baseline_schema.sql` | `admin_ban_feature.sql` | — |
| `is_league_participant` | `00000000000000_baseline_schema.sql` | `league_team_chat.sql` | — |
| `is_user_admin_verified` | `00000000000000_baseline_schema.sql` | `security_hardening_phase2.sql` | — |
| `join_match` | `00000000000000_baseline_schema.sql` | — | — |
| `join_open_match` | `00000000000000_baseline_schema.sql` | `join_open_match_court_side_param.sql`<br>`join_open_match_rpc.sql` | 1 |
| `kampe_unread_badge_count` | `00000000000000_baseline_schema.sql` | `kampe_unread_badge_count.sql` | — |
| `kick_player_from_match` | `00000000000000_baseline_schema.sql` | `kick_player_from_match.sql` | — |
| `league_team_messages_set_league_id` | `00000000000000_baseline_schema.sql` | `league_team_chat.sql` | — |
| `leave_match` | `00000000000000_baseline_schema.sql` | — | 1 |
| `list_dm_conversation_summaries` | `00000000000000_baseline_schema.sql` | `dm_chat_enhancements.sql` | 2 |
| `list_pending_match_proposals` | `00000000000000_baseline_schema.sql` | `play_intent_pool.sql` | — |
| `makker_feed_is_active` | `20260922214627_makker_seeking_stays_on_until_turned_off.sql` | — | 2 |
| `makker_filter_availability_overlap` | `00000000000000_baseline_schema.sql` | `makker_availability_flexible.sql`<br>`makker_filter_v2.sql` | — |
| `makker_filter_court_side_ok` | `00000000000000_baseline_schema.sql` | `makker_filter_v2.sql` | — |
| `makker_filter_intent_compat_score` | `00000000000000_baseline_schema.sql` | `makker_filter_v2.sql` | — |
| `makker_filter_intent_ok` | `00000000000000_baseline_schema.sql` | `makker_filter_v2.sql` | — |
| `makker_filter_level_bounds` | `20260924073235_makker_filter_custom_level.sql` | `makker_filter_custom_level.sql` | 1 |
| `makker_filter_normalize_intent` | `00000000000000_baseline_schema.sql` | `makker_filter_v2.sql` | — |
| `makker_filter_normalize_side` | `00000000000000_baseline_schema.sql` | `makker_filter_v2.sql` | — |
| `makker_filter_partner_court_side_ok` | `00000000000000_baseline_schema.sql` | `makker_partner_court_side.sql` | — |
| `makker_filter_play_style_ok` | `00000000000000_baseline_schema.sql` | `makker_filter_v2.sql` | — |
| `makker_filter_resolve_partner_court_side` | `00000000000000_baseline_schema.sql` | `makker_partner_court_side.sql` | — |
| `match_filter_level_window_from_prefs` | `00000000000000_baseline_schema.sql` | `match_filter_niveau.sql` | — |
| `match_filter_prefs_level` | `00000000000000_baseline_schema.sql` | `match_filter_niveau.sql` | — |
| `match_players_fill_court_side` | `00000000000000_baseline_schema.sql` | `match_player_court_side.sql`<br>`match_player_court_side_join_fix.sql` | — |
| `match_players_free_court_side` | `00000000000000_baseline_schema.sql` | `match_player_court_side.sql`<br>`match_player_court_side_join_fix.sql` | — |
| `messages_enforce_dm_block` | `00000000000000_baseline_schema.sql` | `user_blocks_and_reports.sql` | — |
| `notifications_dispatch_match_proposal` | `00000000000000_baseline_schema.sql` | `dispatch_push_on_match_proposal.sql` | — |
| `notify_auto_confirmed_match_result` | `00000000000000_baseline_schema.sql` | — | — |
| `notify_creator_join_request` | `00000000000000_baseline_schema.sql` | — | 1 |
| `notify_elo_changes_for_match` | `00000000000000_baseline_schema.sql` | — | — |
| `notify_league_invite` | `00000000000000_baseline_schema.sql` | — | 1 |
| `notify_league_invite_accepted` | `00000000000000_baseline_schema.sql` | — | 1 |
| `notify_league_invite_declined` | `00000000000000_baseline_schema.sql` | — | — |
| `notify_makker_watchers` | `20260923100444_makker_watch_button_beats_stale_filter_default.sql` | — | 5 |
| `notify_match_creator_on_join` | `20260923162656_match_join_notification_grouped.sql` | `match_join_notification_grouped.sql` | 3 |
| `notify_match_watchers` | `20260922224422_match_discovery_reaches_lapsed_users.sql` | — | 6 |
| `padel_elo_to_level` | `00000000000000_baseline_schema.sql` | `match_filter_niveau.sql` | — |
| `padel_level_to_elo` | `00000000000000_baseline_schema.sql` | `match_filter_niveau.sql` | — |
| `parse_clock_time` | `00000000000000_baseline_schema.sql` | `play_intent_open_match_notify.sql`<br>`play_intent_pool.sql` | — |
| `play_intent_overlaps_match_time` | `00000000000000_baseline_schema.sql` | `play_intent_pool.sql` | 1 |
| `protect_elo_fields` | `00000000000000_baseline_schema.sql` | `phone_verification_exempt_hardening.sql` | 5 |
| `public_americano_preview` | `00000000000000_baseline_schema.sql` | `public_share_pages.sql` | — |
| `public_match_preview` | `00000000000000_baseline_schema.sql` | `public_share_pages.sql` | — |
| `public_platform_stats` | `00000000000000_baseline_schema.sql` | `public_platform_stats_rpc.sql` | — |
| `public_upcoming_americano_events` | `00000000000000_baseline_schema.sql` | `_alle_fixes.sql` | 1 |
| `recalc_americano_elo_from_history` | `00000000000000_baseline_schema.sql` | `_p3b.sql`<br>`admin_correct_americano_and_recalc_elo.sql`<br>`admin_security_phase3_deploy.sql` | — |
| `recalc_americano_profile_stats` | `00000000000000_baseline_schema.sql` | `fix_americano_visibility_and_stats.sql` | 2 |
| `recalc_profile_stats_from_elo_history` | `00000000000000_baseline_schema.sql` | — | 5 |
| `record_consent_from_metadata` | `20260923112121_consent_log_records_signup_acceptance.sql` | — | — |
| `release_email_send_slot` | `20260922224600_release_email_send_slot.sql` | — | — |
| `report_americano_match_score` | `00000000000000_baseline_schema.sql` | — | 1 |
| `report_user` | `00000000000000_baseline_schema.sql` | — | 3 |
| `respond_to_match_proposal` | `00000000000000_baseline_schema.sql` | — | 1 |
| `set_dm_message_reaction` | `00000000000000_baseline_schema.sql` | `dm_chat_enhancements.sql` | — |
| `set_league_team_message_reaction` | `00000000000000_baseline_schema.sql` | `dm_chat_enhancements.sql` | — |
| `set_match_player_court_side` | `00000000000000_baseline_schema.sql` | `match_player_court_side.sql`<br>`match_player_court_side_join_fix.sql` | — |
| `set_match_player_team` | `00000000000000_baseline_schema.sql` | `match_player_court_side.sql`<br>`set_match_player_team_rpc.sql` | 1 |
| `submit_result_error_report` | `00000000000000_baseline_schema.sql` | `feature_result_error_reports.sql` | — |
| `trg_americano_elo_history_sync_profile` | `00000000000000_baseline_schema.sql` | `admin_adjust_americano_elo.sql`<br>`americano_elo_history_sync_profile.sql` | — |
| `trg_americano_match_recalc_stats` | `00000000000000_baseline_schema.sql` | `_alle_fixes.sql`<br>`americano_profile_stats.sql` | — |
| `trg_elo_history_auto_flag_match` | `00000000000000_baseline_schema.sql` | `elo_guardrails_admin_flags.sql` | — |
| `trg_elo_history_sync_profile` | `00000000000000_baseline_schema.sql` | `_alle_fixes.sql`<br>`sync_profiles_from_elo_history.sql` | — |
| `trg_set_americano_elo_history_engine_meta` | `00000000000000_baseline_schema.sql` | `elo_guardrails_admin_flags.sql` | — |
| `trg_set_elo_history_engine_meta` | `00000000000000_baseline_schema.sql` | `elo_guardrails_admin_flags.sql` | — |
| `try_form_match_proposal` | `00000000000000_baseline_schema.sql` | — | 1 |
| `unblock_user` | `00000000000000_baseline_schema.sql` | `user_blocks_and_reports.sql` | — |
| `user_is_phone_verification_exempt` | `00000000000000_baseline_schema.sql` | `user_phone_verification_exempt_rpc.sql` | — |

## I databasen, men i ingen migration

Oejebliksbillede fra **2026-09-20** (projekt `hzmrsqrerkoftcppfklu`).
Selve listen er et haandholdt oejebliksbillede (`live-only-functions.json`).
Om hullet stadig er aabent afgoeres derimod HER, mod de migrations der findes nu.

**Hullet er lukket.** Alle 49 funktioner oprettes nu af en migration.

De blev lavet i haanden foer historikken begyndte. `00000000000000_baseline_schema.sql`
er dumpet direkte fra produktionen og daekker dem, saa en frisk database bliver
identisk med den koerende - ikke fordi nogen holder to ting i sync.

Listen staar tilbage som optegnelse over hvad der manglede.

| Funktion | Oprettes nu af |
|---|---|
| `_americano_entity_finished_at` | `00000000000000_baseline_schema.sql` |
| `_insert_system_notification` | `00000000000000_baseline_schema.sql` |
| `_league_entity_finished_at` | `00000000000000_baseline_schema.sql` |
| `_result_error_entity_completed_at` | `00000000000000_baseline_schema.sql` |
| `_rpc_rate_limit_or_raise` | `00000000000000_baseline_schema.sql` |
| `_skip_duplicate_entity_notification` | `00000000000000_baseline_schema.sql` |
| `_skip_duplicate_match_notification` | `00000000000000_baseline_schema.sql` |
| `admin_correct_americano_tournament` | `00000000000000_baseline_schema.sql` |
| `admin_correct_league_match` | `00000000000000_baseline_schema.sql` |
| `admin_correct_match_result_and_recalc_elo` | `00000000000000_baseline_schema.sql` |
| `admin_delete_user` | `00000000000000_baseline_schema.sql` |
| `admin_get_dm_messages_between` | `00000000000000_baseline_schema.sql` |
| `admin_list_admin_ids` | `00000000000000_baseline_schema.sql` |
| `admin_open_result_error_reports_count` | `00000000000000_baseline_schema.sql` |
| `admin_open_user_reports_count` | `00000000000000_baseline_schema.sql` |
| `apply_americano_elo_for_tournament` | `00000000000000_baseline_schema.sql` |
| `apply_elo_for_match` | `00000000000000_baseline_schema.sql` |
| `apply_elo_for_match_core` | `00000000000000_baseline_schema.sql` |
| `apply_elo_for_match_system` | `00000000000000_baseline_schema.sql` |
| `apply_glicko2_shadow_for_match` | `00000000000000_baseline_schema.sql` |
| `archive_profile_before_delete` | `00000000000000_baseline_schema.sql` |
| `block_user` | `00000000000000_baseline_schema.sql` |
| `check_rate_limit` | `00000000000000_baseline_schema.sql` |
| `complete_americano_tournament` | `00000000000000_baseline_schema.sql` |
| `create_rating_admin_flag` | `00000000000000_baseline_schema.sql` |
| `detect_and_flag_suspicious_2v2_match` | `00000000000000_baseline_schema.sql` |
| `dm_users_blocked` | `00000000000000_baseline_schema.sql` |
| `enforce_max_players` | `00000000000000_baseline_schema.sql` |
| `glicko2_shadow_update_one` | `00000000000000_baseline_schema.sql` |
| `guard_match_result_confirmation` | `00000000000000_baseline_schema.sql` |
| `handle_new_user` | `00000000000000_baseline_schema.sql` |
| `is_banned` | `00000000000000_baseline_schema.sql` |
| `is_user_admin_verified` | `00000000000000_baseline_schema.sql` |
| `join_match` | `00000000000000_baseline_schema.sql` |
| `messages_enforce_dm_block` | `00000000000000_baseline_schema.sql` |
| `notify_auto_confirmed_match_result` | `00000000000000_baseline_schema.sql` |
| `notify_elo_changes_for_match` | `00000000000000_baseline_schema.sql` |
| `public_platform_stats` | `00000000000000_baseline_schema.sql` |
| `public_upcoming_americano_events` | `00000000000000_baseline_schema.sql` |
| `recalc_americano_elo_from_history` | `00000000000000_baseline_schema.sql` |
| `recalc_americano_profile_stats` | `00000000000000_baseline_schema.sql` |
| `recalc_profile_stats_from_elo_history` | `00000000000000_baseline_schema.sql` |
| `submit_result_error_report` | `00000000000000_baseline_schema.sql` |
| `trg_americano_match_recalc_stats` | `00000000000000_baseline_schema.sql` |
| `trg_elo_history_auto_flag_match` | `00000000000000_baseline_schema.sql` |
| `trg_elo_history_sync_profile` | `00000000000000_baseline_schema.sql` |
| `trg_set_americano_elo_history_engine_meta` | `00000000000000_baseline_schema.sql` |
| `trg_set_elo_history_engine_meta` | `00000000000000_baseline_schema.sql` |
| `unblock_user` | `00000000000000_baseline_schema.sql` |

