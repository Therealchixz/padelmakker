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
const q = (years, racket, glass, overhead) => ({ years, racket, glass, overhead });

// --- 1. Niveau-spørgsmål -------------------------------------------------------

test('fire spørgsmål med fire svar hver', () => {
  assert.equal(LEVEL_QUIZ.length, 4);
  for (const x of LEVEL_QUIZ) assert.equal(x.options.length, 4);
});

test('forslaget følger slagene, ikke kun årene', () => {
  assert.equal(suggestLevelFromQuiz(q(0, 0, 0, 0)), 1);
  assert.equal(suggestLevelFromQuiz(q(0, 3, 0, 0)), 1.5, 'tennisspiller uden padel starter lidt højere');
  assert.equal(suggestLevelFromQuiz(q(2, 1, 1, 1)), 2.5);
  assert.equal(suggestLevelFromQuiz(q(3, 2, 2, 2)), 4);
  assert.equal(suggestLevelFromQuiz(q(3, 3, 3, 3)), 5, 'højst 5 – derover er turneringsniveau');
});

test('uden kontrol over bagglasset: under 3; kun smash ved nettet: under 4', () => {
  assert.ok(suggestLevelFromQuiz(q(3, 3, 1, 3)) < 3);
  assert.ok(suggestLevelFromQuiz(q(3, 3, 3, 1)) < 4);
});

test('forslaget rundes ned til halve, fordi folk gætter for højt', () => {
  for (let a = 0; a < 4; a++) for (let b = 0; b < 4; b++) for (let c = 0; c < 4; c++) for (let d = 0; d < 4; d++) {
    const v = suggestLevelFromQuiz(q(a, b, c, d));
    assert.equal(v * 2, Math.round(v * 2));
  }
});

test('intet forslag før alle fire er besvaret', () => {
  assert.equal(suggestLevelFromQuiz({ years: 1, racket: 1, glass: 1 }), null);
  assert.equal(levelQuizComplete({ years: 1, racket: 1, glass: 1, overhead: 9 }), false);
});

test('oprettelsen viser "Ikke sikker?" og bruger forslaget', () => {
  const o = read('src/pages/OnboardingPage.jsx');
  assert.match(o, /Ikke sikker\? Svar på 4 hurtige spørgsmål/);
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
