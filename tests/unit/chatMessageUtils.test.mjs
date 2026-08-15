import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildMatchInvitePayload,
  enrichChatMessageSender,
  matchInviteJoinKind,
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

test('buildMatchInvitePayload marks closed matches as closed unless full', () => {
  const closed = buildMatchInvitePayload({
    id: 'm1',
    date: '2026-08-20',
    time: '18:00',
    court_name: 'Padelhuset',
    match_type: 'closed',
    status: 'open',
    max_players: 4,
    current_players: 2,
  });
  assert.equal(closed.status, 'closed');
  assert.equal(closed.match_type, 'closed');
  assert.equal(matchInviteJoinKind(closed), 'request');

  const fullClosed = buildMatchInvitePayload({
    id: 'm2',
    date: '2026-08-20',
    time: '18:00',
    court_name: 'Padelhuset',
    match_type: 'closed',
    status: 'full',
    max_players: 4,
    current_players: 4,
  });
  assert.equal(fullClosed.status, 'full');
  assert.equal(matchInviteJoinKind(fullClosed), 'full');

  const open = buildMatchInvitePayload({
    id: 'm3',
    date: '2026-08-20',
    time: '18:00',
    court_name: 'Padelhuset',
    match_type: 'open',
    status: 'open',
    max_players: 4,
    current_players: 1,
  });
  assert.equal(open.status, 'open');
  assert.equal(matchInviteJoinKind(open), 'join');
});
