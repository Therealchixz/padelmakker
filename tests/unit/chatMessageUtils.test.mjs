import test from 'node:test';
import assert from 'node:assert/strict';
import {
  enrichChatMessageSender,
  normalizeChatMessage,
} from '../../src/lib/chatMessageUtils.js';

test('normalizeChatMessage marks them/me without requiring sender_name', () => {
  const them = normalizeChatMessage(
    { id: '1', sender_id: 'other', content: 'hej', created_at: '2026-07-29T10:00:00Z' },
    'me',
  );
  assert.equal(them.from, 'them');
  assert.equal(them.senderName, undefined);
  assert.equal(them.senderAvatar, undefined);

  const mine = normalizeChatMessage(
    { id: '2', sender_id: 'me', content: 'yo', created_at: '2026-07-29T10:01:00Z' },
    'me',
  );
  assert.equal(mine.from, 'me');
});

test('enrichChatMessageSender fills DM avatar/name from profilesById', () => {
  const base = normalizeChatMessage(
    {
      id: '1',
      sender_id: 'kevin',
      message_type: 'match_invite',
      payload: { title: 'Kamp' },
      created_at: '2026-07-29T10:00:00Z',
    },
    'me',
  );
  const enriched = enrichChatMessageSender(base, {
    userId: 'me',
    profilesById: {
      kevin: { full_name: 'Kevin Rastung', avatar: '🎾' },
    },
  });
  assert.equal(enriched.senderName, 'Kevin Rastung');
  assert.equal(enriched.senderAvatar, '🎾');
});

test('enrichChatMessageSender uses selfProfile for own messages', () => {
  const base = normalizeChatMessage(
    { id: '2', sender_id: 'me', content: 'hej', created_at: '2026-07-29T10:00:00Z' },
    'me',
  );
  const enriched = enrichChatMessageSender(base, {
    userId: 'me',
    selfProfile: { id: 'me', full_name: 'Mig Selv', avatar: 'https://example.com/a.jpg' },
  });
  assert.equal(enriched.senderName, 'Mig Selv');
  assert.equal(enriched.senderAvatar, 'https://example.com/a.jpg');
});

test('enrichChatMessageSender keeps existing sender fields', () => {
  const base = normalizeChatMessage(
    {
      id: '3',
      sender_id: 'kevin',
      sender_name: 'Allerede sat',
      sender_avatar: '🔥',
      content: 'hej',
      created_at: '2026-07-29T10:00:00Z',
    },
    'me',
  );
  const enriched = enrichChatMessageSender(base, {
    userId: 'me',
    profilesById: {
      kevin: { full_name: 'Kevin', avatar: '🎾' },
    },
  });
  assert.equal(enriched.senderName, 'Allerede sat');
  assert.equal(enriched.senderAvatar, '🔥');
});
