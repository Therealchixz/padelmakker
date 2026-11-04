import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

// theme.* er CSS-variabler ("var(--pm-accent)"). At sætte en hex-alpha bagpå
// ("var(--pm-accent)44") giver ugyldig CSS, så browseren falder tilbage til
// tekstfarven (fx en kulsort ramme eller kulsorte trin-tal). Brug i stedet
// color-mix(in srgb, ${theme.x} 27%, transparent).
test('ingen hex-alpha sat bag på theme-farver (ugyldig CSS)', () => {
  const files = execSync('git ls-files src', { encoding: 'utf8' })
    .split('\n')
    .filter((f) => /\.(jsx?|tsx?)$/.test(f));
  const bad = [];
  const concat = /theme\.[a-zA-Z]+ \+ (['"])[0-9a-fA-F]{2}\1/;
  const tmpl = /\$\{theme\.[a-zA-Z]+\}[0-9a-fA-F]{2}\b/;
  for (const f of files) {
    readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
      if (concat.test(line) || tmpl.test(line)) bad.push(`${f}:${i + 1}`);
    });
  }
  assert.deepEqual(bad, []);
});
