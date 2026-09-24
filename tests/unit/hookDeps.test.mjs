/**
 * To forAeldede afhaengighedslister gav reelle fejl i brugerfladen. Begge var
 * tavse: koden regnede rigtigt, men hook'en koerte ikke igen naar inddata
 * skiftede, saa skaermen viste et gammelt resultat.
 *
 * Testene laeser afhaengighedslisten for netop de hooks og fejler, hvis et navn
 * forsvinder igen.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const kampe = readFileSync(join(root, 'src/dashboard/KampeTab.jsx'), 'utf8');

/** Afhaengighedslisten der afslutter hook'en som starter ved `start`. */
function depsEfter(src, start) {
  const i = src.indexOf(start);
  assert.notEqual(i, -1, `fandt ikke "${start}"`);
  const m = /\n\s*\}, \[([\s\S]*?)\]\);/.exec(src.slice(i));
  assert.ok(m, `ingen afhaengighedsliste efter "${start}"`);
  return m[1];
}

test('ulaeste-tallet reagerer paa nye tilmeldingsanmodninger', () => {
  // Memo'en laeser joinRequests og user.id, men stod ikke i listen: badge-tallet
  // blev staaende indtil noget andet tilfaeldigvis aendrede sig.
  const deps = depsEfter(kampe, 'const padelUnreadCounts = useMemo(');
  assert.match(deps, /\bjoinRequests\b/);
  assert.match(deps, /\buser\.id\b/);
});

test('knappens rettighedstjek foelger admin-PIN', () => {
  // adminCanAct = isAdmin && adminPinVerified. Listen havde kun isAdmin, saa
  // "Bekraeft resultat" blev ved med at bruge rettigheden fra FOER PIN-koden.
  const deps = depsEfter(kampe, 'const buildMatchPrimaryAction = useCallback(');
  assert.match(deps, /\badminCanAct\b/);
  assert.match(deps, /\bloadData\b/);

  const def = /const adminCanAct = ([^;]+);/.exec(kampe);
  assert.ok(def, 'adminCanAct er ikke defineret som ventet');
  assert.match(
    def[1],
    /adminPinVerified/,
    'adminCanAct afhaenger ikke laengere af PIN - revurder listen ovenfor',
  );
});

test('niveau-filterchippen viser det aktuelle niveau', () => {
  // Etiketten skrives af getKampeListLevelBandLabel(..., myLevel); uden myLevel i
  // listen stod baandet fast paa vaerdien fra foerste rendering.
  const deps = depsEfter(kampe, 'const activeFilterChips = useMemo(');
  assert.match(deps, /\bmyLevel\b/);
  assert.match(deps, /\bonListFilterChange\b/);
});
