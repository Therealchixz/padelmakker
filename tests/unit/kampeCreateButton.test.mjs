/**
 * Plusset paa Kampe-fanen dukkede op forsinket: knappen var slet ikke i DOM'en
 * mens kampene blev hentet, og poppede ind naar de ankom.
 *
 * Aarsagen var to gates der pegede paa hinanden:
 *   - onCreate var undefined mens loadingMatches var true, og
 *     KampeRedesignToolbar rendrer `{onCreate ? <button> : null}`
 *   - hele blokken med opret-guiden var gated paa (!loadingMatches || matches.length)
 *     saa selv et klik ville ikke have vist noget
 *
 * At oprette en kamp kraever ikke at listen er hentet. Begge gates er loesnet,
 * og testen her holder dem loesnet.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const kampe = readFileSync(join(root, 'src/dashboard/KampeTab.jsx'), 'utf8');
const toolbar = readFileSync(join(root, 'src/components/kampe/KampeRedesignToolbar.jsx'), 'utf8');

test('plusset afhaenger ikke af om kampene er hentet', () => {
  const m = /const handleToolbarCreate = ([^\n]*)/.exec(kampe);
  assert.ok(m, 'fandt ikke handleToolbarCreate');
  assert.doesNotMatch(
    m[1],
    /loadingMatches/,
    'handleToolbarCreate afhaenger igen af loadingMatches - saa forsvinder plusset under indlaesning',
  );
});

test('guiden kan vises mens listen stadig hentes', () => {
  assert.match(
    kampe,
    /!loadError && \(!loadingMatches \|\| matches\.length > 0 \|\| showCreate\)/,
    'opret-guiden er igen gated paa at kampene er hentet - et klik paa plusset ville vise ingenting',
  );
});

test('skelettet viger for guiden', () => {
  assert.match(
    kampe,
    /loadingMatches && matches\.length === 0 && !detailMatchId && !showCreate/,
    'indlaesnings-skelettet vises samtidig med guiden',
  );
});

test('vaerktoejslinjen skjuler knappen naar onCreate mangler', () => {
  // Den anden halvdel af aarsagen. Staar her saa sammenhaengen er dokumenteret
  // hvis nogen senere aendrer komponenten.
  assert.match(toolbar, /\{onCreate \? \(/);
});
