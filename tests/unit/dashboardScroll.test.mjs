import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  DASHBOARD_SCROLL_TOP_THRESHOLD,
  shouldScrollDashboardToTopOnTabReselect,
} from '../../src/lib/dashboardScroll.js';

const dash = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../../src/dashboard/DashboardPage.jsx'),
  'utf8',
);

test('shouldScrollDashboardToTopOnTabReselect kræver scroll over threshold', () => {
  assert.equal(shouldScrollDashboardToTopOnTabReselect(0), false);
  assert.equal(shouldScrollDashboardToTopOnTabReselect(DASHBOARD_SCROLL_TOP_THRESHOLD), false);
  assert.equal(shouldScrollDashboardToTopOnTabReselect(DASHBOARD_SCROLL_TOP_THRESHOLD + 1), true);
});

test('mobil bundnavigation bruger handleTabPress til scroll-to-top', () => {
  assert.match(dash, /handleTabPress/);
  assert.match(dash, /shouldScrollDashboardToTopOnTabReselect/);
  assert.match(dash, /onClick=\{\(\) => handleTabPress\(t\.id\)\}/);
  assert.match(dash, /handleTabPress\(t\.id, \{ fromMoreSheet: true \}\)/);
});
