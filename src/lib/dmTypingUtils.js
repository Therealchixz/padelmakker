import { supabase } from './supabase';

function dmTypingChannelName(userIdA, userIdB) {
  const ids = [String(userIdA), String(userIdB)].sort();
  return `dm-typing:${ids[0]}:${ids[1]}`;
}

export function subscribeDmTyping(userId, otherUserId, onTyping) {
  if (!userId || !otherUserId || typeof onTyping !== 'function') return () => {};

  const channel = supabase
    .channel(dmTypingChannelName(userId, otherUserId), {
      config: { broadcast: { self: false } },
    })
    .on('broadcast', { event: 'typing' }, ({ payload }) => {
      if (!payload?.userId || String(payload.userId) === String(userId)) return;
      onTyping(payload);
    })
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

let typingTimer = null;

export function broadcastDmTyping(userId, otherUserId) {
  if (!userId || !otherUserId) return;

  const channel = supabase.channel(dmTypingChannelName(userId, otherUserId), {
    config: { broadcast: { ack: false } },
  });

  void channel.subscribe((status) => {
    if (status !== 'SUBSCRIBED') return;
    void channel.send({
      type: 'broadcast',
      event: 'typing',
      payload: { userId, at: Date.now() },
    });
    window.setTimeout(() => {
      supabase.removeChannel(channel);
    }, 300);
  });

  if (typingTimer) clearTimeout(typingTimer);
  typingTimer = window.setTimeout(() => {
    typingTimer = null;
  }, 1200);
}

export function subscribeTeamTyping(teamId, userId, onTyping) {
  if (!teamId || !userId || typeof onTyping !== 'function') return () => {};

  const channel = supabase
    .channel(`liga-team-typing:${teamId}`, {
      config: { broadcast: { self: false } },
    })
    .on('broadcast', { event: 'typing' }, ({ payload }) => {
      if (!payload?.userId || String(payload.userId) === String(userId)) return;
      onTyping(payload);
    })
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

export function broadcastTeamTyping(teamId, userId) {
  if (!teamId || !userId) return;

  const channel = supabase.channel(`liga-team-typing:${teamId}`, {
    config: { broadcast: { ack: false } },
  });

  void channel.subscribe((status) => {
    if (status !== 'SUBSCRIBED') return;
    void channel.send({
      type: 'broadcast',
      event: 'typing',
      payload: { userId, at: Date.now() },
    });
    window.setTimeout(() => {
      supabase.removeChannel(channel);
    }, 300);
  });
}
