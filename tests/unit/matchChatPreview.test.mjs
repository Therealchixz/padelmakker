import test from 'node:test';
import assert from 'node:assert/strict';

import { formatMatchChatPreview } from '../../src/lib/matchChatPreview.js';

test('formatMatchChatPreview viser fornavn og besked', () => {
  assert.equal(
    formatMatchChatPreview({ sender_id: 'k', sender_name: 'Kevin Nielsen', content: 'Er vi klar til i aften?' }, 'me'),
    'Kevin: Er vi klar til i aften?',
  );
});

test('formatMatchChatPreview bruger Dig for egne beskeder', () => {
  assert.equal(
    formatMatchChatPreview({ sender_id: 'me', sender_name: 'Mike', content: 'Ses' }, 'me'),
    'Dig: Ses',
  );
});

test('formatMatchChatPreview har fallback uden beskeder', () => {
  assert.equal(formatMatchChatPreview(null, 'me'), 'Ingen beskeder endnu');
});
