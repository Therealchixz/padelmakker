/**
 * Skjul tidsfelter før "nu" når kalenderen er for **dagens dato** (Europe/Copenhagen).
 */

/** @param {string} time - "HH:MM" */
export function slotTimeMinutes(time) {
  const m = String(time || '').match(/^(\d{1,2}):(\d{2})/)
  if (!m) return NaN
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10)
}

/** Minutter siden midnat i København */
export function copenhagenNowMinutes() {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Copenhagen',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date())
  const hh = parts.find((p) => p.type === 'hour')?.value
  const mm = parts.find((p) => p.type === 'minute')?.value
  if (hh == null || mm == null) return 0
  return parseInt(hh, 10) * 60 + parseInt(mm, 10)
}

/**
 * @param {Array<{ slots: Array<{ time: string, status: string }>, name?: string }>} courts
 * @param {string | null | undefined} scheduleDateYmd - fra API (YYYY-MM-DD)
 * @param {string} todayYmd - typisk copenhagenDateYmd()
 */
export function filterPastSlotsIfToday(courts, scheduleDateYmd, todayYmd) {
  if (!courts?.length) return courts
  if (!scheduleDateYmd || scheduleDateYmd !== todayYmd) return courts
  const nowMin = copenhagenNowMinutes()
  return courts.map((c) => {
    const slots = (c.slots || []).filter((s) => {
      const sm = slotTimeMinutes(s.time)
      if (!Number.isFinite(sm)) return true
      return sm >= nowMin
    })
    return {
      ...c,
      slots,
      available: slots.filter((s) => s.status === 'free').map((s) => s.time),
    }
  })
}
