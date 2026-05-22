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
  assert.match(source, /type="date"/);
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

test('formatIsoForDisplay maps YYYY-MM-DD to dd-mm-yyyy', async () => {
  const source = await readFile(componentUrl, 'utf8');
  assert.match(source, /`\$\{m\[3\]\}-\$\{m\[2\]\}-\$\{m\[1\]\}`/);
});
