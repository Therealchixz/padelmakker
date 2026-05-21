#!/usr/bin/env node
/**
 * Fejler hvis nye hardcodede hex-farver findes i JSX/TSX (undtagen kommentarer).
 * CSS-filer og variables.css er tilladt.
 */
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const SRC = path.join(ROOT, 'src');
const HEX_RE = /#[0-9A-Fa-f]{3,8}\b/g;
/** Brand SVG fills (Google) — exempt until replaced with CSS masks */
const ALLOWED_FILES = new Set([
  'src/components/OAuthButtons.jsx',
]);

async function walk(dir, out = []) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) await walk(p, out);
    else if (/\.(jsx|tsx)$/.test(e.name)) out.push(p);
  }
  return out;
}

const files = await walk(SRC);
const violations = [];

for (const file of files) {
  const rel = path.relative(ROOT, file).replace(/\\/g, '/');
  if (ALLOWED_FILES.has(rel)) continue;
  const text = await readFile(file, 'utf8');
  const lines = text.split('\n');
  lines.forEach((line, i) => {
    const trimmed = line.trim();
    if (trimmed.startsWith('//') || trimmed.startsWith('*')) return;
    const matches = line.match(HEX_RE);
    if (matches) {
      for (const m of matches) {
        violations.push({ rel, line: i + 1, hex: m });
      }
    }
  });
}

const strict = process.env.STRICT === '1';

if (violations.length) {
  const log = strict ? console.error : console.warn;
  log(`UI hex check: ${violations.length} hardcoded color(s) in JSX/TSX${strict ? '' : ' (warning — set STRICT=1 to fail)'}:\n`);
  for (const v of violations.slice(0, 40)) {
    log(`  ${v.rel}:${v.line}  ${v.hex}`);
  }
  if (violations.length > 40) log(`  … and ${violations.length - 40} more`);
  log('\nUse theme.* or CSS variables — see docs/UI_GUIDELINES.md');
  if (strict) process.exit(1);
} else {
  console.log('UI hex check: OK (no #hex in jsx/tsx)');
}
