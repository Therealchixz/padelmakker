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

test('tour shows Spil and the Mere page and scrolls activity/profile to top', () => {
  assert.match(dash, /TOUR_VERSION = 4/);
  // Redesign v4: Mere er en side, ikke en skuffe. Guiden peger paa Spil og Mere i menuen.
  assert.doesNotMatch(dash, /mobile-more-sheet/);
  assert.match(dash, /id: 'spil',\s*selector: tabTourSelector\('spil'\)/);
  assert.match(dash, /id: 'mere',\s*tab: 'mere',\s*selector: tabTourSelector\('mere'\)/);
  assert.match(dash, /data-tour="mobile-tab-spil"/);
  assert.match(dash, /hideMobileBottomNavForKampeDetail[\s\S]*isKampeDetailRoute\(location\.pathname\)/);
  assert.match(dash, /hideMobileBottomNavForChat \? " pm-dash-main--chat"/);
  assert.match(dash, /hideMobileBottomNavForKampeDetail \? " pm-dash-main--kampe-detail"/);
  assert.match(dash, /const active = isNavTabActive\(t\.id\)/);
  assert.match(dash, /scrollBlock: 'start'/);
  assert.match(dash, /waitForMount: true/);
  assert.doesNotMatch(dash, /tourForceOpen=\{tourOnNotificationStep\}/);
  // Klokken sidder nu i den fælles toplinje (ScreenHeader), stadig med tour-åbning.
  assert.match(home, /bellTourForceOpen=\{tourForceNotificationOpen\}/);
  assert.match(home, /data-tour="home-latest-activity" className="pm-tour-scroll-anchor"/);
  assert.match(dash, /clampHighlight: true/);
  assert.match(dash, /scrollTourTarget/);
  assert.doesNotMatch(home, /pm-feed-filters-header.*home-latest-activity/);
  assert.match(profil, /data-tour="profile-main" className="pm-tour-scroll-anchor"[\s\S]*pm-profile-card/);
  assert.equal((dash.match(/id: 'profile'/g) || []).length, 2);
  assert.ok((dash.match(/clampHighlight: true/g) || []).length >= 2);
  assert.match(overlay, /mergeHighlightRects/);
  assert.match(overlay, /tourTargetSelectors/);
});
