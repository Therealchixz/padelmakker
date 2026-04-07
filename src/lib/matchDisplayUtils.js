/** ELO fra profil-række (fallback når historik ikke er hentet). */
export function eloOf(p) {
  const v = Number(p?.elo_rating);
  return Number.isFinite(v) ? Math.round(v) : 1000;
}

export function fmtClock(t) {
  if (t == null || t === '') return '';
  return String(t).slice(0, 5);
}

/** Viser "20:00–22:00" når time_end findes, ellers kun starttid. */
export function matchTimeLabel(m) {
  const a = fmtClock(m.time);
  const b = m.time_end ? fmtClock(m.time_end) : '';
  if (a && b) return `${a}–${b}`;
  return a || '—';
}

export function timeToMinutes(hhmm) {
  const s = fmtClock(hhmm);
  const [h, min] = s.split(':').map((x) => parseInt(x, 10));
  if (!Number.isFinite(h) || !Number.isFinite(min)) return NaN;
  return h * 60 + min;
}

/** Nyeste afsluttede kamp først: resultat-tidsstempel, ellers kamp dato+tid. */
export function matchCompletedSortMs(m, resultsByMatchId) {
  const mr = resultsByMatchId[m.id];
  const ts = mr?.updated_at || mr?.created_at || mr?.confirmed_at;
  if (ts) {
    const n = new Date(ts).getTime();
    if (Number.isFinite(n)) return n;
  }
  const d = m.date || '1970-01-01';
  const t = fmtClock(m.time) || '00:00';
  const n = new Date(`${d}T${t}:00`).getTime();
  return Number.isFinite(n) ? n : 0;
}
