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

// En kommentar uden afslutning slugte farverne roed/groen i lys tilstand (17. nov. 2026).
test('variables.css: kommentarer lukkes, og grøn/rød findes i lys tilstand', () => {
  const vars = read('src/styles/variables.css');
  let i = 0;
  for (;;) {
    const a = vars.indexOf('/*', i);
    if (a < 0) break;
    const b = vars.indexOf('*/', a + 2);
    const next = vars.indexOf('/*', a + 2);
    assert.ok(b > 0 && (next < 0 || next > b), `kommentar uden afslutning ved tegn ${a}`);
    i = b + 2;
  }
  const light = vars.slice(0, vars.indexOf('[data-theme="dark"]'));
  for (const name of ['--pm-green', '--pm-green-bg', '--pm-red-bg', '--pm-red-solid']) {
    assert.match(light, new RegExp(`${name}:\\s+#`), name);
  }
});
