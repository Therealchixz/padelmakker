/**
 * Push-tekst ved tilmelding. Serveren (notify_match_creator_on_join) samler
 * alle tilmeldinger til én besked pr. kamp og returnerer den samlede tekst,
 * fx "2 spillere har tilmeldt sig din kamp". Ældre server-version returnerer
 * intet; så bruges den gamle tekst.
 *
 * @param {unknown} notice svar fra RPC'en
 * @param {string} fallbackBody
 * @returns {{ title: string, body: string } | null} null = ingen push (uændret)
 */
export function matchJoinPushContent(notice, fallbackBody) {
  if (notice && typeof notice === 'object') {
    if (notice.notify === false) return null;
    if (typeof notice.title === 'string' && notice.title.trim()) {
      return { title: notice.title, body: String(notice.body || '') };
    }
  }
  return { title: 'Ny spiller tilmeldt!', body: fallbackBody };
}
