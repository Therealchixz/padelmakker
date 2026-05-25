import test from 'node:test';
import assert from 'node:assert/strict';
import { intentDisplayLabel } from '../../src/lib/platformConstants.js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');

test('intentDisplayLabel shows Træning for legacy and canonical keys', () => {
  assert.equal(intentDisplayLabel('træning'), 'Træning');
  assert.equal(intentDisplayLabel('traening'), 'Træning');
  assert.equal(intentDisplayLabel('hygge'), 'Hygge');
});

test('describeMakkerFilter uses intentDisplayLabel for summary text', () => {
  const core = readFileSync(join(root, 'src/lib/makkerSearchFilterCore.js'), 'utf8');
  assert.match(core, /intentDisplayLabel\(k\)/);
});
