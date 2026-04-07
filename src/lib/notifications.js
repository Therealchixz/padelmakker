import { supabase } from './supabase';

/** Returnerer fejl-objekt hvis RPC fejler (så UI kan vise toast). Kræver create_notification_rpc.sql + ALTER FUNCTION SET row_security = off. */
export async function createNotification(userId, type, title, body, matchId = null) {
  try {
    const { error } = await supabase.rpc('create_notification_for_user', {
      p_user_id: userId,
      p_type: type,
      p_title: title,
      p_body: body,
      p_match_id: matchId,
    });
    if (error) {
      console.warn('Notification error:', error.message || error);
      return error;
    }
    return null;
  } catch (e) {
    console.warn('Notification error:', e);
    return e;
  }
}
