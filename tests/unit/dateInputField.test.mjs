import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { URL } from 'node:url';

const componentUrl = new URL('../../src/components/DateInputField.jsx', import.meta.url);
const cssUrl = new URL('../../src/responsive.css', import.meta.url);

test('DateInputField uses facade + transparent date overlay for taps', async () => {
  const source = await readFile(componentUrl, 'utf8');

  assert.match(source, /pm-date-field__facade/);
  assert.match(source, /pm-date-field__overlay/);
  // Datofelt som standard; type="time" giver samme facade med 24-timers ur.
  assert.match(source, /type = 'date'/);
  assert.match(source, /'time' : 'date'/);
  assert.doesNotMatch(source, /showPicker/);
  assert.doesNotMatch(source, /left:\s*-9999px/);
});

test('date overlay CSS covers full field and stays tappable', async () => {
  const css = await readFile(cssUrl, 'utf8');

  assert.match(css, /\.pm-date-field__overlay[\s\S]*position:\s*absolute/);
  assert.match(css, /\.pm-date-field__overlay[\s\S]*inset:\s*0/);
  const overlayBlock = css.match(/\.pm-date-field__overlay\s*\{[^}]+\}/)?.[0] ?? '';
  assert.doesNotMatch(overlayBlock, /pointer-events:\s*none/);
});

test('formatIsoForDisplay maps YYYY-MM-DD to dd.mm.yyyy', async () => {
  const source = await readFile(componentUrl, 'utf8');
  assert.match(source, /`\$\{m\[3\]\}\.\$\{m\[2\]\}\.\$\{m\[1\]\}`/);
});

test('datofelter bruger den danske facade i stedet for browserens format', async () => {
  // Det indbyggede felt viser datoen i telefonens sprog (09/23/2026 på engelsk).
  const files = [
    '../../src/components/kampe/CreateMatchForm.jsx',
    '../../src/features/americano/CreateAmericanoTournamentForm.tsx',
    '../../src/dashboard/BeskedTab.jsx',
    '../../src/dashboard/BanerTab.jsx',
  ];
  for (const rel of files) {
    const source = await readFile(new URL(rel, import.meta.url), 'utf8');
    assert.doesNotMatch(source, /<input\s+type="(date|time)"/, rel);
    assert.match(source, /<DateInputField/, rel);
  }
});
