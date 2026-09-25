/**
 * Ret en Americano/Mexicano: bane, dato og tid (ejeren 25. sep. 2026:
 * "Jeg kan stadigvæk ikke ændre det under americano").
 *
 * update_americano_details er afprøvet mod databasen i en tilbagerullet
 * transaktion: en anden bruger blev afvist, et passeret tidspunkt blev
 * afvist, og opretteren kunne flytte turneringen og skrive "Padelhallen Køge"
 * (gemt i court_name, uden court_id).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildTournamentEditPatch,
  canEditTournament,
  initialTournamentEditForm,
  tournamentEditChatMessage,
  tournamentEditNotificationBody,
} from '../../src/lib/americanoEdit.js';
import { MATCH_VENUE_CUSTOM, MATCH_VENUE_TBD } from '../../src/lib/matchVenueOptions.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const read = (rel) => readFileSync(join(root, rel), 'utf8');
const migration = () => {
  const dir = join(root, 'supabase/migrations');
  const f = readdirSync(dir).filter((x) => x.endsWith('_americano_edit_details.sql')).pop();
  assert.ok(f, 'mangler migration *_americano_edit_details.sql');
  return readFileSync(join(dir, f), 'utf8');
};

const VENUES = [{ id: 'court-1', label: 'Skansen Padel', courtId: 'court-1' }];
const T = { id: 't1', tournament_date: '2026-10-01', time_slot: '18:00', duration_minutes: 120, court_id: null, court_name: null, status: 'registration' };
const NOW = new Date(2026, 8, 25, 12, 0);

test('kun opretteren, og kun mens tilmeldingen er åben', () => {
  assert.equal(canEditTournament({ isCreator: true, status: 'registration' }), true);
  assert.equal(canEditTournament({ isCreator: true, status: 'playing' }), false);
  assert.equal(canEditTournament({ isCreator: false, status: 'registration' }), false);
});

test('formularen starter med turneringens værdier', () => {
  assert.deepEqual(initialTournamentEditForm(T, VENUES), {
    venue: MATCH_VENUE_TBD, custom_court: '', date: '2026-10-01', time: '18:00', duration: '120',
  });
  assert.equal(initialTournamentEditForm({ ...T, court_id: 'court-1' }, VENUES).venue, 'court-1');
  const custom = initialTournamentEditForm({ ...T, court_name: 'Padelhallen Køge' }, VENUES);
  assert.equal(custom.venue, MATCH_VENUE_CUSTOM);
  assert.equal(custom.custom_court, 'Padelhallen Køge');
});

test('flyt tid og vælg bane - eller skriv den selv', () => {
  const a = buildTournamentEditPatch({ venue: 'court-1', custom_court: '', date: '2026-10-02', time: '19:30', duration: '90' }, T, VENUES, NOW);
  assert.deepEqual(a.patch, { date: '2026-10-02', time_slot: '19:30', duration_minutes: 90, court_id: 'court-1', court_name: 'Skansen Padel' });
  const b = buildTournamentEditPatch({ venue: MATCH_VENUE_CUSTOM, custom_court: ' Padelhallen  Køge ', date: '2026-10-01', time: '18:00', duration: '120' }, T, VENUES, NOW);
  assert.deepEqual(b.patch, { date: '2026-10-01', time_slot: '18:00', duration_minutes: 120, court_id: null, court_name: 'Padelhallen Køge' });
  assert.equal(tournamentEditChatMessage(a.patch), '📅 Turneringen er ændret: fredag 2. okt kl. 19:30–21:00 · Skansen Padel');
  assert.equal(tournamentEditNotificationBody(a.patch, 'Mike Pedersen', 'Mexicano'), 'Mike har ændret Mexicano: fredag 2. okt kl. 19:30–21:00 · Skansen Padel');
});

test('afviser fortid, tomt banenavn og "ingen ændringer"', () => {
  assert.match(buildTournamentEditPatch({ ...initialTournamentEditForm(T, VENUES), date: '2026-09-24' }, T, VENUES, NOW).error, /passeret/);
  assert.match(buildTournamentEditPatch({ ...initialTournamentEditForm(T, VENUES), venue: MATCH_VENUE_CUSTOM }, T, VENUES, NOW).error, /navnet på banen/);
  assert.match(buildTournamentEditPatch(initialTournamentEditForm(T, VENUES), T, VENUES, NOW).error, /ikke ændret/);
});

test('databasen: court_name, kun opretter, kun tilmelding, ikke fortid', () => {
  const sql = migration();
  assert.match(sql, /ADD COLUMN IF NOT EXISTS court_name text/);
  assert.match(sql, /char_length\(court_name\) <= 60/);
  assert.match(sql, /v_t\.creator_id IS DISTINCT FROM v_uid AND NOT public\.is_admin\(\)/);
  assert.match(sql, /<> 'registration'/);
  assert.match(sql, /AT TIME ZONE 'Europe\/Copenhagen'\) < now\(\)/);
  assert.match(sql, /REVOKE ALL ON FUNCTION public\.update_americano_details\([^)]*\) FROM PUBLIC, anon;/);
  // Kortet i Messenger bruger navnet, når banen ikke er i courts.
  assert.match(sql, /coalesce\(nullif\(trim\(v_court\), ''\), nullif\(trim\(v_t\.court_name\), ''\), 'Bane ikke angivet'\)/);
});

test('appen: knap, gemning, besked i chat og notifikation', () => {
  const tab = read('src/features/americano/AmericanoTab.tsx');
  assert.match(tab, /Ret bane, dato og tid/);
  assert.match(tab, /supabase\.rpc\('update_americano_details'/);
  assert.match(tab, /tournamentEditChatMessage\(patch\)/);
  assert.match(tab, /'match_updated',\s*`\$\{formatLabel\} er ændret 📅`/);
  assert.match(tab, /\{ entityType: 'americano', entityId: t\.id \}/);
  // Navnet vises, når banen ikke er i courts.
  assert.match(read('src/features/americano/americanoDisplayUtils.ts'), /courtName\?: string \| null/);
  const form = read('src/features/americano/CreateAmericanoTournamentForm.tsx');
  assert.match(form, /court_name: chosenCourtName \|\| null,/);
  assert.match(form, /CUSTOM_VENUE_OPTION/);
});
