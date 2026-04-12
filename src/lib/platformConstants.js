export const LEVELS = [
  'Begynder (1.0–1.9)',
  'Let øvet (2.0–2.9)',
  'Øvet (3.0)',
  'Avanceret øvet (3.5)',
  'Meget øvet (4.0–4.9)',
  'Elite (5.0–7.0)',
];

export const LEVEL_DESCS = {
  'Begynder (1.0–1.9)':    'Ny til padel — ingen/lidt erfaring fra ketchersport',
  'Let øvet (2.0–2.9)':    'Kan returnere boldene, evt. erfaring fra anden ketchersport',
  'Øvet (3.0)':            'Spiller jævnligt med god kontrol på grundslagene. Kan holde længere dueller, men laver stadig en del uprovokerede fejl. Har niveau til DPF 25/50-turneringer eller 3. division.',
  'Avanceret øvet (3.5)':  'Spiller ugentligt med færre fejl og god boldkontrol. Dine dueller bliver længere, og du har forståelse for taktik. Har niveau til DPF 50/100-turneringer eller 2./3. division.',
  'Meget øvet (4.0–4.9)':  'Spiller 1. division, DPF200 eller DPF400 turneringer',
  'Elite (5.0–7.0)':       'DPF1000, landsholdsniveau eller professionel spiller',
};

/** Konvertér gemt tal (fx 1.0, 3.5) til kort visningsnavn */
export function levelLabel(num) {
  if (!num) return null;
  const n = Number(num);
  if (n < 2) return 'Begynder';
  if (n < 3) return 'Let øvet';
  if (n < 3.25) return 'Øvet (3.0)';
  if (n < 4) return 'Avanceret øvet (3.5)';
  if (n < 5) return 'Meget øvet';
  return 'Elite';
}

/** Konvertér gemt tal til fuld LEVELS-streng til brug i formular */
export function levelStringFromNum(num) {
  if (!num) return '';
  const n = Number(num);
  // Præcis match (inden for lille tolerance)
  const exact = LEVELS.find(l => {
    const matches = l.match(/[\d.]+/g);
    return matches?.some(m => Math.abs(parseFloat(m) - n) < 0.01);
  });
  if (exact) return exact;
  // Fallback: afrunding til heltal
  return LEVELS.find(l => {
    const m = l.match(/[\d.]+/);
    return m && Math.floor(parseFloat(m[0])) === Math.floor(n);
  }) || '';
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
