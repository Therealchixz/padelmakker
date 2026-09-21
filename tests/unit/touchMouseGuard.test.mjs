/**
 * ELO-grafen blinkede 2-3 gange, naar man trykkede paa et punkt paa en telefon.
 *
 * Aarsag: browseren sender efterlignede muse-haendelser efter et tryk, saa
 * grafen fik samme tryk to gange - og ryddede vaerdien imellem, fordi
 * onTouchEnd kaldte det samme som onMouseLeave.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  isSyntheticMouseAfterTouch,
  SYNTHETIC_MOUSE_WINDOW_MS,
} from '../../src/lib/touchMouseGuard.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');

test('en musehaendelse lige efter en touch er browserens efterligning', () => {
  assert.equal(isSyntheticMouseAfterTouch(1000, 1000), true);
  assert.equal(isSyntheticMouseAfterTouch(1000, 1300), true);
  assert.equal(isSyntheticMouseAfterTouch(1000, 1000 + SYNTHETIC_MOUSE_WINDOW_MS - 1), true);
});

test('en rigtig mus senere skal stadig virke', () => {
  assert.equal(isSyntheticMouseAfterTouch(1000, 1000 + SYNTHETIC_MOUSE_WINDOW_MS), false);
  assert.equal(isSyntheticMouseAfterTouch(1000, 9999), false);
});

test('uden nogen touch er ingenting en efterligning', () => {
  // En computer uden touch-skaerm maa aldrig faa sine musehaendelser slugt.
  assert.equal(isSyntheticMouseAfterTouch(null), false);
  assert.equal(isSyntheticMouseAfterTouch(undefined), false);
  assert.equal(isSyntheticMouseAfterTouch(NaN, 1000), false);
  assert.equal(isSyntheticMouseAfterTouch('1000', 1000), false);
});

test('et ur der hopper baglaens slipper haendelsen igennem', () => {
  // Hellere en haendelse for meget end en graf der holder op med at svare.
  assert.equal(isSyntheticMouseAfterTouch(5000, 1000), false);
});

test('vinduet kan saettes ned uden at logikken skrider', () => {
  assert.equal(isSyntheticMouseAfterTouch(1000, 1050, 100), true);
  assert.equal(isSyntheticMouseAfterTouch(1000, 1150, 100), false);
});

// --- Kaldstedet ------------------------------------------------------------
// EloGraph.jsx kan ikke importeres uden en browser, saa de to ting der faktisk
// gav blinket, kontrolleres i kilden.

test('EloGraph rydder ikke laengere vaerdien naar fingeren slippes', () => {
  const src = readFileSync(join(root, 'src/components/EloGraph.jsx'), 'utf8');
  assert.doesNotMatch(
    src,
    /onTouchEnd=\{onSvgPointerLeave\}/,
    'onTouchEnd maa ikke rydde vaerdien - paa en telefon slipper man altid, '
      + 'og saa forsvinder svaret i samme oejeblik man vil laese det',
  );
});

test('EloGraph ser bort fra efterlignede musehaendelser', () => {
  const src = readFileSync(join(root, 'src/components/EloGraph.jsx'), 'utf8');
  assert.match(src, /isSyntheticMouseAfterTouch/, 'vagten skal bruges');
  const kald = (src.match(/isSyntheticMouseAfterTouch\(/g) || []).length;
  assert.ok(
    kald >= 2,
    `baade musebevaegelse og mouseleave skal vaere daekket, fandt ${kald} kald`,
  );
  assert.match(src, /lastTouchAt\.current = Date\.now\(\)/, 'tidspunktet skal registreres');
});
