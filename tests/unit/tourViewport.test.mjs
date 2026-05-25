import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const dir = dirname(fileURLToPath(import.meta.url));
const hook = readFileSync(join(dir, '../../src/hooks/useGuidedTour.js'), 'utf8');

test('guided tour detects mobile viewport before first render', () => {
  assert.match(hook, /useState\(detectIsMobileView\)/);
  assert.match(hook, /setIsMobileView\(detectIsMobileView\(\)\)/);
});
