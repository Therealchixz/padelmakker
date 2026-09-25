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
