import test from 'node:test';
import assert from 'node:assert/strict';
import { shareResultToastMessage } from '../../src/lib/shareFeedback.js';

test('shareResultToastMessage maps clipboard and share outcomes', () => {
  assert.equal(shareResultToastMessage({ ok: true, method: 'clipboard' }), 'Link kopieret — send det til dine makkere!');
  assert.equal(shareResultToastMessage({ ok: true, method: 'share' }), 'Delt!');
  assert.equal(shareResultToastMessage({ ok: false, method: 'none' }), null);
  assert.match(shareResultToastMessage({ ok: false, method: 'none', error: 'x' }), /x/);
});
