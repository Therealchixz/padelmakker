import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { shouldCreateProfileOnFetchStatus } from '../../src/lib/profileBootstrapPolicy.js';

const dir = dirname(fileURLToPath(import.meta.url));
const read = (rel) => readFileSync(join(dir, rel), 'utf8');

test('shouldCreateProfileOnFetchStatus only for missing', () => {
  assert.equal(shouldCreateProfileOnFetchStatus('missing'), true);
  assert.equal(shouldCreateProfileOnFetchStatus('ok'), false);
  assert.equal(shouldCreateProfileOnFetchStatus('error'), false);
  assert.equal(shouldCreateProfileOnFetchStatus('timeout'), false);
});

test('profileBootstrap only creates after confirmed missing', () => {
  const src = read('../../src/lib/profileBootstrap.js');
  assert.match(src, /shouldCreateProfileOnFetchStatus\(timed\.status\)/);
  assert.match(src, /createProfileForNewUser/);
  assert.match(src, /status: 'error'/);
  assert.match(src, /status: 'timeout'/);
  const loadFn = src.slice(src.indexOf('export async function loadOrCreateProfileResult'));
  const gateIdx = loadFn.indexOf('shouldCreateProfileOnFetchStatus(timed.status)');
  const createIdx = loadFn.indexOf('await createProfileForNewUser');
  assert.ok(gateIdx >= 0 && createIdx > gateIdx);
});

test('AuthContext uses loadOrCreateProfileResult (no blind upsert)', () => {
  const auth = read('../../src/lib/AuthContext.jsx');
  assert.match(auth, /loadOrCreateProfileResult/);
  assert.doesNotMatch(auth, /fetchProfileFast/);
  assert.match(auth, /setProfileLoadError\(true\)/);
});
