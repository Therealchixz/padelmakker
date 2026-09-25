/**
 * 2v2- og Americano-detaljen har samme top (ejeren 25. sep. 2026:
 * "2v2 og americano kamp kortet er lidt forskellige").
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const read = (rel) => readFileSync(join(root, rel), 'utf8');

test('begge detaljesider bruger EventDetailHero', () => {
  for (const f of ['src/components/kampe/KampeMatchDetailSheet.jsx', 'src/features/americano/AmericanoDetailSheet.tsx']) {
    const src = read(f);
    assert.match(src, /<EventDetailHero/, f);
    assert.doesNotMatch(src, /className="pm-kd-hero"/, f);
  }
});

test('toppen har bane-billede, banens navn som overskrift og dato + tidsrum', () => {
  const hero = read('src/components/kampe/EventDetailHero.jsx');
  assert.match(hero, /<PadelCourtArt/);
  assert.match(hero, /<h2 className="pm-kd-title">\{venue\}<\/h2>/);
  assert.match(hero, /Vis på kort/);
  assert.match(hero, /CalendarDays/);
});

test('Americano viser tidsrum ud fra varighed, og "7 ledige" som på 2v2', () => {
  const utils = read('src/features/americano/americanoDisplayUtils.ts');
  assert.match(utils, /export function tournamentTimeLabel/);
  const sheet = read('src/features/americano/AmericanoDetailSheet.tsx');
  assert.match(sheet, /ledig\$\{emptySlots === 1 \? '' : 'e'\}/);
  assert.match(sheet, /formatMatchDateHeadlineDa\(tournament\.tournament_date\)/);
});
