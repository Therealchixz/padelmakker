function pad2(n) {
  return String(n).padStart(2, '0')
}

/**
 * Kalenderdato i EU-stil: **dd.mm.yyyy** (altid med punktum — tydeligt forskellig fra ISO YYYY-MM-DD).
 * Understøtter YYYY-MM-DD fra DB og ISO med tid; undgår locale-forskelle i browseren.
 */
export function formatMatchDateDa(dateVal) {
  if (dateVal == null || dateVal === '') return '—'
  let s = String(dateVal).trim()
  const isoDateTime = /^(\d{4})-(\d{2})-(\d{2})(?:[T\s]\d)/.exec(s)
  if (isoDateTime) {
    s = `${isoDateTime[1]}-${isoDateTime[2]}-${isoDateTime[3]}`
  }
  const ymd = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
  let y
  let mo
  let day
  if (ymd) {
    y = parseInt(ymd[1], 10)
    mo = parseInt(ymd[2], 10)
    day = parseInt(ymd[3], 10)
    const d = new Date(y, mo - 1, day)
    if (d.getFullYear() !== y || d.getMonth() !== mo - 1 || d.getDate() !== day) {
      return s
    }
  } else {
    const dmy = /^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/.exec(s)
    if (dmy) {
      day = parseInt(dmy[1], 10)
      mo = parseInt(dmy[2], 10)
      y = parseInt(dmy[3], 10)
      const d = new Date(y, mo - 1, day)
      if (d.getFullYear() !== y || d.getMonth() !== mo - 1 || d.getDate() !== day) {
        return s
      }
    } else {
      const d = new Date(s)
      if (Number.isNaN(d.getTime())) return s
      y = d.getFullYear()
      mo = d.getMonth() + 1
      day = d.getDate()
    }
  }
  return `${pad2(day)}.${pad2(mo)}.${y}`
}

/** Tid **tt.mm** (24h, punktum) — tydeligt forskellig fra DB-formatet 18:00. */
export function formatTimeSlotDa(timeVal) {
  if (timeVal == null || timeVal === '') return '—'
  const s = String(timeVal).trim()
  const m = /^(\d{1,2}):(\d{2})/.exec(s)
  if (!m) return s
  const h = Math.min(23, Math.max(0, parseInt(m[1], 10)))
  const min = Math.min(59, Math.max(0, parseInt(m[2], 10)))
  return `${pad2(h)}.${pad2(min)}`
}

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
