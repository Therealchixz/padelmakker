import { supabase } from './supabase';
import { resolveNotificationPushPolicy } from './notificationPolicy';
import { normalizeNotificationRecipientIds } from './notificationRecipients';

export { normalizeNotificationRecipientIds } from './notificationRecipients';

const BATCH_RPC = 'create_notifications_for_users';
const SINGLE_RPC = 'create_notification_for_user';

async function sendPushNotification(userId, type, title, body, matchId, options = {}) {
  const pushPolicy = resolveNotificationPushPolicy(type, options?.pushPolicy);
  if (!pushPolicy.sendPush) return;

  try {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    if (!supabaseUrl || !import.meta.env.VITE_VAPID_PUBLIC_KEY) return;

    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return;

    fetch(`${supabaseUrl}/functions/v1/send-push`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        targetUserId: userId,
        title,
        body,
        matchId,
        entityType: options.entityType || null,
        entityId: options.entityId || null,
        type: pushPolicy.type,
        channel: pushPolicy.channel,
        level: pushPolicy.level,
        silent: pushPolicy.silent,
        urgency: pushPolicy.urgency,
        cooldownSeconds: pushPolicy.cooldownSeconds,
        aggregate: pushPolicy.aggregate,
        renotify: pushPolicy.renotify,
      }),
    })
      .then(async (res) => {
        if (res.ok) return;
        let details = '';
        try {
          details = await res.text();
        } catch {
          /* ignore */
        }
        console.warn(`[push] send-push svarede ${res.status}${details ? `: ${details}` : ''}`);
      })
      .catch(() => { /* ignorér netværksfejl */ });
  } catch {
    /* ignorér */
  }
}

function entityRpcArgs(options = {}) {
  const entityType = options.entityType ? String(options.entityType) : null;
  const entityId = options.entityId ? String(options.entityId) : null;
  if (!entityType || !entityId) return {};
  return { p_entity_type: entityType, p_entity_id: entityId };
}

async function insertNotificationRpc(userId, type, title, body, matchId, options = {}) {
  const { error } = await supabase.rpc(SINGLE_RPC, {
    p_user_id: userId,
    p_type: type,
    p_title: title,
    p_body: body,
    p_match_id: matchId,
    ...entityRpcArgs(options),
  });
  return error || null;
}

async function insertNotificationsBatchRpc(userIds, type, title, body, matchId, options = {}) {
  const { data, error } = await supabase.rpc(BATCH_RPC, {
    p_user_ids: userIds,
    p_type: type,
    p_title: title,
    p_body: body,
    p_match_id: matchId,
    ...entityRpcArgs(options),
  });
  if (error) return { error, inserted: 0 };
  return { error: null, inserted: Number(data) || 0 };
}

function isBatchRpcUnavailable(error) {
  const msg = String(error?.message || error || '').toLowerCase();
  return (
    msg.includes('could not find the function')
    || msg.includes('does not exist')
    || msg.includes('schema cache')
  );
}

/**
 * Opret in-app notifikation + send browser push hvis brugeren har tilmeldt sig.
 * Returnerer fejl-objekt hvis RPC fejler (så UI kan vise toast).
 */
export async function createNotification(userId, type, title, body, matchId = null, options = {}) {
  let rpcError = null;

  try {
    rpcError = await insertNotificationRpc(userId, type, title, body, matchId, options);
    if (rpcError) {
      console.warn('Notification RPC fejl:', rpcError.message || rpcError);
    }
  } catch (e) {
    console.warn('Notification RPC fejl:', e);
    rpcError = e;
  }

  if (rpcError) return rpcError;

  await sendPushNotification(userId, type, title, body, matchId, options);
  return rpcError;
}

/**
 * Opret notifikationer til flere brugere (ét batch-RPC når tilgængeligt).
 * Returnerer første fejl eller null ved succes.
 */
/** Send kun browser-push (in-app notifikationer forventes allerede oprettet). */
export async function sendPushNotificationsForUsers(
  userIds,
  type,
  title,
  body,
  matchId = null,
  options = {},
) {
  const ids = normalizeNotificationRecipientIds(userIds);
  if (ids.length === 0) return;
  await Promise.allSettled(
    ids.map((id) => sendPushNotification(id, type, title, body, matchId, options)),
  );
}

export async function createNotificationsForUsers(
  userIds,
  type,
  title,
  body,
  matchId = null,
  options = {},
) {
  const ids = normalizeNotificationRecipientIds(userIds);
  if (ids.length === 0) return null;

  if (ids.length === 1) {
    return createNotification(ids[0], type, title, body, matchId, options);
  }

  let rpcError = null;
  let inserted = 0;

  const batch = await insertNotificationsBatchRpc(ids, type, title, body, matchId, options);
  if (batch.error) {
    if (!isBatchRpcUnavailable(batch.error)) {
      console.warn('Batch notification RPC fejl:', batch.error.message || batch.error);
    }
    const results = await Promise.allSettled(
      ids.map((id) => insertNotificationRpc(id, type, title, body, matchId, options)),
    );
    const firstErr = results.find(
      (r) => r.status === 'rejected' || (r.status === 'fulfilled' && r.value),
    );
    if (firstErr?.status === 'fulfilled' && firstErr.value) rpcError = firstErr.value;
    else if (firstErr?.status === 'rejected') rpcError = firstErr.reason;
    inserted = results.filter((r) => r.status === 'fulfilled' && !r.value).length;
  } else {
    inserted = batch.inserted;
    if (inserted === 0) {
      rpcError = new Error('Ingen notifikationer oprettet');
    }
  }

  if (rpcError) return rpcError;

  await Promise.allSettled(
    ids.map((id) => sendPushNotification(id, type, title, body, matchId, options)),
  );

  return null;
}
