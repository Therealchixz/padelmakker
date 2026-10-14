import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const dir = dirname(fileURLToPath(import.meta.url));
const read = (rel) => readFileSync(join(dir, rel), 'utf8');

test('Sprint B: mobil primary includes Beskeder, Baner i Mere', () => {
  const dash = read('../../src/dashboard/DashboardPage.jsx');
  assert.match(dash, /mobilePrimaryTabIds = \["hjem", "makkere", "kampe", "beskeder"\]/);
  assert.match(dash, /Baner, Rangliste, Profil/);
});

test('Sprint B: Americano create labels are aligned', () => {
  const kampe = read('../../src/dashboard/KampeTab.jsx');
  assert.match(kampe, /const createHeaderTitle = toolbarCreateLabel/);
  assert.doesNotMatch(kampe, /Opret turnering/);
});

test('Sprint B: chat header has no disabled More button', () => {
  const header = read('../../src/components/chat/ChatThreadHeader.jsx');
  assert.doesNotMatch(header, /Flere valg/);
  assert.doesNotMatch(header, /MoreVertical/);
  assert.match(header, /actionsSlot \|\| null/);
});

test('Sprint B: BanerTab uses abort + cache TTL', () => {
  const baner = read('../../src/dashboard/BanerTab.jsx');
  assert.match(baner, /AbortController/);
  assert.match(baner, /BANER_CACHE_TTL_MS/);
  assert.match(baner, /force: true/);
});

test('Sprint B: signup copy is honest about funnel', () => {
  const onboarding = read('../../src/pages/OnboardingPage.jsx');
  // Efter profilen kommer SMS og e-mail — det skal stå på første skærm.
  assert.match(onboarding, /bagefter bekræfter du med SMS og e-mail/);
  assert.doesNotMatch(onboarding, /under 2 minutter/);
  // Antallet i teksten skal passe med trin-stregerne (QA 14. okt. 2026: der stod "Tre trin" over fire streger).
  const stepCount = onboarding.match(/const stepTitles = \[([^\]]*)\]/)[1].split(',').length;
  assert.equal(stepCount, 4);
  assert.match(onboarding, /Fire korte trin/);
  assert.doesNotMatch(onboarding, /Tre trin/);
});
