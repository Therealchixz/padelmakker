import { supabase } from './supabase';
import { sendPushNotificationsForUsers } from './notifications';

/** Tid efter afslutning hvor opretter kan indberette fejl. */
export const RESULT_ERROR_REPORT_WINDOW_MS = 24 * 60 * 60 * 1000;

export const RESULT_ERROR_REASONS = [
  { id: 'elo', label: 'Forkert ELO' },
  { id: 'points', label: 'Forkerte point' },
  { id: 'result', label: 'Forkert resultat' },
  { id: 'other', label: 'Andet' },
];

export const RESULT_ERROR_SOURCE_LABELS = {
  match_2v2: '2v2-kamp',
  americano: 'Americano',
  league: 'Liga',
};

export function resultErrorReasonLabel(reasonId) {
  return RESULT_ERROR_REASONS.find((r) => r.id === reasonId)?.label || reasonId || 'Ukendt';
}

export function resultErrorSourceLabel(sourceType) {
  return RESULT_ERROR_SOURCE_LABELS[sourceType] || sourceType || 'Ukendt';
}

/** 24t-frist fra kampen blev færdigspillet — ikke fra oprettelse (completed_at kan være backfill). */
export function completionMsFor2v2(match, matchResult) {
  const fromTs = (raw) => {
    if (!raw) return null;
    const ms = new Date(raw).getTime();
    return Number.isFinite(ms) ? ms : null;
  };

  const resultTimes = [];
  if (matchResult?.confirmed) {
    resultTimes.push(fromTs(matchResult?.updated_at), fromTs(matchResult?.created_at));
  }
  const validResultTimes = resultTimes.filter((ms) => ms != null);
  if (validResultTimes.length > 0) return Math.max(...validResultTimes);

  const completedMs = fromTs(match?.completed_at);
  const createdMs = fromTs(match?.created_at);
  if (completedMs != null && (createdMs == null || completedMs > createdMs + 60_000)) {
    return completedMs;
  }

  if (match?.date) {
    const timePart = match.time ? String(match.time).trim().slice(0, 5) : '12:00';
    const playedMs = fromTs(`${match.date}T${timePart}:00`);
    if (playedMs != null) return playedMs;
  }

  return completedMs ?? null;
}

export function completionMsForAmericano(tournament) {
  const raw = tournament?.updated_at || tournament?.created_at;
  if (!raw) return null;
  const ms = new Date(raw).getTime();
  return Number.isFinite(ms) ? ms : null;
}

export function completionMsForLeague(league) {
  const candidates = [league?.updated_at, league?.end_date, league?.created_at];
  for (const raw of candidates) {
    if (!raw) continue;
    const ms = new Date(raw).getTime();
    if (Number.isFinite(ms)) return ms;
  }
  return null;
}

export function isWithinResultErrorReportWindow(completedAtMs, nowMs = Date.now()) {
  if (completedAtMs == null || !Number.isFinite(completedAtMs)) return false;
  return nowMs - completedAtMs <= RESULT_ERROR_REPORT_WINDOW_MS;
}

export function resultErrorReportDeadlineLabel(completedAtMs) {
  if (completedAtMs == null) return null;
  const deadline = completedAtMs + RESULT_ERROR_REPORT_WINDOW_MS;
  const left = deadline - Date.now();
  if (left <= 0) return null;
  const hours = Math.floor(left / (60 * 60 * 1000));
  const mins = Math.floor((left % (60 * 60 * 1000)) / (60 * 1000));
  if (hours > 0) return `${hours} t ${mins} min tilbage`;
  return `${Math.max(mins, 1)} min tilbage`;
}

export async function fetchMyResultErrorReport(sourceType, entityId) {
  if (!entityId) return null;
  const { data, error } = await supabase
    .from('result_error_reports')
    .select('id, status, reason, created_at')
    .eq('source_type', sourceType)
    .eq('entity_id', entityId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function submitResultErrorReport({ sourceType, entityId, reason, details }) {
  const { data, error } = await supabase.rpc('submit_result_error_report', {
    p_source_type: sourceType,
    p_entity_id: entityId,
    p_reason: reason,
    p_details: details?.trim() || null,
  });
  if (error) throw error;
  const result = data || {};
  if (!result.ok) throw new Error(result.error || 'Kunne ikke sende indberetningen');

  const adminIds = Array.isArray(result.admin_ids) ? result.admin_ids : [];
  if (adminIds.length > 0 && result.notify_title && result.notify_body) {
    void sendPushNotificationsForUsers(
      adminIds,
      'result_error_report',
      result.notify_title,
      result.notify_body,
      sourceType === 'match_2v2' ? entityId : null,
    );
  }

  return result;
}

/** Antal åbne resultatfejl (admin). */
export async function fetchAdminOpenResultErrorReportsCount() {
  const { data, error } = await supabase.rpc('admin_open_result_error_reports_count');
  if (error) throw error;
  return Number(data) || 0;
}
