import {
  MESSAGE_CACHE_BY_THREAD,
  MESSAGE_CACHE_TTL_MS,
  setMessageThreadCache,
} from './chatCacheUtils.js';

/** @type {Map<string, object>} */
const PARTNER_CACHE = new Map();
/** @type {Map<string, Promise<unknown>>} */
const inflight = new Map();

export function playerChatSearch(playerId) {
  return `med=${encodeURIComponent(String(playerId || ''))}`;
}

export function playerChatPath(playerId) {
  return `/dashboard/beskeder?${playerChatSearch(playerId)}`;
}

export function playerChatState(player) {
  if (!player?.id) return undefined;
  const snapshot = snapshotChatPartner(player);
  PARTNER_CACHE.set(snapshot.id, snapshot);
  return { chatPartner: snapshot };
}

function snapshotChatPartner(player) {
  return {
    id: String(player.id),
    full_name: player.full_name || player.name || '',
    name: player.name || player.full_name || '',
    avatar: player.avatar || null,
    elo_rating: player.elo_rating ?? null,
    level: player.level ?? null,
    last_active_at: player.last_active_at ?? null,
  };
}

export function getCachedChatPartner(playerId) {
  return PARTNER_CACHE.get(String(playerId || '')) || null;
}

export function rememberChatPartner(player) {
  if (!player?.id) return;
  const snapshot = snapshotChatPartner(player);
  PARTNER_CACHE.set(snapshot.id, snapshot);
}

export function cachedDmMessages(userId, otherId) {
  if (!userId || !otherId) return null;
  const cached = MESSAGE_CACHE_BY_THREAD.get(`${userId}:${otherId}`);
  return cached?.ok ? (cached.messages || []) : null;
}

export function prefetchBeskedTabChunk() {
  void import('../dashboard/BeskedTab');
}

export function prefetchDmThread(userId, otherId) {
  const uid = String(userId || '');
  const oid = String(otherId || '');
  if (!uid || !oid || uid === oid) return Promise.resolve(null);
  const key = `${uid}:${oid}`;
  const cached = MESSAGE_CACHE_BY_THREAD.get(key);
  if (cached?.ok && Date.now() - cached.at < MESSAGE_CACHE_TTL_MS) {
    return Promise.resolve(cached.messages);
  }
  if (inflight.has(key)) return inflight.get(key);

  const promise = import('./chatUtils.js')
    .then(({ fetchMessages, fetchChatPartnerProfile }) =>
      Promise.all([
        fetchMessages(uid, oid),
        fetchChatPartnerProfile(oid).catch(() => null),
      ]),
    )
    .then(([messages, partner]) => {
      setMessageThreadCache(key, messages);
      if (partner) rememberChatPartner(partner);
      inflight.delete(key);
      return messages;
    })
    .catch((err) => {
      inflight.delete(key);
      throw err;
    });

  inflight.set(key, promise);
  return promise;
}

export function openPlayerChat(navigate, player) {
  if (!player?.id || typeof navigate !== 'function') return;
  navigate(playerChatPath(player.id), { state: playerChatState(player) });
}
