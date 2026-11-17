import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');

// Ejeren 17. nov. 2026: knapper helt runde, kort 22, felter og smaa bokse 14 (god praksis + H-prototyperne).
test('faste hjørner: kort 22, felter 14, knapper helt runde', () => {
  const vars = read('src/styles/variables.css');
  assert.match(vars, /--pm-radius-sm:\s+14px/);
  assert.match(vars, /--pm-radius-lg:\s+22px/);
  assert.match(vars, /--pm-radius-pill:\s+999px/);
  assert.match(read('src/lib/platformTheme.js'), /radius = 'pill'/);
});
