/** @param {{ spots_taken?: number; spots_total?: number } | null | undefined} status */
export function formatCampaignSpotsLabel(status) {
  const taken = Number(status?.spots_taken ?? 0);
  const total = Number(status?.spots_total ?? 200);
  return `${taken}/${total}`;
}

/** @param {unknown} rows */
export function growthCampaignEntriesToCsv(rows) {
  const list = Array.isArray(rows) ? rows : [];
  const header = ['entry_number', 'full_name', 'name', 'area', 'user_id', 'qualified_at', 'campaign_consent_at', 'profile_created_at'];
  const escape = (v) => {
    const s = v == null ? '' : String(v);
    if (s.includes('"') || s.includes(',') || s.includes('\n')) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const lines = [header.join(',')];
  for (const row of list) {
    lines.push(header.map((k) => escape(row?.[k])).join(','));
  }
  return lines.join('\n');
}
