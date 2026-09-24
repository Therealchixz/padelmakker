/**
 * Tallene bag admin-kortet "Kommer folk tilbage fra mails?".
 * Ren logik uden supabase, så den kan testes fra node.
 */

export const MAIL_SOURCES = [
  { kilde: 'digest', label: 'Daglig mail kl. 17' },
  { kilde: 'opdagelse', label: 'Mail om kamp i dag/i morgen' },
  { kilde: 'paamindelse', label: 'Ugentlig påmindelse' },
  { kilde: 'winback', label: 'Engangsmail til inaktive' },
  { kilde: 'deling', label: 'Delte kampe (WhatsApp, SMS …)' },
];

/**
 * @param {{ returns?: { kilde: string, personer: number, besoeg: number }[], sent?: Record<string, number> } | null} stats
 */
export function mailReturnRows(stats) {
  const byKilde = new Map((stats?.returns || []).map((r) => [String(r.kilde), r]));
  const rows = MAIL_SOURCES.map(({ kilde, label }) => {
    const r = byKilde.get(kilde);
    return { kilde, label, personer: Number(r?.personer) || 0, besoeg: Number(r?.besoeg) || 0 };
  });
  for (const [kilde, r] of byKilde) {
    if (MAIL_SOURCES.some((s) => s.kilde === kilde)) continue;
    rows.push({ kilde, label: `Andet (${kilde})`, personer: Number(r?.personer) || 0, besoeg: Number(r?.besoeg) || 0 });
  }
  return rows;
}

export function mailSentSummary(stats) {
  const sent = stats?.sent || {};
  const daily = Number(sent.discovery) || 0;
  const winback = Number(sent.winback) || 0;
  const parts = [`${daily} ${daily === 1 ? 'almindelig mail' : 'almindelige mails'}`];
  if (winback > 0) parts.push(`${winback} ${winback === 1 ? 'engangsmail' : 'engangsmails'}`);
  return `Sendt: ${parts.join(' og ')}`;
}
