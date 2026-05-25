import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const dir = dirname(fileURLToPath(import.meta.url));
const dash = readFileSync(join(dir, '../../src/dashboard/DashboardPage.jsx'), 'utf8');
const home = readFileSync(join(dir, '../../src/dashboard/HomeTab.jsx'), 'utf8');
const profil = readFileSync(join(dir, '../../src/dashboard/ProfilTab.jsx'), 'utf8');

const overlay = readFileSync(join(dir, '../../src/components/GuidedTourOverlay.jsx'), 'utf8');

test('mobile tour opens mere-sheet and scrolls activity/profile to top', () => {
  assert.match(dash, /TOUR_VERSION = 3/);
  assert.match(dash, /mobile-more-sheet/);
  assert.match(dash, /mobileMoreTourActive/);
  assert.match(dash, /selectors: \['\[data-tour="mobile-more-sheet"\]', '\[data-tour="mobile-tab-mere"\]'\]/);
  assert.match(dash, /mobileMoreVisible && !mobileMoreTourActive/);
  assert.match(dash, /pm-mobile-bottom-nav--tour/);
  assert.match(dash, /hideMobileBottomNav = isMobileView && tab === "beskeder" && mobileConversationOpen/);
  assert.match(dash, /const active = tab === t\.id && !mobileMoreVisible/);
  assert.match(dash, /scrollBlock: 'start'/);
  assert.match(dash, /waitForMount: true/);
  assert.match(dash, /tourForceOpen=\{tourOnNotificationStep\}/);
  assert.match(home, /data-tour="home-latest-activity" className="pm-tour-scroll-anchor"/);
  assert.match(dash, /clampHighlight: true/);
  assert.match(dash, /scrollTourTarget/);
  assert.doesNotMatch(home, /pm-feed-filters-header.*home-latest-activity/);
  assert.match(profil, /data-tour="profile-main" className="pm-tour-scroll-anchor"/);
  assert.match(overlay, /mergeHighlightRects/);
  assert.match(overlay, /tourTargetSelectors/);
});
