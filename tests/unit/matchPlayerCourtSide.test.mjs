import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  courtSideLabel,
  freeMatchCourtSides,
  normalizeMatchCourtSide,
  oppositeCourtSide,
  sortPlayersByCourtSide,
  teamPlayerNameWithSide,
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

test('teamPlayerNameWithSide viser valgt side ved navnet', () => {
  assert.equal(teamPlayerNameWithSide({ user_name: 'KENNETH SOERENSEN', court_side: 'left' }), 'Kenneth · Venstre');
  assert.equal(teamPlayerNameWithSide({ user_name: 'Anna', court_side: 'højre' }), 'Anna · Højre');
  assert.equal(teamPlayerNameWithSide({ user_name: 'Bo' }), 'Bo');
});

test('freeMatchCourtSides er begge når holdet er tomt', () => {
  assert.deepEqual(freeMatchCourtSides([]), ['left', 'right']);
  assert.deepEqual(freeMatchCourtSides([{ court_side: 'left' }]), ['right']);
  assert.deepEqual(freeMatchCourtSides([{ court_side: 'right' }, { court_side: 'left' }]), []);
});

test('kampdetalje viser side uden at ændre slot-layoutet', () => {
  const view = readFileSync('src/components/kampe/MatchCourtView.jsx', 'utf8');
  assert.match(view, /pm-kd-slot/);
  assert.match(view, /courtSideLabel/);
  assert.match(view, /onSetCourtSide/);
  assert.doesNotMatch(view, /pm-kd-side-row/);
  assert.doesNotMatch(view, /pm-court--detail/);
  assert.doesNotMatch(view, /Byt side/);
  const modal = readFileSync('src/dashboard/TeamSelectModal.jsx', 'utf8');
  assert.match(modal, /Vælg hold/);
  assert.match(modal, /Vælg side/);
  assert.match(modal, /teamPlayerNameWithSide/);
  assert.doesNotMatch(modal, /Vælg hold og side/);
});

test('kampdetalje bundkort har chat, del, kalender og afmeld', () => {
  const tab = readFileSync('src/dashboard/KampeTab.jsx', 'utf8');
  assert.match(tab, /MatchDetailActionCard/);
  assert.match(tab, /openCalendarInvite/);
  const calendar = readFileSync('src/lib/calendarExport.js', 'utf8');
  assert.match(calendar, /\/kamp\.ics/);
  assert.doesNotMatch(calendar, /navigator\.share/);
  assert.doesNotMatch(calendar, /data:text\/calendar/);
  const card = readFileSync('src/components/kampe/MatchDetailActionCard.jsx', 'utf8');
  assert.match(card, /Match chat/);
  assert.doesNotMatch(card, /formatMatchChatPreview/);
  assert.doesNotMatch(card, /Ingen beskeder endnu/);
  assert.match(card, /Du er tilmeldt/);
  assert.match(card, /Del kamp/);
  assert.match(card, /Tilføj kalender/);
  assert.match(card, /Afmeld mig/);
  const css = readFileSync('src/styles/kampdetalje.css', 'utf8');
  assert.match(css, /\.pm-kd-action-leave \{[\s\S]*?padding: 10px 16px;/);
  const layout = readFileSync('src/responsive.css', 'utf8');
  assert.match(layout, /dash-main har allerede safe-area/);
  assert.match(layout, /\.pm-kampe-v2-detail-page \.pm-kampe-v2-detail-scroll[\s\S]*?padding-bottom: 8px;/);
});

test('tilmelding vælger ledig bane-side og fanger unique på (kamp, bruger)', () => {
  const join = readFileSync('supabase/sql/join_open_match_rpc.sql', 'utf8');
  assert.match(join, /match_players_free_court_side/);
  assert.match(join, /p_court_side text DEFAULT NULL/);
  assert.match(join, /ON CONFLICT ON CONSTRAINT match_players_match_id_user_id_key DO NOTHING/);
  assert.match(join, /WHEN unique_violation THEN/);
  const fix = readFileSync('supabase/sql/match_player_court_side_join_fix.sql', 'utf8');
  assert.match(fix, /DROP CONSTRAINT IF EXISTS match_players_unique_team_side/);
  assert.match(fix, /WHERE court_side IS NOT NULL/);
  assert.doesNotMatch(fix, /SET CONSTRAINTS match_players_unique_team_side DEFERRED/);
});
