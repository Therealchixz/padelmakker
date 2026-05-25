/** @typedef {'open'|'reviewed'|'closed'|'all'} FlagStatusFilter */
/** @typedef {'all'|'2v2'|'americano'} FlagSourceFilter */
/** @typedef {'all'|'high'|'medium'|'low'} FlagSeverityFilter */

/**
 * @param {Array<Record<string, unknown>>} flags
 * @param {{ flagSearch?: string, flagStatusFilter?: FlagStatusFilter, flagSourceFilter?: FlagSourceFilter, flagSeverityFilter?: FlagSeverityFilter }} filters
 */
export function filterRatingAdminFlags(flags, filters = {}) {
  const {
    flagSearch = '',
    flagStatusFilter = 'all',
    flagSourceFilter = 'all',
    flagSeverityFilter = 'all',
  } = filters;

  return (flags || []).filter((flag) => {
    if (flagStatusFilter !== 'all' && flag.status !== flagStatusFilter) return false;
    if (flagSourceFilter !== 'all' && flag.source !== flagSourceFilter) return false;
    if (flagSeverityFilter !== 'all' && flag.severity !== flagSeverityFilter) return false;
    const q = String(flagSearch || '').trim().toLowerCase();
    if (!q) return true;
    const blob = [
      flag.reason,
      flag.source,
      flag.severity,
      flag.status,
      flag.match_id,
      flag.tournament_id,
      JSON.stringify(flag.payload || {}),
    ]
      .join(' ')
      .toLowerCase();
    return blob.includes(q);
  });
}

/**
 * @param {{
 *   profiles?: Array<{ is_banned?: boolean }>,
 *   matchesRows?: Array<{ status?: string, completed_at?: string | null }>,
 *   pendingResults?: unknown[],
 *   americanoRows?: Array<{ status?: string, updated_at?: string | null }>,
 *   flags?: Array<{ status?: string, severity?: string }>,
 *   nowMs?: number,
 * }} input
 */
export function computeAdminConsoleStats(input = {}) {
  const profiles = input.profiles || [];
  const matchesRows = input.matchesRows || [];
  const pendingResults = input.pendingResults || [];
  const americanoRows = input.americanoRows || [];
  const flags = input.flags || [];
  const now = Number.isFinite(input.nowMs) ? input.nowMs : Date.now();
  const oneDayAgo = now - 24 * 60 * 60 * 1000;
  const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;

  const isAmericanoActive = (status) => status === 'active' || status === 'playing';

  return {
    totalPlayers: profiles.length,
    bannedPlayers: profiles.filter((p) => !!p.is_banned).length,
    pendingResults: pendingResults.length,
    openMatches: matchesRows.filter((m) => m.status === 'open' || m.status === 'full').length,
    inProgressMatches: matchesRows.filter((m) => m.status === 'in_progress').length,
    completedMatches24h: matchesRows.filter(
      (m) =>
        m.status === 'completed' &&
        m.completed_at &&
        new Date(m.completed_at).getTime() >= oneDayAgo,
    ).length,
    americanoOpen: americanoRows.filter((t) => t.status === 'open').length,
    americanoActive: americanoRows.filter((t) => isAmericanoActive(t.status)).length,
    americanoCompleted7d: americanoRows.filter(
      (t) =>
        t.status === 'completed' &&
        t.updated_at &&
        new Date(t.updated_at).getTime() >= sevenDaysAgo,
    ).length,
    openFlags: flags.filter((f) => f.status === 'open').length,
    highFlags: flags.filter((f) => f.status === 'open' && f.severity === 'high').length,
  };
}

/**
 * @param {'open'|'reviewed'|'closed'} nextStatus
 * @param {{ userId?: string | null, note?: string }} opts
 */
export function buildRatingFlagStatusUpdate(nextStatus, { userId = null, note = '' } = {}) {
  const updates = { status: nextStatus };
  if (nextStatus === 'open') {
    updates.reviewed_at = null;
    updates.reviewed_by = null;
  } else {
    updates.reviewed_at = new Date().toISOString();
    updates.reviewed_by = userId || null;
  }
  const trimmed = String(note || '').trim();
  if (trimmed) updates.review_note = trimmed;
  return updates;
}
