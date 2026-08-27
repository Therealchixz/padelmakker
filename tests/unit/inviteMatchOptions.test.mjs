import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mapInviteMatchOptions } from '../../src/lib/inviteMatchOptionsMap.js';

test('mapInviteMatchOptions dropper passerede kampe og mærker typen', () => {
  const items = mapInviteMatchOptions(
    [
      { id: 'old', date: '2026-01-01', court_name: 'Gammel' },
      { id: 'new', date: '2026-09-01', court_name: 'Ny' },
    ],
    [{ id: 'am', tournament_date: '2026-09-02', name: 'Americano' }],
    '2026-08-27',
  );
  assert.equal(items.length, 2);
  assert.equal(items[0]._type, 'match');
  assert.equal(items[0].id, 'new');
  assert.equal(items[1]._type, 'americano');
});

test('invite fra profil lukker ikke profilen og prefetch kampene', () => {
  const tab = readFileSync('src/dashboard/MakkereTab.jsx', 'utf8');
  assert.match(tab, /onInviteMatch=\{\(\) => setInviteTarget\(viewPlayer\)\}/);
  assert.doesNotMatch(tab, /setViewPlayer\(null\);\s*setInviteTarget/);
  assert.match(tab, /loadInviteMatchOptions\(user\.id\)/);
  assert.match(tab, /open=\{\!\!inviteTarget\}/);
  assert.match(tab, /closeOnEscape=\{\!inviteTarget\}/);
  const modal = readFileSync('src/dashboard/InviteToMatchModal.jsx', 'utf8');
  assert.match(modal, /zIndex=\{1200\}/);
  assert.doesNotMatch(modal, /Henter dine kampe/);
  assert.match(modal, /getCachedInviteMatchOptions/);
  assert.match(modal, /if \(!open \|\| !invitee \|\| !currentUser\) return null;/);
});
