import fs from 'fs';
import path from 'path';

const ROOTS = ['src', 'tests', 'public', 'index.html'];
const exts = new Set(['.jsx', '.tsx', '.js', '.ts', '.css', '.html', '.md', '.sql', '.json']);
const findings = [];

function walk(target) {
  const stat = fs.existsSync(target) ? fs.statSync(target) : null;
  if (!stat) return;
  if (stat.isFile()) {
    if (exts.has(path.extname(target)) || target.endsWith('index.html')) scan(target);
    return;
  }
  for (const ent of fs.readdirSync(target, { withFileTypes: true })) {
    const p = path.join(target, ent.name);
    if (ent.isDirectory()) {
      if (ent.name === 'node_modules' || ent.name === 'dist') continue;
      walk(p);
    } else if (exts.has(path.extname(ent.name))) {
      scan(p);
    }
  }
}

function scan(file) {
  const buf = fs.readFileSync(file);
  let text;
  try {
    text = buf.toString('utf8');
    if (Buffer.from(text, 'utf8').compare(buf) !== 0) {
      findings.push({ file, line: 0, kind: 'INVALID_UTF8', snippet: 'File contains invalid UTF-8 byte sequences' });
      return;
    }
  } catch {
    findings.push({ file, line: 0, kind: 'INVALID_UTF8', snippet: 'Could not decode as UTF-8' });
    return;
  }

  const lines = text.split(/\r?\n/);
  lines.forEach((line, i) => {
    const n = i + 1;
    const add = (kind, snippet = line.trim().slice(0, 140)) =>
      findings.push({ file, line: n, kind, snippet });

    if (line.includes('\uFFFD')) add('REPLACEMENT_CHAR');

    // String literal '??' or "??"
    if (/(['"])\?\?\1/.test(line)) add('LITERAL_DOUBLE_QUESTION');

    if (/Se detaljer \?(?!>)/.test(line)) add('BROKEN_ARROW');
    if (/(?<![\w])\.?\? Niveau/.test(line)) add('BROKEN_NIVEAU');
    if (/>= 0 \? '\+' : '\?'/.test(line)) add('BROKEN_MINUS');

    // Mojibake in user-facing strings (skip normalize/replace handlers)
    if (!/\.replace\(/.test(line) && /Ã.|â€|Â·|Â |ï¿½/.test(line)) add('MOJIBAKE');

    // User-visible "proev" instead of "prøv" (ASCII fallback corruption)
    if (/proev(?!er)/i.test(line) && /showPushMessage|toast|message|label|title|placeholder|aria-/i.test(line)) {
      add('ASCII_DANISH', line.match(/proev[^'"]*/i)?.[0] || line.trim());
    }
  });
}

for (const root of ROOTS) walk(root);

const seen = new Set();
const unique = findings.filter((f) => {
  const k = `${f.file}:${f.line}:${f.kind}:${f.snippet}`;
  if (seen.has(k)) return false;
  seen.add(k);
  return true;
});

if (unique.length === 0) {
  console.log('OK: No corrupted character patterns found.');
} else {
  for (const f of unique) {
    console.log(`${f.file}:${f.line} [${f.kind}] ${f.snippet}`);
  }
  console.error(`\nTotal: ${unique.length}`);
  process.exitCode = 1;
}
