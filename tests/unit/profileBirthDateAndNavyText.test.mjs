import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { URL, fileURLToPath } from 'node:url';

const read = (rel) => readFile(new URL(`../../${rel}`, import.meta.url), 'utf8');

test('rediger profil udfylder fødselsdag/-måned fra egen auth-metadata', async () => {
  const helpers = await read('src/dashboard/profileTabHelpers.jsx');
  assert.match(helpers, /export function profileFormState\(p, authMeta = \{\}\)/);
  assert.match(helpers, /p\.birth_month \?\? authMeta\?\.birth_month/);
  assert.match(helpers, /p\.birth_day \?\? authMeta\?\.birth_day/);

  const tab = await read('src/dashboard/ProfilTab.jsx');
  assert.doesNotMatch(tab, /profileFormState\(user\)/, 'alle kald skal give auth-metadata med');
});

test('tomme fødselsdags-felter overskriver ikke den gemte dato', async () => {
  const tab = await read('src/dashboard/ProfilTab.jsx');
  assert.doesNotMatch(tab, /birth_month:\s*form\.birth_month\s*\?[^:]*:\s*null/);
  assert.doesNotMatch(tab, /birth_day:\s*form\.birth_day\s*\?[^:]*:\s*null/);
  assert.match(tab, /\.\.\.\(form\.birth_month \? \{ birth_month:/);
  assert.match(tab, /\.\.\.\(form\.birth_day \? \{ birth_day:/);
});

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(jsx|tsx|css)$/.test(name)) out.push(p);
  }
  return out;
}

test('navy bruges ikke som tekstfarve (1,3:1 i mørk tilstand)', async () => {
  const src = fileURLToPath(new URL('../../src', import.meta.url));
  const offenders = [];
  for (const file of walk(src)) {
    const text = await readFile(file, 'utf8');
    text.split('\n').forEach((line, i) => {
      const navyText = /(^|[\s{,;])color:\s*(theme\.navy\b|['"]?var\(--pm-navy\))/.test(line)
        || /(^|[\s{,;])color:[^;]*\?\s*theme\.navy\b/.test(line);
      // Tekst på den lyse navy-bg-flade er læsbar i begge tilstande.
      const onNavyBg = /navyBg|--pm-navy-bg/.test(line);
      if (navyText && !onNavyBg) offenders.push(`${file.replace(src, 'src')}:${i + 1}`);
    });
  }
  assert.deepEqual(offenders, [], 'brug theme.accent / var(--pm-accent) til tekst');
});
