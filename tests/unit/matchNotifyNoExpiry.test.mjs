/**
 * "Besked om nye kampe" skal vare, til brugeren selv slår den fra.
 *
 * Serveren (notify_match_watchers) sender til alle med match_watch_enabled uden
 * udløb, men appen slog den selv fra efter 24 timer, fordi kamp-switchen både
 * styrede synlighed (udløber) og besked. Nu er de adskilt.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  buildExpiredSeekingSyncPatch,
  buildMatchNotifyPatch,
  isMatchNotifyOn,
} from '../../src/lib/activeSeeking.js';

const DAY = 24 * 60 * 60 * 1000;
const base = {
  id: 'u1',
  area: 'Region Nordjylland',
  level: 3.2,
  elo_rating: 1000,
  makker_search_prefs: {},
};

test('udløbet kamp-synlighed slår IKKE besked om nye kampe fra', () => {
  const since = new Date(Date.now() - 2 * DAY).toISOString();
  const user = {
    ...base,
    match_watch_enabled: true,
    seeking_match: true,
    seeking_match_at: since,
    match_search_prefs: { notify: true, feedVisible: true, feedVisibleSince: since, region: 'Region Nordjylland' },
  };
  const patch = buildExpiredSeekingSyncPatch(user);
  assert.ok(patch, 'udløbet synlighed skal stadig ryddes op');
  assert.equal(patch.seeking_match, false);
  assert.equal(patch.match_search_prefs.feedVisible, false);
  assert.equal(patch.match_watch_enabled, true);
  assert.equal(patch.match_search_prefs.notify, true);
});

test('besked om nye kampe følger serverens kolonne', () => {
  assert.equal(isMatchNotifyOn({ ...base, match_watch_enabled: true, match_search_prefs: { notify: false, region: 'x' } }), true);
  assert.equal(isMatchNotifyOn({ ...base, match_watch_enabled: false }), false);
});

test('switchen slår kun besked til/fra og rører ikke synligheden', () => {
  const user = { ...base, match_watch_enabled: false, seeking_match: false, match_search_prefs: {} };
  const on = buildMatchNotifyPatch(user, true);
  assert.equal(on.match_watch_enabled, true);
  assert.equal(on.match_search_prefs.notify, true);
  assert.equal(on.seeking_match, false);
  assert.ok(on.match_watch_at, 'tidspunktet for brugerens valg gemmes');

  const off = buildMatchNotifyPatch({ ...user, ...on }, false);
  assert.equal(off.match_watch_enabled, false);
  assert.equal(off.match_search_prefs.notify, false);
});

test('Kampe viser "Jeg vil spille" og en ren besked-switch', async () => {
  const kampe = await readFile(new URL('../../src/dashboard/KampeTab.jsx', import.meta.url), 'utf8');
  assert.match(kampe, /<PlayIntentPanel/);
  const panel = await readFile(new URL('../../src/components/ActiveSeekingPanel.jsx', import.meta.url), 'utf8');
  assert.match(panel, /buildMatchNotifyPatch/);
  assert.match(panel, /isMatchNotifyOn\(displayUser\)/);
});
