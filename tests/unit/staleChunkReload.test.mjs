/**
 * Sentry-fejl fra ugerapporten (ejeren 26. sep. 2026):
 * - JAVASCRIPT-REACT-4: "'text/html' is not a valid JavaScript MIME type" på
 *   iOS, når appen var åben under en opdatering og hentede en gammel kodefil.
 * - JAVASCRIPT-REACT-9: "undefined is not an object (evaluating
 *   'e.style.setProperty')" i beskeder, fordi onBlur sendte et event videre.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  STALE_CHUNK_RELOAD_COOLDOWN_MS,
  isStaleChunkError,
  reloadOnceForStaleChunk,
} from '../../src/lib/staleChunkReload.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const read = (rel) => readFileSync(join(root, rel), 'utf8');

function memoryStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) };
}

test('genkender fejl fra en gammel kodefil (iOS, Chrome, Firefox)', () => {
  assert.equal(isStaleChunkError(new TypeError("'text/html' is not a valid JavaScript MIME type.")), true);
  assert.equal(isStaleChunkError(new TypeError('Importing a module script failed.')), true);
  assert.equal(isStaleChunkError(new TypeError('Failed to fetch dynamically imported module: https://x/assets/a.js')), true);
  assert.equal(isStaleChunkError(new TypeError("undefined is not an object (evaluating 'e.x')")), false);
});

test('genindlæser højst én gang pr. 30 sek. (intet loop)', () => {
  const storage = memoryStorage();
  let reloads = 0;
  const reload = () => { reloads += 1; };
  const err = new TypeError("'text/html' is not a valid JavaScript MIME type.");
  assert.equal(reloadOnceForStaleChunk(err, { storage, reload, now: 1_000 }), true);
  assert.equal(reloadOnceForStaleChunk(err, { storage, reload, now: 5_000 }), false);
  assert.equal(reloadOnceForStaleChunk(err, { storage, reload, now: 1_000 + STALE_CHUNK_RELOAD_COOLDOWN_MS + 1 }), true);
  assert.equal(reloads, 2);
  assert.equal(reloadOnceForStaleChunk(new Error('noget andet'), { storage, reload, now: 999_999 }), false);
});

test('uden lager genindlæses ikke (kan ikke sikre mod loop)', () => {
  const storage = { getItem: () => null, setItem: () => { throw new Error('blokeret'); } };
  assert.equal(reloadOnceForStaleChunk(new TypeError('Importing a module script failed.'), { storage, reload: () => {} }), false);
});

test('appen bruger det: vite:preloadError og ErrorBoundary', () => {
  assert.match(read('src/main.jsx'), /addEventListener\('vite:preloadError'/);
  assert.match(read('src/ErrorBoundary.jsx'), /reloadOnceForStaleChunk\(err/);
  // Manglende /assets/-filer skal ikke besvares med index.html.
  assert.match(read('vercel.json'), /"source": "\/\(\(\?!api\/\|assets\/\)\.\*\)"/);
});

test('beskeder: onBlur sender ikke eventet videre som element', () => {
  const src = read('src/dashboard/BeskedTab.jsx');
  assert.match(src, /onBlur=\{mobileChatActive \? \(\) => nudgeMobileChatViewportAfterKeyboard\(\) : undefined\}/);
  assert.match(read('src/lib/mobileChatViewport.js'), /if \(!root\?\.style\) root = document\.documentElement;/);
});
