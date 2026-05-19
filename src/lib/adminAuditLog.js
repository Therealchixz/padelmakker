import { supabase } from './supabase';

/** @typedef {{ id: string, actor_id: string, action: string, target_user_id: string | null, details: Record<string, unknown>, created_at: string }} AdminAuditEntry */

/**
 * @param {number} [limit]
 * @returns {Promise<{ data: AdminAuditEntry[] | null, error: Error | null }>}
 */
export async function fetchAdminAuditLogRecent(limit = 50) {
  const { data, error } = await supabase.rpc('admin_audit_log_recent', {
    p_limit: limit,
  });
  if (error) return { data: null, error };
  return { data: data ?? [], error: null };
}

/** Danske labels til kendte audit-actions */
export const ADMIN_AUDIT_ACTION_LABELS = {
  pin_verified: 'PIN godkendt',
  adjust_elo: 'ELO justeret',
  delete_user: 'Bruger slettet',
  restore_deleted_profile: 'Profil gendannet',
  phone_verification_exempt: 'Telefon-undtagelse',
  correct_match_result: '2v2-resultat rettet',
  correct_americano_tournament: 'Americano rettet',
  correct_league_match: 'Liga-kamp rettet',
};

export function adminAuditActionLabel(action) {
  return ADMIN_AUDIT_ACTION_LABELS[action] || action || 'Ukendt';
}
