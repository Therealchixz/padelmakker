/**
 * Deling af Americano/Mexicano: tekst, link og kortet i Messenger/WhatsApp.
 *
 * Før (25. sep. 2026): 'En spiller inviterer dig til "Test" (25.09.2026 kl.
 * 11:00) på Ikke valgt / anden bane.' og forsidens standardkort.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildTournamentShareText,
  shareTournamentUrl,
  tournamentCourtLabel,
  tournamentPreviewMeta,
} from '../../src/lib/tournamentShareText.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const read = (rel) => readFileSync(join(root, rel), 'utf8');

const T = {
  id: 'abc', name: 'Test', format: 'americano', tournament_date: '2026-10-01', time_slot: '18:00',
  player_slots: 8, court_name: 'Ikke valgt / anden bane',
};

test('teksten siger hvem, hvornår og hvor mange der mangler', () => {
  assert.equal(
    buildTournamentShareText(T, { hostName: 'Mike Pedersen', participantCount: 1 }),
    'Mike inviterer dig til Americano torsdag 1. okt kl. 18:00 🎾\n"Test"\nMangler 7 spillere (8 i alt)\nMeld dig til gratis på PadelMakker.',
  );
  // Uden navn og med bane.
  const t = buildTournamentShareText({ ...T, name: 'Americano', format: 'mexicano', court_name: 'Skansen Padel' }, { participantCount: 7 });
  assert.equal(t, 'Mexicano torsdag 1. okt kl. 18:00 🎾\nSkansen Padel\nMangler 1 spiller (8 i alt)\nMeld dig til gratis på PadelMakker.');
  assert.match(buildTournamentShareText(T, { participantCount: 8 }), /Fuldt booket/);
});

test('"Ikke valgt / anden bane" og "Bane ikke angivet" vises ikke som en bane', () => {
  assert.equal(tournamentCourtLabel({ court_name: 'Ikke valgt / anden bane' }), '');
  assert.equal(tournamentCourtLabel({ court_name: 'Bane ikke angivet' }), '');
  assert.equal(tournamentCourtLabel({ court_name: 'Skansen Padel' }), 'Skansen Padel');
});

test('link med ?kilde=deling, og tekst og link deles hver for sig', () => {
  assert.equal(shareTournamentUrl('https://www.padelmakker.dk/', 'abc'), 'https://www.padelmakker.dk/turnering/abc?kilde=deling');
  const utils = read('src/lib/shareUtils.js');
  const fn = utils.slice(utils.indexOf('export async function shareAmericanoTournament'));
  const body = fn.slice(0, fn.indexOf('\n}\n'));
  assert.match(body, /text: buildTournamentShareText\(tournament, \{ hostName, participantCount \}\),/);
  assert.match(body, /url: shareTournamentUrl\(SITE_ORIGIN, tournament\.id\),/);
  assert.match(read('src/features/americano/AmericanoTab.tsx'), /hostName: String\(profile\?\.full_name \|\| profile\?\.name \|\| ''\)/);
});

test('kortet ud fra public_americano_preview', () => {
  const meta = tournamentPreviewMeta({ ...T, court_name: 'Bane ikke angivet', participant_count: 1 });
  assert.equal(meta.title, 'Americano torsdag 1. okt kl. 18:00 · mangler 7 spillere');
  assert.equal(meta.description, '"Test" · Bane ikke valgt endnu · 1/8 tilmeldt. Meld dig til gratis på PadelMakker.');
});

test('kun link-robotter sendes til turnerings-kortet, og før app-reglen', () => {
  const vercel = JSON.parse(read('vercel.json'));
  const i = vercel.rewrites.findIndex((r) => r.source === '/turnering/:tournamentId');
  const spa = vercel.rewrites.findIndex((r) => r.destination === '/index.html');
  assert.ok(i >= 0 && i < spa, 'robot-reglen skal stå før index.html-reglen');
  const rule = vercel.rewrites[i];
  assert.equal(rule.destination, '/api/turnering-preview?id=:tournamentId');
  const ua = new RegExp(rule.has[0].value);
  assert.ok(ua.test('facebookexternalhit/1.1'));
  assert.ok(!ua.test('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1'));
  assert.match(read('api/[slug].js'), /case 'turnering-preview':\s*return handleTournamentPreview\(req, res\);/);
});

test('opretteren kan se, at slet ligger under opretter-værktøjer', () => {
  const tab = read('src/features/americano/AmericanoTab.tsx');
  assert.match(tab, /isCreator \? 'opretter-værktøjer \(slet m\.m\.\)' : 'admin-værktøjer'/);
});
