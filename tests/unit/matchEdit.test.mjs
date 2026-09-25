/**
 * Ret en oprettet kamp: bane, dato og tid (ejeren 25. sep. 2026).
 *
 * update_match_details er afprøvet mod databasen i en tilbagerullet
 * transaktion: en anden spiller blev afvist, et passeret tidspunkt blev
 * afvist, opretteren kunne flytte kampen og vælge Skansen Padel som booket,
 * og niveauet (elo:933-960) blev bevaret.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildMatchEditPatch,
  canEditMatch,
  initialMatchEditForm,
  matchEditChatMessage,
  matchEditNotificationBody,
} from '../../src/lib/matchEdit.js';
import { MATCH_VENUE_CUSTOM, MATCH_VENUE_TBD } from '../../src/lib/matchVenueOptions.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const read = (rel) => readFileSync(join(root, rel), 'utf8');
const migration = () => {
  const dir = join(root, 'supabase/migrations');
  const f = readdirSync(dir).filter((x) => x.endsWith('_update_match_details.sql')).pop();
  assert.ok(f, 'mangler migration *_update_match_details.sql');
  return readFileSync(join(dir, f), 'utf8');
};

const VENUES = [
  { id: 'court-1', label: 'Skansen Padel', courtId: 'court-1' },
  { id: 'pm_venue:x', label: 'Padel Lounge', courtId: null },
];
const MATCH = {
  id: 'm1', date: '2026-09-30', time: '19:00', time_end: '21:00',
  court_id: null, court_name: '', level_range: 'elo:933-960|booked:no',
};
const NOW = new Date(2026, 8, 25, 12, 0);

test('kun opretteren, og kun før kampen er startet', () => {
  assert.equal(canEditMatch({ isCreator: true, status: 'open' }), true);
  assert.equal(canEditMatch({ isCreator: true, status: 'full' }), true);
  assert.equal(canEditMatch({ isCreator: true, status: 'in_progress' }), false);
  assert.equal(canEditMatch({ isCreator: false, status: 'open' }), false);
});

test('formularen starter med kampens værdier', () => {
  assert.deepEqual(initialMatchEditForm(MATCH, VENUES), {
    venue: MATCH_VENUE_TBD, custom_court: '', date: '2026-09-30', time: '19:00', duration: '120',
  });
  const booked = initialMatchEditForm({ ...MATCH, court_id: 'court-1', level_range: 'elo:1-2|booked:yes' }, VENUES);
  assert.equal(booked.venue, 'court-1');
  // Et banenavn, der ikke er på listen, åbnes som "Anden bane – skriv selv".
  const custom = initialMatchEditForm({ ...MATCH, court_name: 'Padelhallen Køge' }, VENUES);
  assert.equal(custom.venue, MATCH_VENUE_CUSTOM);
  assert.equal(custom.custom_court, 'Padelhallen Køge');
});

test('bane fundet: vælg center og booket, flyt tiden', () => {
  const { patch, error } = buildMatchEditPatch(
    { venue: 'court-1', custom_court: '', date: '2026-10-01', time: '20:00', duration: '90' },
    MATCH, VENUES, NOW,
  );
  assert.equal(error, '');
  assert.deepEqual(patch, {
    date: '2026-10-01', time: '20:00', time_end: '21:30',
    court_id: 'court-1', court_name: 'Skansen Padel', court_booked: true,
  });
  assert.equal(matchEditChatMessage(patch), '📅 Kampen er ændret: torsdag 1. okt kl. 20:00–21:30 · Skansen Padel (booket)');
});

test('ingen "Har du booket?": valgt bane = booket, "Ikke valgt endnu" = ikke booket', () => {
  const tbd = buildMatchEditPatch({ ...initialMatchEditForm(MATCH, VENUES), time: '20:00' }, MATCH, VENUES, NOW);
  assert.equal(tbd.patch.court_booked, false);
  assert.equal(tbd.patch.court_name, '');
  const modal = read('src/components/kampe/EditMatchModal.jsx');
  assert.doesNotMatch(modal, /Har du booket/);
  assert.match(modal, /CUSTOM_VENUE_OPTION/);
});

test('"Anden bane – skriv selv": navnet gemmes uden court_id', () => {
  const { patch } = buildMatchEditPatch(
    { venue: MATCH_VENUE_CUSTOM, custom_court: '  Padelhallen   Køge ', date: '2026-10-01', time: '19:00', duration: '120' },
    MATCH, VENUES, NOW,
  );
  assert.deepEqual(patch, {
    date: '2026-10-01', time: '19:00', time_end: '21:00',
    court_id: null, court_name: 'Padelhallen Køge', court_booked: true,
  });
  const empty = buildMatchEditPatch({ ...initialMatchEditForm(MATCH, VENUES), venue: MATCH_VENUE_CUSTOM }, MATCH, VENUES, NOW);
  assert.match(empty.error, /navnet på banen/);
});

test('opret kamp: "Anden bane – skriv selv" findes også dér', () => {
  const k = read('src/dashboard/KampeTab.jsx');
  assert.match(k, /CUSTOM_VENUE_OPTION,\s*\.\.\.venueOptions/);
  assert.match(k, /cleanCustomCourtName\(newMatch\.custom_court\)/);
  assert.match(read('src/components/kampe/CreateMatchForm.jsx'), /isMatchVenueCustom\(newMatch\.court_id\)/);
});

test('afviser fortid og "ingen ændringer"', () => {
  const past = buildMatchEditPatch({ ...initialMatchEditForm(MATCH, VENUES), date: '2026-09-24' }, MATCH, VENUES, NOW);
  assert.equal(past.patch, null);
  assert.match(past.error, /passeret/);
  const same = buildMatchEditPatch(initialMatchEditForm(MATCH, VENUES), MATCH, VENUES, NOW);
  assert.match(same.error, /ikke ændret/);
});

test('databasen: kun opretter, kun åben/fuld, ikke fortid, niveau bevares', () => {
  const sql = migration();
  assert.match(sql, /SECURITY DEFINER/);
  assert.match(sql, /v_m\.creator_id IS DISTINCT FROM v_uid AND NOT public\.is_admin\(\)/);
  assert.match(sql, /NOT IN \('open', 'full'\)/);
  assert.match(sql, /AT TIME ZONE 'Europe\/Copenhagen'\) < now\(\)/);
  assert.match(sql, /regexp_replace\(v_level, 'booked:\(yes\|no\)'/);
  assert.match(sql, /REVOKE ALL ON FUNCTION public\.update_match_details\([^)]*\) FROM PUBLIC, anon;/);
});

test('appen gemmer via update_match_details og skriver i kamp-chatten', () => {
  const k = read('src/dashboard/KampeTab.jsx');
  assert.match(k, /supabase\.rpc\("update_match_details"/);
  assert.match(k, /matchEditChatMessage\(patch\)/);
  assert.match(k, /Ret bane, dato og tid/);
});

test('de andre får deres egen notifikation "Kampen er ændret" (ikke en stille chat-push)', () => {
  // Ejeren 25. sep. 2026: en chat-besked kan hurtigt blive væk.
  const k = read('src/dashboard/KampeTab.jsx');
  const fn = k.slice(k.indexOf('const saveMatchEdit = async'), k.indexOf('const submitMatchChat = async'));
  assert.match(fn, /"match_updated",\s*"Kampen er ændret 📅"/);
  assert.doesNotMatch(fn, /notifyMatchChatParticipants/);
  for (const f of ['supabase/functions/send-push/index.ts', 'src/lib/notificationPolicy.js']) {
    const src = read(f);
    const block = src.slice(src.indexOf('match_updated: {'), src.indexOf('match_updated: {') + 200);
    assert.match(block, /channel: "kampe"/, f);
    assert.match(block, /silent: false/, f);
  }
  assert.match(read('src/lib/kampeNotificationTypes.js'), /'match_updated'/);
  assert.equal(
    matchEditNotificationBody({ date: '2026-10-01', time: '20:00', time_end: '21:30', court_name: 'Skansen Padel', court_booked: true }, 'Mike Pedersen'),
    'Mike har ændret kampen: torsdag 1. okt kl. 20:00–21:30 · Skansen Padel (booket)',
  );
});
