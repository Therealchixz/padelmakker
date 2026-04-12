export const LEVELS = [
  'Begynder (1.0–1.9)',
  'Let øvet (2.0–2.9)',
  'Øvet (3.0–3.9)',
  'Meget øvet (4.0–4.9)',
  'Elite (5.0–7.0)',
];

export const LEVEL_DESCS = {
  'Begynder (1.0–1.9)':    'Ny til padel — ingen/lidt erfaring fra ketchersport',
  'Let øvet (2.0–2.9)':    'Kan returnere boldene, evt. erfaring fra anden ketchersport',
  'Øvet (3.0–3.9)':        'Spiller 2./3. division eller DPF50/DPF100 turneringer',
  'Meget øvet (4.0–4.9)':  'Spiller 1. division, DPF200 eller DPF400 turneringer',
  'Elite (5.0–7.0)':       'DPF1000, landsholdsniveau eller professionel spiller',
};
/** Konvertér gemt tal (fx 1.0, 3.5) til LEVELS-streng */
export function levelLabel(num) {
  if (!num) return null;
  const n = Number(num);
  if (n < 2) return 'Begynder';
  if (n < 3) return 'Let øvet';
  if (n < 4) return 'Øvet';
  if (n < 5) return 'Meget øvet';
  return 'Elite';
}

/** Konvertér gemt tal til fuld LEVELS-streng til brug i formular */
export function levelStringFromNum(num) {
  if (!num) return '';
  return LEVELS.find(l => Math.floor(parseFloat(l.match(/[\d.]+/)?.[0] || 0)) === Math.floor(Number(num))) || '';
}

export const PLAY_STYLES = ['Offensiv', 'Defensiv', 'Alround', 'Ved ikke endnu'];
export const COURT_SIDES = ['Venstre side', 'Højre side', 'Begge sider'];

/** Danmarks fem regioner (administrativ inddeling) */
export const REGIONS = [
  'Region Hovedstaden',
  'Region Midtjylland',
  'Region Nordjylland',
  'Region Sjælland',
  'Region Syddanmark',
];
export const DEFAULT_REGION = REGIONS[0];

export const AVAILABILITY = ['Morgener', 'Formiddage', 'Eftermiddage', 'Aftener', 'Weekender', 'Flexibel'];
