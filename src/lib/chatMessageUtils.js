export const CHAT_MESSAGE_TYPES = {
  TEXT: 'text',
  MATCH_INVITE: 'match_invite',
  VENUE_SHARE: 'venue_share',
  TIME_SUGGESTION: 'time_suggestion',
};

export function messagePreview(msg) {
  const type = msg?.message_type || msg?.messageType || CHAT_MESSAGE_TYPES.TEXT;
  const payload = msg?.payload || {};
  if (type === CHAT_MESSAGE_TYPES.MATCH_INVITE) {
    return payload.title || '🎾 Kamp-invitation';
  }
  if (type === CHAT_MESSAGE_TYPES.VENUE_SHARE) {
    return payload.venue ? `📍 ${payload.venue}` : '📍 Bane';
  }
  if (type === CHAT_MESSAGE_TYPES.TIME_SUGGESTION) {
    return payload.label ? `📅 ${payload.label}` : '📅 Tidforslag';
  }
  return msg?.content || msg?.text || '';
}

export function normalizeChatMessage(msg, userId) {
  if (!msg) return null;
  const messageType = msg.message_type || msg.messageType || CHAT_MESSAGE_TYPES.TEXT;
  const from = String(msg.sender_id || msg.senderId) === String(userId) ? 'me' : 'them';
  return {
    ...msg,
    id: msg.id,
    from,
    messageType,
    payload: msg.payload || null,
    reaction: msg.reaction || null,
    text: messageType === CHAT_MESSAGE_TYPES.TEXT ? (msg.content || msg.text || '') : '',
    content: msg.content || '',
    createdAt: msg.created_at || msg.createdAt,
    senderId: msg.sender_id || msg.senderId,
    senderName: msg.sender_name || msg.senderName,
    senderAvatar: msg.sender_avatar || msg.senderAvatar,
    status: msg.is_read ? 'read' : undefined,
  };
}

/**
 * DM-rækker har ikke sender_name/sender_avatar-kolonner — fyld fra profil-map.
 * @param {ReturnType<typeof normalizeChatMessage>} message
 * @param {{ profilesById?: Record<string, { full_name?: string, name?: string, avatar?: string }>, selfProfile?: { id?: string, full_name?: string, name?: string, avatar?: string }, userId?: string }} [opts]
 */
export function enrichChatMessageSender(message, opts = {}) {
  if (!message) return null;
  const { profilesById = null, selfProfile = null, userId = null } = opts;
  if (message.senderName && message.senderAvatar) return message;

  const sid = String(message.senderId || '');
  const selfId = String(userId || selfProfile?.id || '');
  const profile =
    sid && selfId && sid === selfId
      ? selfProfile
      : (sid && profilesById ? profilesById[sid] : null);

  if (!profile) return message;

  return {
    ...message,
    senderName: message.senderName || profile.full_name || profile.name || '',
    senderAvatar: message.senderAvatar || profile.avatar || null,
  };
}

export function formatMatchInviteTitle(match) {
  if (!match?.date) return 'Kamp-invitation';
  const d = new Date(`${match.date}T${match.time || '12:00'}`);
  const datePart = Number.isNaN(d.getTime())
    ? match.date
    : d.toLocaleDateString('da-DK', { weekday: 'long', day: 'numeric', month: 'short' });
  const timePart = match.time ? ` · ${String(match.time).slice(0, 5)}` : '';
  return `${datePart}${timePart}`;
}

export function buildMatchInvitePayload(match, playerCount = 0) {
  const max = Number(match?.max_players) || 4;
  const current = Number(playerCount || match?.current_players) || 0;
  const matchType = match?.match_type || 'open';
  const isFull = match?.status === 'full' || current >= max;
  const status = isFull ? 'full' : (matchType === 'closed' ? 'closed' : 'open');
  return {
    match_id: match.id,
    title: formatMatchInviteTitle(match),
    venue: match.court_name || 'Bane ikke angivet',
    players: `${current}/${max}`,
    status,
    match_type: matchType,
  };
}

/** @param {{ status?: string, match_type?: string } | null | undefined} invite */
export function matchInviteJoinKind(invite) {
  const status = String(invite?.status || '').toLowerCase();
  const matchType = String(invite?.match_type || '').toLowerCase();
  if (status === 'full') return 'full';
  if (status === 'closed' || matchType === 'closed') return 'request';
  return 'join';
}

export function buildVenueSharePayload(court) {
  return {
    court_id: court.id,
    venue: court.name || 'Bane',
    city: court.city || '',
    url: court.booking_url || court.url || null,
  };
}

export function buildTimeSuggestionPayload(date, time) {
  const d = new Date(`${date}T${time || '18:00'}`);
  const label = Number.isNaN(d.getTime())
    ? `${date}${time ? ` · ${time}` : ''}`
    : `${d.toLocaleDateString('da-DK', { weekday: 'long', day: 'numeric', month: 'short' })} · ${time || '18:00'}`;
  return { date, time, label };
}

export const QUICK_REACTIONS = ['👍', '❤️', '😂', '🎾'];
export const QUICK_EMOJIS = ['😄', '🙌', '💪', '🔥', '🎾', '👍'];
