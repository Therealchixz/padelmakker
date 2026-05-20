import { supabase } from './supabase';
import { sendPushNotificationsForUsers } from './notifications';
import { fetchAdminOpenResultErrorReportsCount } from './resultErrorReports';

export const REPORT_REASONS = [
  { id: 'harassment', label: 'Chikane eller trusler' },
  { id: 'spam', label: 'Spam eller reklame' },
  { id: 'inappropriate', label: 'Upassende indhold' },
  { id: 'other', label: 'Andet' },
];

/** Alle bruger-id'er der er skjult i DM (jeg har blokeret + har blokeret mig). */
export async function fetchDmHiddenUserIds(userId) {
  if (!userId) return new Set();

  const [blockedByMe, blockedMe] = await Promise.all([
    supabase.from('user_blocks').select('blocked_id').eq('blocker_id', userId),
    supabase.from('user_blocks').select('blocker_id').eq('blocked_id', userId),
  ]);

  const hidden = new Set();
  for (const row of blockedByMe.data || []) {
    if (row.blocked_id) hidden.add(String(row.blocked_id));
  }
  for (const row of blockedMe.data || []) {
    if (row.blocker_id) hidden.add(String(row.blocker_id));
  }
  return hidden;
}

/** Har jeg aktivt blokeret denne bruger? */
export async function fetchUsersIBlocked(userId) {
  if (!userId) return new Set();
  const { data, error } = await supabase
    .from('user_blocks')
    .select('blocked_id')
    .eq('blocker_id', userId);
  if (error) throw error;
  return new Set((data || []).map((r) => String(r.blocked_id)));
}

export async function blockUser(blockedId) {
  const { data, error } = await supabase.rpc('block_user', { p_blocked_id: blockedId });
  if (error) throw error;
  const result = data || {};
  if (!result.ok) throw new Error(result.error || 'Kunne ikke blokere brugeren');
  return result;
}

export async function unblockUser(blockedId) {
  const { data, error } = await supabase.rpc('unblock_user', { p_blocked_id: blockedId });
  if (error) throw error;
  const result = data || {};
  if (!result.ok) throw new Error(result.error || 'Kunne ikke fjerne blokering');
  return result;
}

export async function reportUser({ reportedId, reason, details, context = 'dm' }) {
  const { data, error } = await supabase.rpc('report_user', {
    p_reported_id: reportedId,
    p_reason: reason,
    p_details: details?.trim() || null,
    p_context: context,
  });
  if (error) throw error;
  const result = data || {};
  if (!result.ok) throw new Error(result.error || 'Kunne ikke sende anmeldelsen');

  const adminIds = Array.isArray(result.admin_ids) ? result.admin_ids : [];
  if (adminIds.length > 0 && result.notify_title && result.notify_body) {
    void sendPushNotificationsForUsers(
      adminIds,
      'user_report',
      result.notify_title,
      result.notify_body,
      null,
    );
  }

  return result;
}

export function reportReasonLabel(reasonId) {
  return REPORT_REASONS.find((r) => r.id === reasonId)?.label || reasonId || 'Ukendt';
}

/** Antal åbne spilleranmeldelser (kun for role=admin). */
export async function fetchAdminOpenUserReportsCount() {
  const { data, error } = await supabase.rpc('admin_open_user_reports_count');
  if (error) throw error;
  return Number(data) || 0;
}

/** Tællere til badges på admin-underfaner (efter PIN). */
export async function fetchAdminSubTabBadges(adminUserId) {
  const badges = { users: 0, matches: 0, reports: 0, console: 0, resultErrors: 0 };

  const [openReports, openResultErrors, flagsRes, resultsRes, notifsRes] = await Promise.all([
    fetchAdminOpenUserReportsCount().catch(() => 0),
    fetchAdminOpenResultErrorReportsCount().catch(() => 0),
    supabase
      .from('rating_admin_flags')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'open'),
    supabase
      .from('match_results')
      .select('id', { count: 'exact', head: true })
      .eq('confirmed', false),
    adminUserId
      ? supabase
          .from('notifications')
          .select('type')
          .eq('user_id', adminUserId)
          .eq('read', false)
      : Promise.resolve({ data: [] }),
  ]);

  const unread = notifsRes.data || [];
  const unreadReports = unread.filter((n) => n.type === 'user_report').length;
  const unreadFlags = unread.filter((n) => n.type === 'system_flag').length;

  badges.reports = Math.max(Number(openReports) || 0, unreadReports);
  badges.resultErrors = Number(openResultErrors) || 0;
  badges.console = Math.max(flagsRes.error ? 0 : (flagsRes.count || 0), unreadFlags);
  badges.matches = resultsRes.error ? 0 : (resultsRes.count || 0);

  return badges;
}

/** Samlet antal admin-opgaver til menu-badge (anmeldelser + konsol + kampe). */
export function adminAttentionTotal(badges) {
  if (!badges) return 0;
  return (badges.reports || 0) + (badges.resultErrors || 0) + (badges.console || 0) + (badges.matches || 0);
}

/** Hvilken under-fane admin bør åbnes først ved opmærksomhed. */
export function adminAttentionFocusSubTab(badges) {
  if (!badges) return null;
  if (badges.reports > 0) return 'reports';
  if (badges.resultErrors > 0) return 'result_errors';
  if (badges.console > 0) return 'console';
  if (badges.matches > 0) return 'matches';
  return null;
}

/** Push til alle admins ved nye konsol-flags (når en admin har appen åben). */
export async function notifyAdminsNewConsoleFlags(newFlagCount = 1) {
  const { data, error } = await supabase.rpc('admin_list_admin_ids');
  if (error) {
    console.warn('notifyAdminsNewConsoleFlags:', error.message || error);
    return;
  }
  const ids = Array.isArray(data) ? data : [];
  if (ids.length === 0) return;
  const n = Math.max(1, Number(newFlagCount) || 1);
  await sendPushNotificationsForUsers(
    ids,
    'system_flag',
    'Nyt flag i admin-konsol',
    n === 1
      ? 'Der er et nyt åbent ELO-flag. Gå til Admin → Konsol.'
      : `Der er ${n} nye åbne ELO-flags. Gå til Admin → Konsol.`,
    null,
  );
}

/** Admin (PIN): hent DM-tråd mellem anmelder og anmeldt til gennemgang. */
export async function fetchAdminDmThread(reporterId, reportedId, limit = 300) {
  const { data, error } = await supabase.rpc('admin_get_dm_messages_between', {
    p_user_a: reporterId,
    p_user_b: reportedId,
    p_limit: limit,
  });
  if (error) throw error;
  return data || [];
}
