import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { URL } from 'node:url';

const componentUrl = new URL('../../src/components/DateInputField.jsx', import.meta.url);
const cssUrl = new URL('../../src/responsive.css', import.meta.url);
const ligaUrl = new URL('../../src/dashboard/LigaTab.jsx', import.meta.url);

test('DateInputField uses text display + off-screen native date picker', async () => {
  const source = await readFile(componentUrl, 'utf8');

  assert.match(source, /type="text"/);
  assert.match(source, /pm-date-field__display/);
  assert.match(source, /type="date"/);
  assert.match(source, /pm-date-field__native/);
  assert.match(source, /showPicker/);
  assert.match(source, /placeholder="dd-mm-åååå"/);
  assert.doesNotMatch(source, /type="date"[\s\S]{0,80}pm-date-field__input--empty/);
  assert.doesNotMatch(source, /pm-date-field__clip/);
});

test('date field CSS has no Safari widen hack', async () => {
  const css = await readFile(cssUrl, 'utf8');

  assert.match(css, /\.pm-date-field__display/);
  assert.match(css, /\.pm-date-field__native/);
  assert.doesNotMatch(css, /calc\(100% \+ 3rem\)/);
  assert.doesNotMatch(css, /pm-date-field__hint/);
});

test('liga create form uses DateInputField inside create anchor card', async () => {
  const liga = await readFile(ligaUrl, 'utf8');

  assert.match(liga, /pm-create-form-anchor/);
  assert.match(liga, /DateInputField/);
});

test('formatIsoForDisplay maps YYYY-MM-DD to dd-mm-yyyy', async () => {
  const source = await readFile(componentUrl, 'utf8');
  assert.match(source, /`\$\{m\[3\]\}-\$\{m\[2\]\}-\$\{m\[1\]\}`/);
});
