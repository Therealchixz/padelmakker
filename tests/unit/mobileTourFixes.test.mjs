import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const dir = dirname(fileURLToPath(import.meta.url));
const dash = readFileSync(join(dir, '../../src/dashboard/DashboardPage.jsx'), 'utf8');
const home = readFileSync(join(dir, '../../src/dashboard/HomeTab.jsx'), 'utf8');
const profil = readFileSync(join(dir, '../../src/dashboard/ProfilTab.jsx'), 'utf8');

test('mobile tour opens mere-sheet and scrolls activity/profile to top', () => {
  assert.match(dash, /TOUR_VERSION = 3/);
  assert.match(dash, /mobile-more-sheet/);
  assert.match(dash, /mobileMoreTourActive/);
  assert.match(dash, /scrollBlock: 'start'/);
  assert.match(dash, /waitForMount: true/);
  assert.match(dash, /tourForceOpen=\{tourOnNotificationStep\}/);
  assert.match(home, /data-tour="home-latest-activity" style=\{\{ marginBottom: "24px", scrollMarginTop: 88 \}\}/);
  assert.doesNotMatch(home, /pm-feed-filters-header.*home-latest-activity/);
  assert.match(profil, /data-tour="profile-main" style=\{\{ scrollMarginTop: 88/);
});
