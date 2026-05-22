import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { URL } from 'node:url';

const componentUrl = new URL('../../src/components/DateInputField.jsx', import.meta.url);
const cssUrl = new URL('../../src/responsive.css', import.meta.url);
const ligaUrl = new URL('../../src/dashboard/LigaTab.jsx', import.meta.url);

test('DateInputField puts visible box styles on clip wrapper, not on input', async () => {
  const source = await readFile(componentUrl, 'utf8');

  assert.match(source, /pm-date-field__box/);
  assert.match(source, /style=\{boxStyle\}/);
  assert.match(source, /inputInnerStyle/);
  assert.match(source, /padding:\s*'10px 2\.75rem 10px calc\(var\(--pm-space-2\) \+ 2px\)'/);
  assert.match(source, /border,\s*\n\s*borderRadius,\s*\n\s*background,\s*\n\s*padding/);
  assert.match(source, /style=\{inputInnerStyle\}/);
  assert.doesNotMatch(source, /calc\(100% \+/);
});

test('date field CSS avoids Safari widen hack and uses appearance none on input', async () => {
  const css = await readFile(cssUrl, 'utf8');

  assert.match(css, /\.pm-date-field__input[\s\S]*border:\s*none/);
  assert.doesNotMatch(css, /pm-date-field__input[\s\S]{0,120}padding:\s*0/);
  assert.match(css, /-webkit-appearance:\s*none/);
  assert.doesNotMatch(css, /calc\(100% \+ 3rem\)/);
  assert.doesNotMatch(css, /margin-right:\s*-3rem/);
});

test('liga create form uses DateInputField inside create anchor card', async () => {
  const liga = await readFile(ligaUrl, 'utf8');

  assert.match(liga, /pm-create-form-anchor/);
  assert.match(liga, /DateInputField/);
  assert.match(liga, /Startdato/);
});
