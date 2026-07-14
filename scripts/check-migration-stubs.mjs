/**
 * Fail CI if migration files are still empty history-sync stubs.
 *
 *   node scripts/check-migration-stubs.mjs
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'supabase', 'migrations');
const STUB_RE =
  /history sync stub|already applied on production|applied on prod via dashboard/i;

const stubs = [];

for (const f of readdirSync(migrationsDir).filter((x) => x.endsWith('.sql'))) {
  const text = readFileSync(join(migrationsDir, f), 'utf8');
  if (text.length < 500 && STUB_RE.test(text)) {
    stubs.push(f);
  }
}

if (stubs.length) {
  console.error(`Found ${stubs.length} empty migration stub(s):`);
  for (const s of stubs) console.error(`  - ${s}`);
  console.error('\nRun: node scripts/backfill-migration-stubs.mjs');
  process.exit(1);
}

console.log('OK: no empty migration stubs.');
