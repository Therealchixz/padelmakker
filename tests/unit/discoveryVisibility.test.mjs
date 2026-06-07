import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');

test('discovery visibility helpers and UX surfaces', () => {
  const lib = readFileSync(join(root, 'src/lib/discoveryVisibility.js'), 'utf8');
  assert.match(lib, /buildEnableVisibilityPatch/);
  assert.match(lib, /hasDiscoveryRegion/);

  const shortcut = readFileSync(join(root, 'src/components/SeekingFilterShortcutCard.jsx'), 'utf8');
  assert.match(shortcut, /Gør mig synlig/);
  assert.match(shortcut, /Eller find selv/);

  const banner = readFileSync(join(root, 'src/components/DiscoveryVisibilityBanner.jsx'), 'utf8');
  assert.match(banner, /Du er usynlig/);

  const panel = readFileSync(join(root, 'src/components/FilterDiscoveryPanel.jsx'), 'utf8');
  assert.match(panel, /Trin 1 · Bliv fundet/);

  const makkerFilter = readFileSync(join(root, 'src/dashboard/MakkerSearchFilterPage.jsx'), 'utf8');
  assert.match(makkerFilter, /FilterDiscoveryPanel channel="makker"/);
  assert.match(makkerFilter, /Trin 2 · Region/);

  const home = readFileSync(join(root, 'src/dashboard/HomeTab.jsx'), 'utf8');
  assert.match(home, /DiscoveryVisibilityBanner/);
});
