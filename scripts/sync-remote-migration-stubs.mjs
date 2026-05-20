/**
 * One-off: align supabase/migrations/ with remote schema_migrations history.
 * Creates stub files for versions already applied on prod (db push no-op).
 * Run: node scripts/sync-remote-migration-stubs.mjs
 */
import { readFileSync, writeFileSync, existsSync, unlinkSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const migrationsDir = join(root, 'supabase', 'migrations');

/** Remote schema_migrations as of 2026-05-20 (Supabase MCP list_migrations). */
const REMOTE = [
  ['20260416123610', 'messages_realtime_and_update_policy'],
  ['20260416125447', 'add_match_type_and_join_requests'],
  ['20260416130533', 'messages_realtime_replica_identity'],
  ['20260416133704', 'approve_match_join_request_rpc'],
  ['20260416134508', 'match_players_update_own_team'],
  ['20260416135303', 'notify_creator_join_request_rpc'],
  ['20260416140959', 'add_available_days_to_profiles'],
  ['20260416172316', 'americano_admin_kick'],
  ['20260416180550', 'liga_schema'],
  ['20260416220821', 'liga_teams_schema'],
  ['20260416222435', 'league_teams_system'],
  ['20260417102106', 'league_teams_invitation_status'],
  ['20260417103431', 'notify_league_invite_rpc'],
  ['20260417104121', 'liga_teams_creator_kick_and_max_teams'],
  ['20260417121717', 'add_total_rounds_to_leagues'],
  ['20260419202941', 'add_seeking_match_at_timestamp'],
  ['20260518211157', 'league_matches_rls_policy_cleanup'],
  ['20260518211655', 'league_rls_app_aligned'],
  ['20260518211706', 'security_phase3_rpc_and_internal'],
  ['20260518212037', 'security_phase3b_revoke_public_execute'],
  ['20260519095805', 'phone_verification_exempt'],
  ['20260519191902', 'admin_pin_shorter_session'],
  ['20260519193959', 'admin_security_phase3_core'],
  ['20260519194102', 'admin_security_phase3_pin'],
  ['20260519194505', 'admin_security_phase3_rpc_fixes'],
  ['20260519194714', 'admin_delete_user_audit'],
  ['20260519194754', 'admin_americano_pin_auth'],
  ['20260519195659', 'fix_americano_rls_helper_grants'],
  ['20260520084506', 'phone_verification_exempt_hardening'],
  ['20260520085148', 'user_phone_verification_exempt_rpc'],
  ['20260520091905', 'phone_exempt_skip_onboarding'],
  ['20260520111751', 'notifications_kampe_entity_focus'],
  ['20260520120206', 'notifications_suite'],
  ['20260520120314', 'notifications_suite_v2'],
  ['20260520123829', 'notifications_remaining_v2'],
  ['20260520193927', 'notification_invite_push_fixes'],
  ['20260520193932', 'drop_duplicate_notification_rpc_overloads'],
];

const STUB = `-- Migration already applied on production (history sync stub).
-- Do not re-run manually. Reference SQL may live under supabase/sql/.
`;

const RENAME_SOURCES = {
  '20260520193927_notification_invite_push_fixes.sql':
    '20260521120000_notification_invite_push_fixes.sql',
  '20260520193932_drop_duplicate_notification_rpc_overloads.sql':
    '20260521130000_drop_duplicate_notification_rpc_overloads.sql',
};

const REMOVE_LOCAL_ONLY = new Set([
  '20260520143000_notifications_suite.sql',
  '20260520150000_notifications_remaining.sql',
  '20260521120000_notification_invite_push_fixes.sql',
  '20260521130000_drop_duplicate_notification_rpc_overloads.sql',
]);

let created = 0;
let skipped = 0;

for (const [version, name] of REMOTE) {
  const filename = `${version}_${name}.sql`;
  const path = join(migrationsDir, filename);

  if (existsSync(path)) {
    skipped++;
    continue;
  }

  if (RENAME_SOURCES[filename]) {
    const src = join(migrationsDir, RENAME_SOURCES[filename]);
    if (existsSync(src)) {
      writeFileSync(path, readFileSync(src, 'utf8'));
      console.log('copied', RENAME_SOURCES[filename], '->', filename);
      created++;
      continue;
    }
  }

  writeFileSync(path, STUB);
  console.log('stub', filename);
  created++;
}

const remoteVersions = new Set(REMOTE.map(([v]) => v));
for (const f of readdirSync(migrationsDir)) {
  if (!f.endsWith('.sql')) continue;
  const ver = f.slice(0, 14);
  if (!remoteVersions.has(ver)) {
    console.warn('WARN: local migration not on remote:', f);
  }
}

for (const f of REMOVE_LOCAL_ONLY) {
  const p = join(migrationsDir, f);
  if (existsSync(p)) {
    unlinkSync(p);
    console.log('removed', f);
  }
}

console.log(`done: ${created} created, ${skipped} already present`);
