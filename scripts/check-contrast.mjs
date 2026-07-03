/* Kontrast-audit: finder tekst/baggrund-par med lav WCAG-kontrast i light+dark.
   Dækker: tag(bg, fg)-kald, inline style-objekter og responsive.css-regler. */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();

// ---- 1) Token-værdier fra variables.css (light + dark) ----
const varsCss = readFileSync(join(ROOT, 'src/styles/variables.css'), 'utf8');
function parseBlock(afterIdx) {
  const map = {};
  const block = varsCss.slice(afterIdx, varsCss.indexOf('}', afterIdx) + 4000);
  // læs indtil blokkens afsluttende '}' på top-niveau: tag simpelt frem til '\n}'
  const end = block.indexOf('\n}');
  for (const m of block.slice(0, end).matchAll(/--pm-([a-z0-9-]+):\s*(#[0-9A-Fa-f]{3,8})\s*;/g)) {
    map[`--pm-${m[1]}`] = m[2];
  }
  return map;
}
const rootIdx = varsCss.indexOf(':root');
const darkIdx = varsCss.indexOf('[data-theme="dark"]');
const light = parseBlock(rootIdx);
const darkOverrides = parseBlock(darkIdx);
const dark = { ...light, ...darkOverrides };

// ---- 2) theme.X → var(--pm-Y) fra platformTheme.js ----
const themeSrc = readFileSync(join(ROOT, 'src/lib/platformTheme.js'), 'utf8');
const themeMap = {};
for (const m of themeSrc.matchAll(/^\s*(\w+):\s*'var\((--pm-[a-z0-9-]+)\)'/gm)) {
  themeMap[m[1]] = m[2];
}

// ---- 3) Farve-matematik ----
function hexToRgb(hex) {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  if (h.length === 8) h = h.slice(0, 6); // ignorer alpha
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function luminance(hex) {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(fgHex, bgHex) {
  const l1 = luminance(fgHex);
  const l2 = luminance(bgHex);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

// ---- 4) Opløs et token-udtryk til hex i et tema ----
function resolveToken(expr, theme) {
  const e = expr.trim().replace(/['"`]/g, '');
  let varName = null;
  const vm = e.match(/^var\((--pm-[a-z0-9-]+)\)$/);
  if (vm) varName = vm[1];
  const tm = e.match(/^theme\.(\w+)$/);
  if (tm) varName = themeMap[tm[1]] || null;
  if (e.startsWith('#')) return e;
  if (!varName) return null; // gradients, color-mix, transparent, ukendt
  return theme[varName] || null;
}

// ---- 5) Scan filer ----
function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* walk(p);
    else if (/\.(jsx|tsx)$/.test(name)) yield p;
  }
}

const findings = [];
function check(file, line, fgExpr, bgExpr, snippet) {
  const pairs = [
    ['light', resolveToken(fgExpr, light), resolveToken(bgExpr, light)],
    ['dark', resolveToken(fgExpr, dark), resolveToken(bgExpr, dark)],
  ];
  for (const [mode, fg, bg] of pairs) {
    if (!fg || !bg) continue;
    const r = contrast(fg, bg);
    if (r < 3) {
      findings.push({ file: file.replace(ROOT + '/', ''), line, mode, ratio: r.toFixed(2), fg: `${fgExpr.trim()}→${fg}`, bg: `${bgExpr.trim()}→${bg}`, snippet: snippet.trim().slice(0, 110) });
    }
  }
}

for (const file of walk(join(ROOT, 'src'))) {
  const lines = readFileSync(file, 'utf8').split('\n');
  lines.forEach((ln, i) => {
    // a) tag(bg, fg)
    for (const m of ln.matchAll(/tag\(\s*([^,()]+),\s*([^,()]+)\s*\)/g)) {
      check(file, i + 1, m[2], m[1], ln);
    }
    // b) inline style på samme linje: background + color
    const bgM = ln.match(/background(?:Color)?:\s*([^,}]+)[,}]/);
    const fgM = ln.match(/(?<![a-zA-Z])color:\s*([^,}]+)[,}]/);
    if (bgM && fgM && !/background:\s*['"`]?(none|transparent)/.test(ln)) {
      check(file, i + 1, fgM[1], bgM[1], ln);
    }
    // c) chip-objekter: { color: X, bg: Y }
    const bgProp = ln.match(/\bbg:\s*([^,}]+)[,}]/);
    if (bgProp && fgM) check(file, i + 1, fgM[1], bgProp[1], ln);
  });
}

// d) responsive.css-regler med både color og background
const css = readFileSync(join(ROOT, 'src/responsive.css'), 'utf8');
const ruleRe = /([^{}]+)\{([^{}]+)\}/g;
let rm;
while ((rm = ruleRe.exec(css))) {
  const [_, selector, body] = rm;
  const fgM = body.match(/(?<![a-z-])color:\s*(var\(--pm-[a-z0-9-]+\))/);
  const bgM = body.match(/background(?:-color)?:\s*(var\(--pm-[a-z0-9-]+\))/);
  if (fgM && bgM) {
    const lineNo = css.slice(0, rm.index).split('\n').length;
    check(join(ROOT, 'src/responsive.css'), lineNo, fgM[1], bgM[1], selector.trim().split('\n').pop());
  }
}

findings.sort((a, b) => a.ratio - b.ratio);
console.log(`${findings.length} par med kontrast < 3.0:`);
for (const f of findings) {
  console.log(`${f.ratio}:1 [${f.mode}] ${f.file}:${f.line}  fg=${f.fg} bg=${f.bg}\n    ${f.snippet}`);
}
