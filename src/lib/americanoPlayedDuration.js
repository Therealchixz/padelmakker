function fromTimestamp(raw) {
  if (!raw) return null;
  const ms = new Date(raw).getTime();
  return Number.isFinite(ms) ? ms : null;
}

/**
 * Faktisk spilletid for afsluttet Americano: fra kampe oprettes (turnering startet)
 * til sidste låste kamp / completed_at.
 */
export function computeAmericanoPlayedDurationMinutes(tournament, matches) {
  if (!tournament || tournament.status !== 'completed') return null;

  const list = Array.isArray(matches) ? matches : [];
  const locked = list.filter(
    (m) =>
      m.team_a_score != null &&
      m.team_b_score != null &&
      m.results_locked !== false,
  );

  const createdTimes = list
    .map((m) => fromTimestamp(m.created_at))
    .filter((ms) => ms != null);
  const lockedEndTimes = locked
    .map((m) => fromTimestamp(m.updated_at))
    .filter((ms) => ms != null);

  let startMs = createdTimes.length > 0 ? Math.min(...createdTimes) : null;
  let endMs = fromTimestamp(tournament.completed_at);

  if (lockedEndTimes.length > 0) {
    const lastLockedMs = Math.max(...lockedEndTimes);
    endMs = endMs != null ? Math.max(endMs, lastLockedMs) : lastLockedMs;
  }

  if (endMs == null) {
    const updatedMs = fromTimestamp(tournament.updated_at);
    const createdMs = fromTimestamp(tournament.created_at);
    if (
      updatedMs != null &&
      (createdMs == null || updatedMs > createdMs + 60_000)
    ) {
      endMs = updatedMs;
    }
  }

  if (startMs == null || endMs == null || endMs <= startMs) return null;

  const minutes = Math.round((endMs - startMs) / 60_000);
  return Math.max(1, minutes);
}

/** Visning: faktisk minutter eller estimat med ~ for åbne/ukendte. */
export function formatAmericanoDurationLabel(minutes, estimatedMinutes) {
  if (minutes != null && Number.isFinite(minutes) && minutes > 0) {
    if (minutes >= 60) {
      const h = Math.floor(minutes / 60);
      const m = minutes % 60;
      return m > 0 ? `${h} t ${m} min` : `${h} t`;
    }
    return `${minutes} min`;
  }
  if (estimatedMinutes != null && Number.isFinite(estimatedMinutes)) {
    return `~${estimatedMinutes} min`;
  }
  return '—';
}
