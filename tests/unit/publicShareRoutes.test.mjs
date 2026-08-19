import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPublicMatchPath, buildPublicTournamentPath } from '../../src/lib/publicShareRoutes.js';

test('buildPublicMatchPath and buildPublicTournamentPath encode ids', () => {
  assert.equal(buildPublicMatchPath('abc'), '/kamp/abc');
  assert.equal(buildPublicTournamentPath('t1'), '/turnering/t1');
  assert.equal(buildPublicMatchPath('a/b'), '/kamp/a%2Fb');
});
