import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  KAMPE_CREATE_PLUS_HINT,
  kampeCreateHint,
} from '../../src/lib/kampeCreateHint.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');

test('kampeCreateHint nævner + når indlejret under Kampe', () => {
  assert.match(kampeCreateHint('liga', { embedInKampe: true }), /\+ øverst til højre/);
  assert.match(kampeCreateHint('padel', { embedInKampe: true }), /\+ øverst til højre/);
  assert.match(KAMPE_CREATE_PLUS_HINT.americano, /\+ øverst til højre/);
});

test('tom-tilstande refererer ikke længere til "knappen Opret liga"', () => {
  const liga = readFileSync(join(root, 'src/dashboard/LigaTab.jsx'), 'utf8');
  assert.doesNotMatch(liga, /knappen Opret liga/);
  assert.match(liga, /kampeCreateHint\('liga'/);
});
