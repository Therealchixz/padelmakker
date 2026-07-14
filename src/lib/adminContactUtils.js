/**
 * Resolve first admin profile id for "contact admin" flows (chat DM).
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {{ excludeUserId?: string | null }} [options]
 * @returns {Promise<string | null>}
 */
export async function fetchFirstAdminProfileId(supabase, { excludeUserId = null } = {}) {
  let query = supabase
    .from('profiles')
    .select('id')
    .eq('role', 'admin');

  if (excludeUserId) {
    query = query.neq('id', excludeUserId);
  }

  const { data, error } = await query
    .order('full_name', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data?.id ?? null;
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {{ excludeUserId?: string | null, onMissing?: () => void }} [options]
 * @returns {Promise<string | null>} chat path `/dashboard/beskeder?med=...` or null
 */
export async function buildAdminChatPath(supabase, { excludeUserId = null, onMissing } = {}) {
  const adminId = await fetchFirstAdminProfileId(supabase, { excludeUserId });
  if (!adminId) {
    onMissing?.();
    return null;
  }
  return `/dashboard/beskeder?med=${adminId}`;
}
