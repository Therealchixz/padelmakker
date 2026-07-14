/**
 * Static + prod-smoke validation for backfilled migrations.
 *
 *   node scripts/test-migration-integrity.mjs
 *   node scripts/test-migration-integrity.mjs --smoke   # also query prod via Management API
 *
 * Full replay from empty DB requires Docker (`supabase db reset`) or Supabase Pro branching.
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const migrationsDir = join(root, 'supabase', 'migrations');
const sqlDir = join(root, 'supabase', 'sql');

const STUB_RE =
  /history sync stub|already applied on production|applied on prod via dashboard/i;
const MIN_BYTES = 200;

/** Keep in sync with scripts/backfill-migration-stubs.mjs SOURCE_BY_VERSION keys. */
const BACKFILLED_VERSIONS = new Set([
  '20260416123610', '20260416125447', '20260416130533', '20260416133704',
  '20260416134508', '20260416135303', '20260416140959', '20260416172316',
  '20260416180550', '20260416220821', '20260416222435', '20260417102106',
  '20260417103431', '20260417104121', '20260417121717', '20260419202941',
  '20260518211157', '20260518211655', '20260518211706', '20260518212037',
  '20260519095805', '20260519191902', '20260519193959', '20260519194102',
  '20260519194505', '20260519194714', '20260519194754', '20260519195659',
  '20260520084506', '20260520085148', '20260520091905', '20260520120206',
  '20260520120314', '20260520123829', '20260521074215', '20260521074255',
  '20260521093418', '20260521094121', '20260521094149', '20260521094338',
  '20260521100123', '20260521100239', '20260521100323', '20260521104600',
  '20260521104656', '20260521105008', '20260521105328', '20260521105411',
  '20260521105835', '20260521105911', '20260521105936', '20260521122527',
]);

const PROD_SMOKE = [
  {
    name: 'league_teams table',
    sql: `SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema='public' AND table_name='league_teams'
    ) AS ok`,
  },
  {
    name: 'notify_league_invite(uuid,uuid,text,text)',
    sql: `SELECT EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='public' AND p.proname='notify_league_invite'
        AND pg_get_function_identity_arguments(p.oid) LIKE '%uuid, uuid, text, text%'
    ) AS ok`,
  },
  {
    name: 'profiles.match_watch_enabled',
    sql: `SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='profiles' AND column_name='match_watch_enabled'
    ) AS ok`,
  },
  {
    name: 'join_open_match RPC',
    sql: `SELECT EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='public' AND p.proname='join_open_match'
    ) AS ok`,
  },
  {
    name: 'messages REPLICA IDENTITY FULL',
    sql: `SELECT relreplident = 'f' AS ok
      FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relname='messages'`,
  },
];

function fail(msg) {
  console.error('FAIL:', msg);
  process.exitCode = 1;
}

function ok(msg) {
  console.log('OK:', msg);
}

const files = readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();
const versions = new Map();
const stubs = [];
const thin = [];

for (const f of files) {
  const v = f.slice(0, 14);
  if (versions.has(v)) fail(`duplicate version ${v}: ${versions.get(v)} + ${f}`);
  versions.set(v, f);

  const text = readFileSync(join(migrationsDir, f), 'utf8');
  if (text.length < MIN_BYTES && STUB_RE.test(text)) stubs.push(f);
  else if (text.length < MIN_BYTES) thin.push(f);

  if (BACKFILLED_VERSIONS.has(v) && STUB_RE.test(text)) {
    fail(`backfilled version still stub: ${f}`);
  }
}

if (stubs.length) fail(`${stubs.length} stub(s): ${stubs.join(', ')}`);
else ok(`${files.length} migration files, no empty stubs`);

if (thin.length) {
  console.warn('WARN: very short migrations (may be intentional):', thin.join(', '));
}

for (const v of BACKFILLED_VERSIONS) {
  if (!versions.has(v)) fail(`missing backfilled migration version ${v}`);
}
ok(`all ${BACKFILLED_VERSIONS.size} backfilled versions present`);

const recoveredDir = join(sqlDir, 'recovered');
if (!existsSync(recoveredDir)) fail('missing supabase/sql/recovered/');
else {
  const recovered = readdirSync(recoveredDir).filter((f) => f.endsWith('.sql'));
  ok(`${recovered.length} recovered SQL reference files`);
}

if (process.argv.includes('--smoke')) {
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  const projectRef = process.env.SUPABASE_PROJECT_REF || 'hzmrsqrerkoftcppfklu';
  if (!token) {
    console.warn('SKIP prod smoke: set SUPABASE_ACCESS_TOKEN to run --smoke');
  } else {
    console.log('\nProd smoke checks (via Management API SQL)...');
    for (const check of PROD_SMOKE) {
      const res = await fetch(
        `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ query: check.sql }),
        },
      );
      if (!res.ok) {
        fail(`${check.name}: API ${res.status} ${(await res.text()).slice(0, 200)}`);
        continue;
      }
      const rows = await res.json();
      const row = Array.isArray(rows) ? rows[0] : rows?.result?.[0] ?? rows;
      const passed = row?.ok === true || row?.ok === 't';
      if (passed) ok(`prod: ${check.name}`);
      else fail(`prod: ${check.name} — not found on live DB`);
    }
  }
}

if (process.exitCode) {
  console.error('\nMigration integrity check failed.');
  process.exit(process.exitCode);
}

console.log('\nMigration integrity check passed.');
console.log(
  'Note: full empty-DB replay needs Docker (supabase start && supabase db reset) or Supabase Pro preview branch.',
);
