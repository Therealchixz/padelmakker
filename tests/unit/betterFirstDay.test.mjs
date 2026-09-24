/**
 * Nr. 3 – bedre første dag (ejeren valgte 1, 2 og 3, 24. sep. 2026):
 *   1. "Ikke sikker?" – 4 spørgsmål, der foreslår et niveau (rundet ned).
 *   2. "Hvad søger du mest?" – gemmes i intent_now, som filteret bruger.
 *   3. "Passede niveauet?" efter de første 1–3 kampe.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { LEVEL_QUIZ, suggestLevelFromQuiz, levelQuizComplete } from '../../src/lib/levelQuiz.js';
import { shouldShowLevelCheck, levelCheckSuggestion } from '../../src/lib/levelCheck.js';
import { SIGNUP_INTENTS } from '../../src/lib/signupIntents.js';
import { INTENTS } from '../../src/lib/platformConstants.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const read = (rel) => readFileSync(join(root, rel), 'utf8');
const q = (years, racket, glass, overhead, competition = 0) => ({ years, racket, glass, overhead, competition });

// --- 1. Niveau-spørgsmål -------------------------------------------------------
// Skalaen følger Dansk Padel Forbund (ejeren sendte den 24. sep. 2026):
// 3.0 = 3. division/DPF50, 3.5 = 2. division/DPF100, 4.0 = 1. division/DPF200.

test('fem spørgsmål med fire svar hver, sidste om division/turneringer', () => {
  assert.equal(LEVEL_QUIZ.length, 5);
  for (const x of LEVEL_QUIZ) assert.equal(x.options.length, 4);
  assert.equal(LEVEL_QUIZ[4].id, 'competition');
});

test('uden division eller turneringer foreslås højst 3.0 – uanset slag', () => {
  for (let a = 0; a < 4; a++) for (let b = 0; b < 4; b++) for (let c = 0; c < 4; c++) for (let d = 0; d < 4; d++) {
    assert.ok(suggestLevelFromQuiz(q(a, b, c, d, 0)) <= 3, `${a}${b}${c}${d}`);
  }
  assert.equal(suggestLevelFromQuiz(q(3, 3, 3, 3, 0)), 3);
});

test('division/turneringer placerer én i DPF-rammen', () => {
  assert.equal(suggestLevelFromQuiz(q(3, 2, 2, 2, 1)), 3, '3. division / DPF50');
  assert.equal(suggestLevelFromQuiz(q(3, 2, 2, 2, 2)), 3.5, '2. division / DPF100');
  assert.equal(suggestLevelFromQuiz(q(3, 2, 2, 2, 3)), 4, '1. division / DPF200');
  assert.ok(suggestLevelFromQuiz(q(3, 3, 3, 3, 3)) <= 4.5, 'aldrig Elite ud fra et spørgeskema');
});

test('slagene tæller: nybegynder, let øvet', () => {
  assert.equal(suggestLevelFromQuiz(q(0, 0, 0, 0)), 1);
  assert.equal(suggestLevelFromQuiz(q(0, 3, 0, 0)), 1.5, 'tennisspiller uden padel starter lidt højere');
  assert.equal(suggestLevelFromQuiz(q(3, 0, 2, 1)), 2.5, 'rigtige padelslag, ingen division');
  assert.ok(suggestLevelFromQuiz(q(3, 3, 1, 3)) < 3, 'uden kontrol over bagglasset: under 3');
});

test('forslaget rundes ned til halve, fordi folk gætter for højt', () => {
  for (let a = 0; a < 4; a++) for (let c = 0; c < 4; c++) for (let d = 0; d < 4; d++) for (let e = 0; e < 4; e++) {
    const v = suggestLevelFromQuiz(q(a, 1, c, d, e));
    assert.equal(v * 2, Math.round(v * 2));
  }
});

test('niveau-kortene følger DPF-skalaen', () => {
  const o = read('src/pages/OnboardingPage.jsx');
  assert.match(o, /3\. division eller DPF50/);
  assert.match(o, /1\. division eller DPF200/);
  assert.doesNotMatch(o, /Taktisk spil, bandeja og kontrolleret tempo/);
});

test('man kan altid skrive sit niveau selv', () => {
  const o = read('src/pages/OnboardingPage.jsx');
  assert.match(o, /Kender du dit niveau\? Skriv det selv/);
  assert.match(o, /onManual=\{\(\) => \{ setShowLevelQuiz\(false\); setShowFineTune\(true\); \}\}/);
  assert.match(read('src/components/LevelQuiz.jsx'), /Jeg kender mit niveau – skriv det selv/);
});

test('intet forslag før alle fem er besvaret', () => {
  assert.equal(suggestLevelFromQuiz({ years: 1, racket: 1, glass: 1, overhead: 1 }), null);
  assert.equal(levelQuizComplete({ years: 1, racket: 1, glass: 1, overhead: 1, competition: 9 }), false);
});

test('oprettelsen viser "Ikke sikker?" og bruger forslaget', () => {
  const o = read('src/pages/OnboardingPage.jsx');
  assert.match(o, /Ikke sikker\? Svar på 5 hurtige spørgsmål/);
  assert.match(o, /onUse=\{\(lvl\) => \{ set\("levelNumeric", lvl\)/);
});

// --- 2. Hvad søger du mest? ----------------------------------------------------

test('de tre valg er værdier, filteret allerede kender', () => {
  const known = new Set(INTENTS.map((i) => i.value));
  assert.deepEqual(SIGNUP_INTENTS.map((i) => i.value), ['hygge', 'træning', 'konkurrence']);
  for (const i of SIGNUP_INTENTS) assert.ok(known.has(i.value), i.value);
});

test('svaret gemmes ved oprettelse (begge veje) og kan rettes i profilen', () => {
  assert.match(read('src/pages/OnboardingPage.jsx'), /intent_now: form\.intent_now \|\| null/);
  assert.match(read('src/lib/profileUtils.js'), /intent_now: meta\.intent_now \|\| null/);
  const p = read('src/dashboard/ProfilTab.jsx');
  assert.match(p, /intent_now: form\.intent_now \|\| null/);
  assert.match(p, /Hvad søger du mest\?/);
  assert.match(read('src/dashboard/profileTabHelpers.jsx'), /intent_now: p\.intent_now \|\| ""/);
});

test('svaret vises på spillerkort og profil', () => {
  assert.match(read('src/dashboard/MakkereTab.jsx'), /intentDisplayLabel\(p\.intent_now\)/);
  assert.match(read('src/dashboard/PlayerProfileModal.jsx'), /intentDisplayLabel\(pRef\.intent_now\)/);
});

// --- 3. Passede niveauet? ------------------------------------------------------

test('kortet vises kun efter 1–3 kampe og kun én gang', () => {
  assert.equal(shouldShowLevelCheck({ games_played: 0, level: 3 }, {}), false);
  assert.equal(shouldShowLevelCheck({ games_played: 1, level: 3 }, {}), true);
  assert.equal(shouldShowLevelCheck({ games_played: 3, level: 3 }, null), true);
  assert.equal(shouldShowLevelCheck({ games_played: 4, level: 3 }, {}), false);
  assert.equal(shouldShowLevelCheck({ games_played: 1, level: 3 }, { level_check_at: '2026-09-25' }), false);
});

test('for let hæver ½, for svært sænker ½, passede ændrer intet', () => {
  assert.equal(levelCheckSuggestion(3, 'for_let'), 3.5);
  assert.equal(levelCheckSuggestion(3.2, 'for_svaert'), 2.7);
  assert.equal(levelCheckSuggestion(3, 'passede'), null);
  assert.equal(levelCheckSuggestion(7, 'for_let'), null, 'kan ikke komme over 7');
  assert.equal(levelCheckSuggestion(1, 'for_svaert'), null, 'kan ikke komme under 1');
});

test('kortet sidder på Hjem og husker svaret i kontoen', () => {
  assert.match(read('src/dashboard/HomeTab.jsx'), /<LevelCheckCard user=\{user\} showToast=\{showToast\} \/>/);
  assert.match(read('src/components/LevelCheckCard.jsx'), /level_check_at: new Date\(\)\.toISOString\(\)/);
});
