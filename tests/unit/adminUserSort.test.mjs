/**
 * Sortering af brugerlisten i admin-panelet, herunder den nye "Oprettet".
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  signupTime,
  firstSortDirection,
  nextSortConfig,
  sortAdminUsers,
} from '../../src/lib/adminUserSort.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');

const navn = (u) => String(u?.full_name || u?.email || '');
const navne = (liste) => liste.map((u) => u.full_name);

const brugere = [
  { full_name: 'Bo', created_at: '2026-06-01T00:00:00Z', elo_rating: 1100, role: 'player' },
  { full_name: 'Anna', created_at: '2026-04-07T00:00:00Z', elo_rating: 1000, role: 'admin' },
  { full_name: 'Carl', created_at: '2026-09-21T00:00:00Z', elo_rating: 1050, role: 'player' },
];

test('oprettet: nyeste foerst som standard', () => {
  assert.equal(firstSortDirection('created_at'), 'desc');
  const ud = sortAdminUsers(brugere, { key: 'created_at', direction: 'desc' }, navn);
  assert.deepEqual(navne(ud), ['Carl', 'Bo', 'Anna']);
});

test('oprettet: aeldste foerst den anden vej', () => {
  const ud = sortAdminUsers(brugere, { key: 'created_at', direction: 'asc' }, navn);
  assert.deepEqual(navne(ud), ['Anna', 'Bo', 'Carl']);
});

test('brugere uden dato ligger nederst BEGGE veje', () => {
  // Ellers ville de fylde toppen, hver gang man vendte sorteringen.
  const med = [...brugere, { full_name: 'Ukendt', created_at: null }];
  const ned = sortAdminUsers(med, { key: 'created_at', direction: 'desc' }, navn);
  const op = sortAdminUsers(med, { key: 'created_at', direction: 'asc' }, navn);
  assert.equal(navne(ned).at(-1), 'Ukendt');
  assert.equal(navne(op).at(-1), 'Ukendt');
});

test('datoer sammenlignes som tal, ikke som tekst', () => {
  // Blandet format: ISO-streng, Date og tidsstempel. Tekstsammenligning ville
  // give en stille forkert raekkefoelge her.
  const blandet = [
    { full_name: 'streng', created_at: '2026-06-01T00:00:00Z' },
    { full_name: 'dato', created_at: new Date('2026-04-07T00:00:00Z') },
    { full_name: 'tal', created_at: Date.parse('2026-09-21T00:00:00Z') },
  ];
  const ud = sortAdminUsers(blandet, { key: 'created_at', direction: 'asc' }, navn);
  assert.deepEqual(navne(ud), ['dato', 'streng', 'tal']);
});

test('signupTime afviser det der ikke er en dato', () => {
  for (const tom of [null, undefined, '', 0, NaN, 'ikke en dato']) {
    assert.equal(signupTime(tom), null);
  }
  assert.equal(signupTime('2026-04-07T00:00:00Z'), Date.parse('2026-04-07T00:00:00Z'));
});

test('de gamle sorteringer er uaendrede', () => {
  assert.deepEqual(
    navne(sortAdminUsers(brugere, { key: 'full_name', direction: 'asc' }, navn)),
    ['Anna', 'Bo', 'Carl'],
  );
  assert.deepEqual(
    navne(sortAdminUsers(brugere, { key: 'elo_rating', direction: 'desc' }, navn)),
    ['Bo', 'Carl', 'Anna'],
  );
  // Admin foer player.
  assert.equal(navne(sortAdminUsers(brugere, { key: 'role', direction: 'asc' }, navn))[0], 'Anna');
  assert.equal(firstSortDirection('full_name'), 'asc');
});

test('den oprindelige liste roeres ikke', () => {
  const foer = navne(brugere);
  sortAdminUsers(brugere, { key: 'created_at', direction: 'asc' }, navn);
  assert.deepEqual(navne(brugere), foer);
});

test('tom eller manglende liste giver en tom liste', () => {
  assert.deepEqual(sortAdminUsers([], { key: 'created_at', direction: 'asc' }, navn), []);
  assert.deepEqual(sortAdminUsers(null, { key: 'created_at', direction: 'asc' }, navn), []);
  assert.deepEqual(navne(sortAdminUsers(brugere, { key: null }, navn)), navne(brugere));
});

test('klik paa samme kolonne vender retningen, ny kolonne starter forfra', () => {
  assert.deepEqual(nextSortConfig({ key: 'full_name', direction: 'asc' }, 'full_name'),
    { key: 'full_name', direction: 'desc' });
  assert.deepEqual(nextSortConfig({ key: 'full_name', direction: 'desc' }, 'full_name'),
    { key: 'full_name', direction: 'asc' });
  assert.deepEqual(nextSortConfig({ key: 'full_name', direction: 'asc' }, 'created_at'),
    { key: 'created_at', direction: 'desc' });
  assert.deepEqual(nextSortConfig(null, 'elo_rating'), { key: 'elo_rating', direction: 'asc' });
});

test('knappen findes i admin-panelet', () => {
  const src = readFileSync(join(root, 'src/dashboard/AdminTab.jsx'), 'utf8');
  assert.match(src, /requestSort\('created_at'\)/, 'knappen skal sortere paa created_at');
  assert.match(src, /Oprettet <SortIcon columnKey="created_at"/, 'og vise hvilken vej den sorterer');
  assert.match(src, /sortAdminUsers\(users, sortConfig, adminDisplayName\)/, 'listen skal bruge lib-sorteringen');
});
