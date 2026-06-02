import { useEffect, useState } from 'react';
import { supabase } from './supabase';

/**
 * Ægte online/offline via Supabase Realtime Presence.
 *
 * Den indloggede bruger melder sig til en fælles presence-kanal og "tracker"
 * sit eget bruger-id. Alle klienter får løbende synkroniseret hvem der reelt
 * er forbundet lige nu (online = appen er åben med aktiv realtime-forbindelse).
 * Når en bruger lukker appen/mister forbindelsen, fjernes de automatisk.
 */

const CHANNEL_NAME = 'online-users';

let channel = null;
let currentUserId = null;
let onlineIds = new Set();
const listeners = new Set();

function notify() {
  for (const cb of listeners) {
    try { cb(onlineIds); } catch { /* ignore listener-fejl */ }
  }
}

function recomputeFromState() {
  if (!channel) return;
  try {
    const state = channel.presenceState();
    onlineIds = new Set(Object.keys(state || {}).map(String));
  } catch {
    onlineIds = new Set();
  }
  notify();
}

export function startPresence(userId) {
  if (!userId) return;
  const uid = String(userId);
  if (currentUserId === uid && channel) return;
  stopPresence();
  currentUserId = uid;

  channel = supabase.channel(CHANNEL_NAME, {
    config: { presence: { key: uid } },
  });

  channel
    .on('presence', { event: 'sync' }, recomputeFromState)
    .on('presence', { event: 'join' }, recomputeFromState)
    .on('presence', { event: 'leave' }, recomputeFromState)
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        void channel.track({ user_id: uid, online_at: new Date().toISOString() });
      }
    });
}

export function stopPresence() {
  if (channel) {
    try { supabase.removeChannel(channel); } catch { /* ignore */ }
    channel = null;
  }
  currentUserId = null;
  if (onlineIds.size) {
    onlineIds = new Set();
    notify();
  }
}

export function getOnlineIds() {
  return onlineIds;
}

export function subscribeOnline(cb) {
  listeners.add(cb);
  cb(onlineIds);
  return () => listeners.delete(cb);
}

/** Hook: returnerer et Set med id'er på brugere der er online lige nu. */
export function useOnlineIds() {
  const [ids, setIds] = useState(getOnlineIds);
  useEffect(() => subscribeOnline(setIds), []);
  return ids;
}

/** Hook: er en bestemt bruger online lige nu? */
export function useIsUserOnline(userId) {
  const ids = useOnlineIds();
  return userId ? ids.has(String(userId)) : false;
}
