import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  courtSideLabel,
  normalizeMatchCourtSide,
  oppositeCourtSide,
  sortPlayersByCourtSide,
  teamSlotsBySide,
} from '../../src/lib/matchPlayerCourtSide.js';

test('normalizeMatchCourtSide forstår left/right og dansk', () => {
  assert.equal(normalizeMatchCourtSide('left'), 'left');
  assert.equal(normalizeMatchCourtSide('Venstre'), 'left');
  assert.equal(normalizeMatchCourtSide('højre'), 'right');
  assert.equal(normalizeMatchCourtSide('hojre'), 'right');
  assert.equal(normalizeMatchCourtSide(''), null);
});

test('teamSlotsBySide lægger spillere på venstre og højre', () => {
  const slots = teamSlotsBySide([
    { user_id: 'a', court_side: 'right', user_name: 'A' },
    { user_id: 'b', court_side: 'left', user_name: 'B' },
  ]);
  assert.equal(slots[0].side, 'left');
  assert.equal(slots[0].player.user_id, 'b');
  assert.equal(slots[1].side, 'right');
  assert.equal(slots[1].player.user_id, 'a');
  assert.equal(courtSideLabel(slots[0].side), 'Venstre');
  assert.equal(oppositeCourtSide('left'), 'right');
});

test('teamSlotsBySide fylder ledige pladser hvis side mangler', () => {
  const slots = teamSlotsBySide([
    { user_id: 'x', user_name: 'X' },
  ]);
  assert.equal(slots[0].player.user_id, 'x');
  assert.equal(slots[1].player, null);
});

test('sortPlayersByCourtSide har venstre først', () => {
  const sorted = sortPlayersByCourtSide([
    { user_id: 'r', court_side: 'right' },
    { user_id: 'l', court_side: 'left' },
  ]);
  assert.equal(sorted[0].user_id, 'l');
  assert.equal(sorted[1].user_id, 'r');
});

test('kampdetalje viser side uden at ændre slot-layoutet', () => {
  const view = readFileSync('src/components/kampe/MatchCourtView.jsx', 'utf8');
  assert.match(view, /courtSideLabel/);
  assert.match(view, /onSetCourtSide/);
  assert.doesNotMatch(view, /pm-kd-side-row/);
  assert.doesNotMatch(view, /Byt side/);
  const modal = readFileSync('src/dashboard/TeamSelectModal.jsx', 'utf8');
  assert.match(modal, /Vælg hold/);
  assert.doesNotMatch(modal, /Vælg hold og side/);
});
