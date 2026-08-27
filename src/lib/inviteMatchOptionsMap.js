/** Samme regel som chat-invitationer: kun kommende kampe/turneringer. */
export function mapInviteMatchOptions(matchRows, tourRows, today = new Date().toISOString().slice(0, 10)) {
  return [
    ...(Array.isArray(matchRows) ? matchRows : [])
      .filter((m) => !m.date || m.date >= today)
      .map((m) => ({ ...m, _type: 'match' })),
    ...(Array.isArray(tourRows) ? tourRows : [])
      .filter((t) => !t.tournament_date || t.tournament_date >= today)
      .map((t) => ({ ...t, _type: 'americano' })),
  ];
}
