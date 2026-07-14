/**
 * Replace empty migration stubs with idempotent SQL from supabase/sql/ or sibling migrations.
 *
 *   node scripts/backfill-migration-stubs.mjs
 *   node scripts/backfill-migration-stubs.mjs --dry-run
 *   node scripts/backfill-migration-stubs.mjs --rename-mcp
 */
import { readFileSync, writeFileSync, readdirSync, renameSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const migrationsDir = join(root, 'supabase', 'migrations');
const sqlDir = join(root, 'supabase', 'sql');

const dryRun = process.argv.includes('--dry-run');
const renameMcp = process.argv.includes('--rename-mcp');

const STUB_RE =
  /history sync stub|already applied on production|applied on prod via dashboard/i;

/** Remote version -> logical name (for mcp_remote_history_sync files). */
const VERSION_NAMES = {
  '20260521074215': 'match_watch_discovery',
  '20260521074255': 'match_watch_discovery_functions',
  '20260521093418': 'makker_search_filter',
  '20260521094121': 'match_search_prefs_column',
  '20260521094149': 'match_filter_niveau',
  '20260521094338': 'notify_match_watchers_niveau_sync',
  '20260521100123': 'makker_filter_v2',
  '20260521100239': 'makker_filter_v2_helpers',
  '20260521100323': 'makker_filter_v2_notify',
  '20260521104600': 'makker_partner_court_side',
  '20260521104656': 'makker_notify_partner_court_side',
  '20260521105008': 'makker_availability_flexible',
  '20260521105328': 'seeking_match_ttl_7_days',
  '20260521105411': 'seeking_match_ttl_7_days_restore',
  '20260521105835': 'discovery_notification_limits_separate',
  '20260521105911': 'notify_match_watchers_separate_daily_cap',
  '20260521105936': 'notify_makker_watchers_separate_daily_cap',
  '20260521122527': 'profiles_city_optional',
};

/** version -> source spec (sql:path | migration:file | migration:file:from-to) */
const SOURCE_BY_VERSION = {
  '20260416123610': 'sql:recovered/messages_realtime_and_update_policy.sql',
  '20260416125447': 'sql:add_match_type_and_join_requests.sql',
  '20260416130533': 'sql:recovered/messages_realtime_replica_identity.sql',
  '20260416133704': 'sql:approve_match_join_request_rpc.sql',
  '20260416134508': 'sql:recovered/match_players_update_own_team.sql',
  '20260416135303': 'sql:recovered/notify_creator_join_request_rpc.sql',
  '20260416140959': 'sql:add_available_days_to_profiles.sql',
  '20260416172316': 'sql:americano_admin_kick.sql',
  '20260416180550': 'sql:recovered/league_core_schema.sql',
  '20260416220821': 'sql:recovered/league_teams_table.sql',
  '20260416222435': 'sql:recovered/league_teams_system.sql',
  '20260417102106': 'sql:recovered/league_teams_invitation_status.sql',
  '20260417103431': 'sql:recovered/notify_league_invite_rpc.sql',
  '20260417104121': 'sql:recovered/liga_teams_creator_kick_and_max_teams.sql',
  '20260417121717': 'sql:recovered/add_total_rounds_to_leagues.sql',
  '20260419202941': 'sql:recovered/add_seeking_match_at_timestamp.sql',
  '20260518211157': 'sql:recovered/league_matches_rls_policy_cleanup.sql',
  '20260518211655': 'sql:recovered/league_rls_app_aligned.sql',
  '20260518211706': 'sql:admin_security_phase3_rpc.sql',
  '20260518212037': 'sql:invisible_security_hardening.sql',
  '20260519095805': 'sql:phone_verification_exempt.sql',
  '20260519191902': 'sql:admin_pin_shorter_session.sql',
  '20260519193959': 'sql:_p3a.sql',
  '20260519194102': 'sql:admin_pin_guard.sql',
  '20260519194505': 'sql:admin_security_phase3_rpc.sql',
  '20260519194714': 'sql:recovered/admin_delete_user_audit.sql',
  '20260519194754': 'sql:recovered/admin_americano_pin_auth.sql',
  '20260519195659': 'sql:americano_rls_visibility.sql',
  '20260520084506': 'sql:recovered/phone_verification_exempt_hardening.sql',
  '20260520085148': 'sql:user_phone_verification_exempt_rpc.sql',
  '20260520091905': 'sql:phone_exempt_skip_onboarding.sql',
  '20260520120206': 'sql:recovered/notifications_suite.sql',
  '20260520120314': 'sql:recovered/notifications_suite_v2.sql',
  '20260520123829': 'sql:recovered/notifications_remaining_v2.sql',
  '20260521074215': 'sql:recovered/match_watch_discovery_schema.sql',
  '20260521074255': 'sql:recovered/match_watch_discovery_functions.sql',
  '20260521093418': 'migration:20260526120000_makker_search_filter.sql',
  '20260521094121': 'migration:20260523120000_match_search_filter.sql:1-35',
  '20260521094149': 'migration:20260524120000_match_filter_niveau.sql',
  '20260521094338': 'migration:20260524120000_match_filter_niveau.sql',
  '20260521100123': 'migration:20260527120000_makker_filter_v2.sql',
  '20260521100239': 'migration:20260527120000_makker_filter_v2.sql',
  '20260521100323': 'migration:20260527120000_makker_filter_v2.sql',
  '20260521104600': 'migration:20260528120000_makker_partner_court_side.sql',
  '20260521104656': 'migration:20260528120000_makker_partner_court_side.sql',
  '20260521105008': 'migration:20260528130000_makker_availability_flexible.sql',
  '20260521105328': 'migration:20260528140000_seeking_match_ttl_7_days.sql',
  '20260521105411': 'migration:20260528140000_seeking_match_ttl_7_days.sql',
  '20260521105835': 'migration:20260528150000_discovery_notification_limits_separate.sql',
  '20260521105911': 'migration:20260528150000_discovery_notification_limits_separate.sql',
  '20260521105936': 'migration:20260528150000_discovery_notification_limits_separate.sql',
  '20260521122527': 'migration:20260529120000_profiles_city_optional.sql',
};

function migrationNameFromFile(filename) {
  const version = filename.slice(0, 14);
  if (filename.includes('mcp_remote_history_sync')) {
    return VERSION_NAMES[version] || 'mcp_remote_history_sync';
  }
  const m = filename.match(/^\d{14}_(.+)\.sql$/);
  return m ? m[1] : filename;
}

function isStub(content) {
  return content.length < 500 && STUB_RE.test(content);
}

function readSource(spec) {
  const firstColon = spec.indexOf(':');
  const kind = spec.slice(0, firstColon);
  const rest = spec.slice(firstColon + 1);

  if (kind === 'sql') {
    const path = join(sqlDir, rest);
    if (!existsSync(path)) throw new Error(`Missing SQL source: ${rest}`);
    return readFileSync(path, 'utf8');
  }
  if (kind === 'migration') {
    const lastColon = rest.lastIndexOf(':');
    const hasRange = lastColon > 0 && /^\d+-\d+$/.test(rest.slice(lastColon + 1));
    const file = hasRange ? rest.slice(0, lastColon) : rest;
    const range = hasRange ? rest.slice(lastColon + 1) : null;
    const path = join(migrationsDir, file);
    if (!existsSync(path)) throw new Error(`Missing migration source: ${file}`);
    let text = readFileSync(path, 'utf8');
    if (range?.includes('-')) {
      const [fromS, toS] = range.split('-');
      const from = Math.max(1, parseInt(fromS, 10));
      const to = parseInt(toS, 10);
      text = text
        .split('\n')
        .slice(from - 1, to)
        .join('\n');
    }
    return text;
  }
  throw new Error(`Unknown source spec: ${spec}`);
}

function header(version, name, sourceSpec) {
  return `-- Migration ${version}_${name}
-- Backfilled from ${sourceSpec} (${new Date().toISOString().slice(0, 10)}).
-- Idempotent — safe on fresh DB rebuild and on prod (already applied).

`;
}

let filled = 0;
let skipped = 0;
let renamed = 0;
const errors = [];

for (const filename of readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort()) {
  const version = filename.slice(0, 14);
  const path = join(migrationsDir, filename);
  const content = readFileSync(path, 'utf8');

  if (!isStub(content)) {
    skipped++;
    continue;
  }

  const name = migrationNameFromFile(filename);
  const sourceSpec = SOURCE_BY_VERSION[version];
  if (!sourceSpec) {
    errors.push(`${filename}: no SOURCE_BY_VERSION entry`);
    continue;
  }

  try {
    const sql = readSource(sourceSpec);
    const out = header(version, name, sourceSpec) + sql.trimEnd() + '\n';

    if (dryRun) {
      console.log('[dry-run] would fill', filename, '<-', sourceSpec, `(${sql.length} chars)`);
    } else {
      writeFileSync(path, out);
      console.log('filled', filename, '<-', sourceSpec);
    }
    filled++;

    if (renameMcp && filename.includes('mcp_remote_history_sync') && name !== 'mcp_remote_history_sync') {
      const target = `${version}_${name}.sql`;
      const targetPath = join(migrationsDir, target);
      if (target !== filename && !existsSync(targetPath)) {
        if (dryRun) {
          console.log('[dry-run] would rename', filename, '->', target);
        } else {
          renameSync(path, targetPath);
          console.log('renamed', filename, '->', target);
        }
        renamed++;
      }
    }
  } catch (err) {
    errors.push(`${filename}: ${err.message}`);
  }
}

console.log(`\nDone: ${filled} filled, ${skipped} already full, ${renamed} renamed`);
if (errors.length) {
  console.error('\nErrors:');
  for (const e of errors) console.error(' ', e);
  process.exit(1);
}
