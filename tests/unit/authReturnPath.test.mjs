import test from 'node:test';
import assert from 'node:assert/strict';
import {
  sanitizeAuthReturnPath,
  authReturnSignupUrl,
  mapAuthReturnToDashboardPath,
} from '../../src/lib/authReturnPath.js';

const MATCH_ID = '11111111-1111-1111-1111-111111111111';
const TOURNAMENT_ID = '22222222-2222-2222-2222-222222222222';

test('sanitizeAuthReturnPath accepts public share and dashboard kampe paths', () => {
  assert.equal(sanitizeAuthReturnPath(`/kamp/${MATCH_ID}`), `/kamp/${MATCH_ID}`);
  assert.equal(sanitizeAuthReturnPath(`/turnering/${TOURNAMENT_ID}`), `/turnering/${TOURNAMENT_ID}`);
  assert.equal(sanitizeAuthReturnPath(`/dashboard/kampe/2v2/${MATCH_ID}`), `/dashboard/kampe/2v2/${MATCH_ID}`);
  assert.equal(sanitizeAuthReturnPath('https://evil.test/kamp/x'), null);
  assert.equal(sanitizeAuthReturnPath('/admin'), null);
});

test('authReturnSignupUrl encodes safe next param', () => {
  assert.equal(authReturnSignupUrl(`/kamp/${MATCH_ID}`), `/opret?next=${encodeURIComponent(`/kamp/${MATCH_ID}`)}`);
  assert.equal(authReturnSignupUrl('/evil'), '/opret');
});

test('mapAuthReturnToDashboardPath maps public paths to dashboard detail routes', () => {
  assert.equal(mapAuthReturnToDashboardPath(`/kamp/${MATCH_ID}`), `/dashboard/kampe/2v2/${MATCH_ID}`);
  assert.equal(mapAuthReturnToDashboardPath(`/turnering/${TOURNAMENT_ID}`), `/dashboard/kampe/americano/${TOURNAMENT_ID}`);
  assert.equal(mapAuthReturnToDashboardPath('/unknown'), '/dashboard/hjem');
});
