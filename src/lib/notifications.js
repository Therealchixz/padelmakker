import { supabase } from './supabase';

/**
 * Opret in-app notifikation + send browser push hvis brugeren har tilmeldt sig.
 * Returnerer fejl-objekt hvis RPC fejler (så UI kan vise toast).
 */
export async function createNotification(userId, type, title, body, matchId = null) {
  let rpcError = null;

  // 1. In-app notifikation via RPC (SECURITY DEFINER, row_security = off)
  try {
    const { error } = await supabase.rpc('create_notification_for_user', {
      p_user_id: userId,
      p_type: type,
      p_title: title,
      p_body: body,
      p_match_id: matchId,
    });
    if (error) {
      console.warn('Notification RPC fejl:', error.message || error);
      rpcError = error;
    }
  } catch (e) {
    console.warn('Notification RPC fejl:', e);
    rpcError = e;
  }

  // 2. Browser push kun når in-app notifikation lykkedes.
  // Undgår at push sendes hvis RPC afvises.
  if (rpcError) return rpcError;

  try {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    if (supabaseUrl && import.meta.env.VITE_VAPID_PUBLIC_KEY) {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        fetch(`${supabaseUrl}/functions/v1/send-push`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ targetUserId: userId, title, body, matchId, type }),

        })
          .then(async (res) => {
            if (res.ok) return;
            let details = '';
            try { details = await res.text(); } catch { /* ignore */ }
            console.warn(`[push] send-push svarede ${res.status}${details ? `: ${details}` : ''}`);
          })
          .catch(() => { /* ignorér netværksfejl */ });

      }
    }
  } catch { /* ignorér */ }

  return rpcError;
}
