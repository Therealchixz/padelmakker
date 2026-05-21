import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const dir = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(dir, '../../src/lib/seekingActivityLabel.js'), 'utf8');

test('seekingActivityLabel skelner kamp, makker og begge', () => {
  assert.match(src, /søger kamp og makker/);
  assert.match(src, /if \(makkerOn\) return 'søger makker'/);
  assert.match(src, /if \(matchOn\) return 'søger kamp'/);
});
