import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = dirname(fileURLToPath(import.meta.url));
const read = (rel) => readFileSync(join(dir, rel), 'utf8');

test('PROFILE_SAFE_SELECT excludes email', () => {
  const src = read('../../src/lib/profileQueries.js');
  assert.match(src, /export const PROFILE_SAFE_SELECT/);
  assert.match(src, /MATCH_PLAYERS_SAFE_SELECT/);
  assert.match(src, /fetchAdminProfilesWithEmailMap/);
  // The joined string must not list email as a selected column.
  const safeBlock = src.slice(
    src.indexOf('export const PROFILE_SAFE_SELECT'),
    src.indexOf('export const PROFILE_MAKKERE_SELECT'),
  );
  assert.doesNotMatch(safeBlock, /['"]email['"]/);
  const mpBlock = src.slice(
    src.indexOf('export const MATCH_PLAYERS_SAFE_SELECT'),
    src.indexOf('export async function fetchMakkerePlayerProfiles'),
  );
  assert.doesNotMatch(mpBlock, /user_email/);
});

test('AuthContext uses PROFILE_SAFE_SELECT', () => {
  const auth = read('../../src/lib/AuthContext.jsx');
  assert.match(auth, /PROFILE_SAFE_SELECT/);
  assert.doesNotMatch(auth, /\.select\('\*'\)/);
});

test('PII lockdown SQL uses column grants not only REVOKE column', () => {
  const sql = read('../../supabase/sql/pentest_pii_lockdown.sql');
  assert.match(sql, /REVOKE SELECT ON TABLE public\.profiles/);
  assert.match(sql, /GRANT SELECT \(/);
  assert.match(sql, /admin_profiles_with_email/);
  assert.doesNotMatch(sql, /GRANT SELECT \(\s*[^)]*email/i);
});
