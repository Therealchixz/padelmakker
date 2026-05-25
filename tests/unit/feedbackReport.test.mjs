import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const dir = dirname(fileURLToPath(import.meta.url));
const dash = readFileSync(join(dir, '../../src/dashboard/DashboardPage.jsx'), 'utf8');
const modal = readFileSync(join(dir, '../../src/components/FeedbackReportModal.jsx'), 'utf8');
const tourHook = readFileSync(join(dir, '../../src/hooks/useGuidedTour.js'), 'utf8');

test('dashboard wires feedback modal and tour prompt', () => {
  assert.match(dash, /FeedbackReportModal/);
  assert.match(dash, /onFeedbackClick=\{\(\) => setFeedbackOpen\(true\)\}/);
  assert.match(dash, /GuidedTourPrompt/);
  assert.match(dash, /mobile-more-sheet/);
});

test('feedback modal enforces minimum description length in UI', () => {
  assert.match(modal, /messageValid = messageTrimmed\.length >= 10/);
  assert.match(modal, /mindst 10 tegn/);
  assert.match(modal, /submitFeedbackReport/);
});

test('guided tour uses soft prompt instead of immediate auto-start', () => {
  assert.match(tourHook, /TOUR_PROMPT_DELAY_MS/);
  assert.match(tourHook, /setTimeout\(\(\) => \{\s*setTourPromptOpen\(true\)/s);
  assert.doesNotMatch(tourHook, /setTimeout\(\(\) => \{\s*setTourOpen\(true\)/s);
});
