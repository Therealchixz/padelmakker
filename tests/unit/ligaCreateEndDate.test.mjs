/**
 * "Opret liga" fejlede, fordi formularen ikke sender en slutdato, og
 * leagues.end_date er NOT NULL (ejeren 25. sep. 2026).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveLeagueEndDate } from '../../src/lib/ligaCreateDefaults.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');

test('månedlig liga uden slutdato slutter samme dato næste måned', () => {
  assert.equal(resolveLeagueEndDate('2026-09-30', '', 'monthly'), '2026-10-30');
  assert.equal(resolveLeagueEndDate('2026-01-31', null, 'monthly'), '2026-02-28');
  assert.equal(resolveLeagueEndDate('2028-01-31', null, 'monthly'), '2028-02-29');
  assert.equal(resolveLeagueEndDate('2026-12-15', '', 'monthly'), '2027-01-15');
});

test('ugentlig liga uden slutdato slutter 7 dage efter start', () => {
  assert.equal(resolveLeagueEndDate('2026-09-28', '', 'weekly'), '2026-10-05');
});

test('en gyldig valgt slutdato bruges; en slutdato før start ignoreres', () => {
  assert.equal(resolveLeagueEndDate('2026-09-30', '2026-11-15', 'monthly'), '2026-11-15');
  assert.equal(resolveLeagueEndDate('2026-09-30', '2026-09-01', 'monthly'), '2026-10-30');
  assert.equal(resolveLeagueEndDate('', '', 'monthly'), null);
});

test('LigaTab sender altid en slutdato med', () => {
  const src = readFileSync(join(root, 'src/dashboard/LigaTab.jsx'), 'utf8');
  assert.match(src, /end_date: endDate,/);
  assert.doesNotMatch(src, /end_date: createForm\.end_date \|\| null/);
});

test('bekræft-trinnet viser datoerne på dansk (dd.mm.åååå), ikke 2026-09-25', () => {
  const src = readFileSync(join(root, 'src/dashboard/LigaTab.jsx'), 'utf8');
  assert.match(src, /label="Tilmeldingsfrist" value=\{createForm\.registration_deadline \? formatMatchDateDa\(/);
  assert.doesNotMatch(src, /\{createForm\.start_date \|\| '—'\}/);
});

test('opret-guiden har et felt til sæsonslut (ejeren: "hvor længe skal den løbe")', () => {
  const picker = readFileSync(join(root, 'src/dashboard/LigaSchedulePicker.jsx'), 'utf8');
  assert.match(picker, /title="Sæsonslut"/);
  assert.match(picker, /end_date: e\.target\.value/);
  const defaults = readFileSync(join(root, 'src/lib/ligaCreateDefaults.js'), 'utf8');
  assert.match(defaults, /Sæsonslut skal være efter sæsonstart\./);
});

test('opret-guiden har et felt til maks. antal hold (hvornår ligaen er fyldt)', () => {
  const src = readFileSync(join(root, 'src/dashboard/LigaTab.jsx'), 'utf8');
  assert.match(src, /<label>Maks\. antal hold<\/label>/);
  assert.match(src, /max_teams: e\.target\.value/);
  assert.match(src, /<option value="">Ingen grænse<\/option>/);
});

test('tidsplan: frist → start → slut med hurtigvalg og længde (ejeren 27. sep. 2026)', async () => {
  const { addDaysYmd, daysBetweenYmd, seasonLengthLabel, leagueScheduleError } = await import('../../src/lib/ligaCreateDefaults.js');
  assert.equal(addDaysYmd('2026-10-08', 42), '2026-11-19');
  assert.equal(daysBetweenYmd('2026-10-08', '2026-11-19'), 42);
  assert.equal(seasonLengthLabel('2026-10-08', '2026-11-19'), '6 uger');
  assert.equal(seasonLengthLabel('2026-10-08', '2026-10-09'), '1 dag');
  assert.deepEqual(leagueScheduleError({ registration_deadline: '2026-10-10', start_date: '2026-10-08', end_date: '' }).field, 'registration_deadline');
  assert.equal(leagueScheduleError({ registration_deadline: '2026-10-05', start_date: '2026-10-08', end_date: '2026-10-01' }).field, 'end_date');
  assert.equal(leagueScheduleError({ registration_deadline: '2026-10-05', start_date: '2026-10-08', end_date: '2026-11-19' }), null);
  const tab = readFileSync(join(root, 'src/dashboard/LigaTab.jsx'), 'utf8');
  assert.match(tab, /<LigaSchedulePicker/);
  assert.doesNotMatch(tab, /Tilmeldingsfrist &amp; sæsonstart/);
  const picker = readFileSync(join(root, 'src/dashboard/LigaSchedulePicker.jsx'), 'utf8');
  for (const t of ['Tilmeldingsfrist', 'Sæsonstart', 'Sæsonslut', 'Sidste dag, hold kan melde sig til.', 'Alle kampe skal være spillet.']) {
    assert.ok(picker.includes(t), t);
  }
});
