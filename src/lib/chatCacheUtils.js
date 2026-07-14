export const CONVO_CACHE_TTL_MS = 30_000;
export const MESSAGE_CACHE_TTL_MS = 20_000;
export const MESSAGE_CACHE_MAX_THREADS = 20;

export const CONVO_CACHE_BY_USER = new Map();
export const MESSAGE_CACHE_BY_THREAD = new Map();

/** Track DM message ids already counted toward unread to avoid duplicate realtime inflation. */
export const PROCESSED_UNREAD_MESSAGE_IDS = new Set();

export function setMessageThreadCache(threadKey, messages) {
  if (!threadKey) return;
  MESSAGE_CACHE_BY_THREAD.set(threadKey, {
    at: Date.now(),
    ok: true,
    messages: messages || [],
  });
  while (MESSAGE_CACHE_BY_THREAD.size > MESSAGE_CACHE_MAX_THREADS) {
    const oldestKey = MESSAGE_CACHE_BY_THREAD.keys().next().value;
    if (!oldestKey) break;
    MESSAGE_CACHE_BY_THREAD.delete(oldestKey);
  }
}

export function clearChatCachesForUser(userId) {
  if (userId != null) {
    CONVO_CACHE_BY_USER.delete(String(userId));
  }
}

export function clearAllChatCaches() {
  CONVO_CACHE_BY_USER.clear();
  MESSAGE_CACHE_BY_THREAD.clear();
  PROCESSED_UNREAD_MESSAGE_IDS.clear();
}
