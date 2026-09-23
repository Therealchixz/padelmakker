/**
 * Laesbarhed og trykflader.
 *
 * Maalt 23. sep. 2026 paa forside, login og opret i telefonstoerrelse:
 *   - I moerk tilstand stod hvid tekst paa den primaere knap med 2,5:1.
 *     WCAG AA kraever 4,5:1. Knappen er det vigtigste element i appen.
 *   - 18 af 21 trykflader paa forsiden var under 44x44 px. Apple anbefaler
 *     44, Google 48. "Log ind" var 39 px hoej, menuknappen 38x38.
 *
 * Testene regner kontrasten ud fra den RIGTIGE palet, saa en fremtidig
 * farveaendring der bryder laesbarheden, fanges her og ikke af en bruger.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { btn } from '../../src/lib/platformTheme.js';
import { circleBtn } from '../../src/lib/onboardingStyles.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const css = readFileSync(join(root, 'src/styles/variables.css'), 'utf8');

/** Klip en regel ud af stilarket, fx :root eller [data-theme="dark"]. */
function palet(vaelger) {
  const i = css.indexOf(vaelger);
  assert.ok(i >= 0, `fandt ikke ${vaelger} i variables.css`);
  const start = css.indexOf('{', i);
  let dybde = 0;
  let k = start;
  while (k < css.length) {
    if (css[k] === '{') dybde++;
    else if (css[k] === '}' && --dybde === 0) break;
    k++;
  }
  const ud = {};
  for (const m of css.slice(start, k).matchAll(/(--pm-[a-z0-9-]+)\s*:\s*(#[0-9A-Fa-f]{3,8})/g)) {
    ud[m[1]] = m[2];
  }
  return ud;
}

const LYS = palet(':root');
const MOERK = palet('[data-theme="dark"]');

/** WCAG 2.1 relativ luminans. */
function luminans(hex) {
  let h = hex.replace('#', '');
  if (h.length === 3) h = [...h].map((c) => c + c).join('');
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = parseInt(h.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function kontrast(a, b) {
  const x = luminans(a);
  const y = luminans(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

// --- Laesbarhed ---------------------------------------------------------

test('kontrast-regnestykket stemmer med kendte vaerdier', () => {
  // Sanity: sort paa hvid er 21:1, hvid paa hvid er 1:1.
  assert.equal(Math.round(kontrast('#000000', '#FFFFFF')), 21);
  assert.equal(Math.round(kontrast('#FFFFFF', '#FFFFFF')), 1);
});

test('der findes en separat farve til udfyldte flader', () => {
  // --pm-accent er lys i moerk tilstand, fordi den bruges til links. Udfyldte
  // flader med hvid tekst har derfor brug for deres egen, moerkere farve.
  assert.ok(LYS['--pm-accent-solid'], 'mangler i lys palet');
  assert.ok(MOERK['--pm-accent-solid'], 'mangler i moerk palet');
});

test('lys tilstand er farvemaessigt uaendret', () => {
  // Den nye variabel har samme vaerdi som accenten i lys tilstand, saa
  // aendringen kan ikke flytte en eneste farve der.
  assert.equal(LYS['--pm-accent-solid'], LYS['--pm-accent']);
});

for (const [navn, p] of [['lys', LYS], ['moerk', MOERK]]) {
  test(`${navn}: hvid tekst paa den primaere knap er laesbar`, () => {
    const k = kontrast(p['--pm-on-accent'] || LYS['--pm-on-accent'], p['--pm-accent-solid']);
    assert.ok(k >= 4.5, `kontrast ${k.toFixed(1)}:1, WCAG AA kraever 4,5:1`);
  });

  test(`${navn}: knappen kan ses som form mod baggrunden`, () => {
    // WCAG 1.4.11: en knaps flade skal staa mindst 3:1 mod det, den ligger paa.
    const k = kontrast(p['--pm-accent-solid'], p['--pm-bg'] || LYS['--pm-bg']);
    assert.ok(k >= 3, `kontrast ${k.toFixed(1)}:1, kraever 3:1`);
  });

  test(`${navn}: broedtekst er laesbar`, () => {
    const k = kontrast(p['--pm-text'] || LYS['--pm-text'], p['--pm-bg'] || LYS['--pm-bg']);
    assert.ok(k >= 4.5, `kontrast ${k.toFixed(1)}:1`);
  });
}

test('udfyldte flader bruger knapfarven, ikke link-accenten', () => {
  // 23 CSS-regler havde accent-baggrund med hvid tekst. I moerk tilstand
  // laeste de alle 2,5:1.
  const r = readFileSync(join(root, 'src/responsive.css'), 'utf8');
  const daarlige = [];
  for (const m of r.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const krop = m[2];
    if (!krop.includes('--pm-on-accent')) continue;
    if (/background[^;]*var\(--pm-accent\)/.test(krop)) {
      daarlige.push(m[1].trim().split('\n').pop().trim());
    }
  }
  assert.deepEqual(daarlige, [], 'disse regler har hvid tekst paa link-accenten');
});

test('logoet skifter i moerk tilstand paa alle sider der viser det', () => {
  for (const fil of [
    'src/pages/LoginPage.jsx',
    'src/pages/CompleteProfilePage.jsx',
    'src/pages/LandingPage.jsx',
    'src/dashboard/DashboardPage.jsx',
  ]) {
    const s = readFileSync(join(root, fil), 'utf8');
    if (!s.includes('logo-brand')) continue;
    assert.match(s, /logo-brand-dark\.png/, `${fil}: bruger ikke det moerke logo`);
  }
});

// --- Trykflader ---------------------------------------------------------

test('knapper uden stoerrelsesvalg er mindst 44px', () => {
  // Det var her "Log ind" (39px) og "Fortsaet med Google" (40px) laa.
  assert.equal(btn(true).minHeight, '44px');
  assert.equal(btn(false).minHeight, '44px');
});

test('store og mellem knapper er mindst 44px', () => {
  assert.equal(btn(true, { size: 'lg' }).minHeight, '46px');
  assert.equal(btn(true, { size: 'md' }).minHeight, 'var(--pm-control-h)');
  assert.match(css, /--pm-control-h:\s*44px/, 'kontrolhoejden skal vaere 44px');
});

test('smaa knapper er over WCAG-minimum', () => {
  // 40 frem for 44 med vilje: bruges til taette filter-chips. WCAG 2.5.8
  // kraever 24, saa der er god margin.
  const h = parseInt(btn(true, { size: 'sm' }).minHeight, 10);
  assert.ok(h >= 40, `sm-knapper er ${h}px`);
});

test('en eksplicit hoejde vinder stadig over standarden', () => {
  assert.equal(btn(true, { minHeight: '52px' }).minHeight, '52px');
});

test('ikon-knapperne i oprettelsen kan rammes', () => {
  assert.ok(circleBtn.width >= 44, `bredde ${circleBtn.width}`);
  assert.ok(circleBtn.height >= 44, `hoejde ${circleBtn.height}`);
});

test('menuknappen paa forsiden kan rammes', () => {
  const r = readFileSync(join(root, 'src/responsive.css'), 'utf8');
  const i = r.indexOf('.pm-landing-hamburger {\n    display: flex;');
  assert.ok(i > 0, 'fandt ikke menuknappens regel');
  const blok = r.slice(i, i + 500);
  assert.match(blok, /min-width:\s*44px/, 'mangler min-width');
  assert.match(blok, /min-height:\s*44px/, 'mangler min-height');
});
