import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GUIDED_TOUR_VERSION, buildGuidedTourSteps } from '../../src/lib/guidedTourSteps.js';

const tabSel = (tabId) => `[data-tour="tab-${tabId}"]`;
const mobileSel = (tabId) => `[data-tour="mobile-tab-${tabId}"]`;

test('guided tour version is bumped when steps change', () => {
  assert.equal(GUIDED_TOUR_VERSION, 4);
});

test('desktop tour covers kampe, baner and account menu', () => {
  const steps = buildGuidedTourSteps(false, tabSel);
  const ids = steps.map((s) => s.id);
  assert.ok(ids.includes('kampe'));
  assert.ok(ids.includes('baner-booking'));
  assert.ok(ids.includes('account-menu'));
  assert.ok(steps.some((s) => s.description?.includes('Americano')));
  assert.ok(steps.some((s) => s.id === 'latest-activity' && s.scrollBlock === 'start'));
  assert.ok(steps.some((s) => s.id === 'profile' && s.scrollBlock === 'start'));
});

test('mobile tour uses bottom nav selectors and mere-menu', () => {
  const steps = buildGuidedTourSteps(true, mobileSel);
  const ids = steps.map((s) => s.id);
  assert.ok(ids.includes('mobile-more'));
  assert.doesNotMatch(ids.join(','), /account-menu/);
  assert.equal(steps.find((s) => s.id === 'home')?.selector, mobileSel('hjem'));
  assert.equal(steps.find((s) => s.id === 'mobile-more')?.selector, '[data-tour="mobile-more-sheet"]');
  assert.equal(steps.find((s) => s.id === 'mobile-more')?.waitForMount, true);
});
