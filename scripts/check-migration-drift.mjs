/**
 * Compare supabase/migrations/*.sql with remote schema_migrations.
 * Requires SUPABASE_ACCESS_TOKEN (same as GitHub Actions secret).
 *
 *   node scripts/check-migration-drift.mjs
 *   node scripts/check-migration-drift.mjs --repair-hint
 */
import { readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const migrationsDir = join(root, 'supabase', 'migrations');
const projectRef = process.env.SUPABASE_PROJECT_REF || 'hzmrsqrerkoftcppfklu';
const token = process.env.SUPABASE_ACCESS_TOKEN;

function localVersions() {
  return readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .map((f) => f.slice(0, 14))
    .sort();
}

async function remoteVersions() {
  if (!token) {
    console.error('Missing SUPABASE_ACCESS_TOKEN — cannot compare with prod.');
    process.exit(1);
  }

  const res = await fetch(
    `https://api.supabase.com/v1/projects/${projectRef}/database/migrations`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    },
  );

  if (!res.ok) {
    const body = await res.text();
    console.error(`Management API ${res.status}: ${body.slice(0, 500)}`);
    process.exit(1);
  }

  const data = await res.json();
  const rows = Array.isArray(data) ? data : data.migrations || [];
  return rows
    .map((m) => String(m.version || m).slice(0, 14))
    .filter(Boolean)
    .sort();
}

const local = localVersions();
const remote = await remoteVersions();
const remoteSet = new Set(remote);
const localSet = new Set(local);

const onlyLocal = local.filter((v) => !remoteSet.has(v));
const onlyRemote = remote.filter((v) => !localSet.has(v));

console.log(`Local migrations:  ${local.length}`);
console.log(`Remote migrations: ${remote.length}`);

if (onlyRemote.length) {
  console.warn('\nOn prod but missing locally (run sync-remote-migration-stubs.mjs):');
  for (const v of onlyRemote) console.warn(`  - ${v}`);
}

if (onlyLocal.length) {
  console.error('\nIn repo but NOT on prod (db push / Supabase Preview will try these):');
  for (const v of onlyLocal) {
    const file = readdirSync(migrationsDir).find((f) => f.startsWith(v));
    console.error(`  - ${file}`);
  }
  if (process.argv.includes('--repair-hint')) {
    console.error(
      '\nFix: apply SQL on prod (MCP apply_migration or CI db push), then re-run this script.',
    );
  }
  process.exit(1);
}

console.log('\nOK: local migration versions match prod history.');
