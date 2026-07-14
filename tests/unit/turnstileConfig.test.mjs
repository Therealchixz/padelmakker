import test from 'node:test';
import assert from 'node:assert/strict';
import { getTurnstileSiteKey, isTurnstileEnabled } from '../../src/lib/turnstileConfig.js';

test('turnstile helpers return string and boolean', () => {
  assert.equal(typeof getTurnstileSiteKey(), 'string');
  assert.equal(typeof isTurnstileEnabled(), 'boolean');
  assert.equal(isTurnstileEnabled(), getTurnstileSiteKey().length > 0);
});
