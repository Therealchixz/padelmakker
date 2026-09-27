/**
 * Ejeren 27. sep. 2026: "datoerne og starttidernes tal har forskellige størrelser".
 * På telefoner tvinges input/select op på 16px (iOS zoom-fix), så dato-feltets
 * facade (en div) skal med i samme regel.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');

test('dato-feltets tekst har samme størrelse som andre felter på telefon', () => {
  const css = readFileSync(join(root, 'src/responsive.css'), 'utf8');
  const i = css.indexOf('@media (hover: none) and (pointer: coarse) {\n  input,');
  assert.ok(i > 0);
  const block = css.slice(i, css.indexOf('}\n}', i));
  assert.match(block, /\.pm-date-field__facade \{\s*font-size: 16px !important;/);
});
