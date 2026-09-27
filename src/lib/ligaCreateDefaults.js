/**
 * Slutdato for en ny liga. Opret-formularen spørger ikke om en slutdato, men
 * databasen kræver én (leagues.end_date NOT NULL). Uden den fejlede "Opret liga"
 * med "Handlingen kunne ikke gennemføres" (ejeren 25. sep. 2026).
 *
 * Ren logik uden supabase, så den kan testes fra node.
 */

function parseYmd(value) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || '').slice(0, 10));
  return m ? { y: Number(m[1]), mo: Number(m[2]), d: Number(m[3]) } : null;
}

function ymd(y, mo, d) {
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/**
 * Valgt slutdato, hvis den er gyldig og ikke før start; ellers en standard ud fra
 * sæsontypen: ugentlig = 7 dage efter start, månedlig = samme dato næste måned
 * (eller sidste dag i måneden, fx 31. jan → 28./29. feb).
 * @returns {string | null} YYYY-MM-DD, eller null hvis startdatoen mangler
 */
export function resolveLeagueEndDate(startDate, endDate, seasonType = 'monthly') {
  const start = parseYmd(startDate);
  if (!start) return null;
  const startYmd = ymd(start.y, start.mo, start.d);
  const chosen = parseYmd(endDate);
  if (chosen) {
    const chosenYmd = ymd(chosen.y, chosen.mo, chosen.d);
    if (chosenYmd >= startYmd) return chosenYmd;
  }
  if (seasonType === 'weekly') {
    const t = new Date(Date.UTC(start.y, start.mo - 1, start.d + 7));
    return ymd(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
  }
  const nextMonthIndex = start.mo; // 0-baseret indeks for næste måned
  const lastDayNext = new Date(Date.UTC(start.y, nextMonthIndex + 1, 0)).getUTCDate();
  const t = new Date(Date.UTC(start.y, nextMonthIndex, Math.min(start.d, lastDayNext)));
  return ymd(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
}

/** YYYY-MM-DD + et antal dage (kan være negativt). */
export function addDaysYmd(dateYmd, days) {
  const d = parseYmd(dateYmd);
  if (!d) return '';
  const t = new Date(Date.UTC(d.y, d.mo - 1, d.d + Number(days || 0)));
  return ymd(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
}

/** Antal hele dage fra a til b (null hvis en dato mangler). */
export function daysBetweenYmd(a, b) {
  const x = parseYmd(a);
  const y = parseYmd(b);
  if (!x || !y) return null;
  return Math.round((Date.UTC(y.y, y.mo - 1, y.d) - Date.UTC(x.y, x.mo - 1, x.d)) / 86_400_000);
}

/** "4 uger", "10 dage", "1 uge" — sæsonens længde til opret-guiden. */
export function seasonLengthLabel(startDate, endDate) {
  const days = daysBetweenYmd(startDate, endDate);
  if (days == null || days < 0) return '';
  if (days > 0 && days % 7 === 0) {
    const w = days / 7;
    return `${w} ${w === 1 ? 'uge' : 'uger'}`;
  }
  return `${days} ${days === 1 ? 'dag' : 'dage'}`;
}

/**
 * Tjek rækkefølgen: frist ≤ start ≤ slut.
 * @returns {{ field: 'registration_deadline' | 'end_date', message: string } | null}
 */
export function leagueScheduleError({ registration_deadline, start_date, end_date }) {
  if (registration_deadline && start_date && registration_deadline > start_date) {
    return { field: 'registration_deadline', message: 'Tilmeldingsfristen skal ligge før sæsonstart.' };
  }
  if (end_date && start_date && end_date < start_date) {
    return { field: 'end_date', message: 'Sæsonslut skal være efter sæsonstart.' };
  }
  return null;
}
