import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

/**
 * Alarm-workflowen udpeger de workflows den overvåger VED NAVN. Staver man et
 * navn forkert, udløses alarmen aldrig — og man opdager det først næste gang
 * noget fejler i tavshed, hvilket er præcis det den skal forhindre.
 *
 * (Det skete under udviklingen: "Deploy Supabase functions" med lille f, hvor
 * den rigtige hedder "Deploy Supabase Functions".)
 */

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const WF_DIR = join(ROOT, '.github/workflows');
const ALARM = join(WF_DIR, 'alert-on-failure.yml');

/** Navnet på hver workflow, som GitHub ser det. */
function workflowNames() {
  const names = new Map();
  for (const f of readdirSync(WF_DIR).filter((x) => x.endsWith('.yml') || x.endsWith('.yaml'))) {
    const m = readFileSync(join(WF_DIR, f), 'utf8').match(/^name:\s*["']?(.+?)["']?\s*$/m);
    if (m) names.set(m[1], f);
  }
  return names;
}

/** De navne alarmen lytter efter. */
function watchedNames() {
  const text = readFileSync(ALARM, 'utf8');
  const block = text.match(/workflows:\s*\n((?:\s*-\s*.+\n)+)/);
  if (!block) return [];
  return block[1]
    .split('\n')
    .map((l) => l.replace(/^\s*-\s*/, '').trim())
    .filter(Boolean);
}

test('alarmen overvåger mindst de to workflows der kører uden tilskuer', () => {
  const watched = watchedNames();
  assert.ok(watched.includes('Apply Supabase migrations'), 'migrationsdeploy skal overvåges');
  assert.ok(watched.includes('Deploy Supabase Functions'), 'edge-function-deploy skal overvåges');
});

test('hvert overvåget navn matcher en faktisk workflow', () => {
  const findes = workflowNames();
  for (const navn of watchedNames()) {
    assert.ok(
      findes.has(navn),
      `Alarmen lytter efter "${navn}", men ingen workflow hedder det. Findes: ${[...findes.keys()].join(', ')}`,
    );
  }
});

test('alarmen reagerer kun på fejl, og kun på main', () => {
  const text = readFileSync(ALARM, 'utf8');
  assert.match(text, /conclusion == 'failure'/);
  assert.match(text, /head_branch == 'main'/);
});

test('alarmen har lov til at oprette issues', () => {
  assert.match(readFileSync(ALARM, 'utf8'), /permissions:\s*\n\s*issues:\s*write/);
});
