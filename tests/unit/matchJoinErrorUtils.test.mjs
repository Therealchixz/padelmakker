import test from 'node:test';
import assert from 'node:assert/strict';
import { mapKickMatchError } from '../../src/lib/matchJoinErrorUtils.js';

test('mapKickMatchError maps known RPC codes', () => {
  assert.equal(mapKickMatchError({ error: 'not_allowed' }, null), 'Kun opretteren eller en admin kan fjerne spillere.');
  assert.equal(mapKickMatchError({ error: 'cannot_kick_self' }, null), 'Du kan ikke fjerne dig selv — forlad kampen i stedet.');
  assert.equal(mapKickMatchError({ error: 'match_locked' }, null), 'Du kan ikke fjerne spillere fra en kamp der er i gang eller afsluttet.');
  assert.equal(mapKickMatchError({ error: 'not_in_match' }, null), 'Spilleren er ikke tilmeldt denne kamp.');
});

test('mapKickMatchError returns null on success', () => {
  assert.equal(mapKickMatchError({ success: true }, null), null);
});

test('mapKickMatchError uses transport error message', () => {
  assert.equal(mapKickMatchError(null, { message: 'network down' }), 'network down');
});
