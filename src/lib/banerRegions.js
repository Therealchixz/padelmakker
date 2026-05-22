/**
 * Landsdele til Book bane — baseret på Danmarks Statistiks NUTS-landsdele (2007+).
 * @see https://www.dst.dk/da/Statistik/dokumentation/nomenklaturer/nuts
 *
 * Region Midtjylland opdeles statistisk i Vestjylland + Østjylland.
 * Region Syddanmark (Jylland-delen) svarer til Sønderjylland i appen (syd for Kongeå + vestkysten).
 */

/** @typedef {typeof BANER_REGION_ORDER[number]} BanerRegion */

export const BANER_REGION_ORDER = [
  'Nordjylland',
  'Vestjylland',
  'Østjylland',
  'Sønderjylland',
  'Fyn',
  'Sjælland',
  'Hovedstaden',
  'Bornholm',
];

/** Kort forklaring under overskrift (valgfri) */
export const BANER_REGION_SUBTITLE = {
  Sønderjylland: 'også kaldet sydjylland',
  Vestjylland: 'Herning, Holstebro, Lemvig, Viborg m.fl.',
  Østjylland: 'Aarhus, Randers, Horsens, Silkeborg, Djursland m.fl.',
};

/**
 * Byer/kommuner i DST-landsdelen Vestjylland (groft match på stednavn i adresse).
 * @type {Set<string>}
 */
const VESTJYLLAND_PLACES = new Set(
  [
    'herning',
    'holstebro',
    'lemvig',
    'struer',
    'ringkøbing',
    'ringkobing',
    'skive',
    'ikast',
    'brande',
    'videbæk',
    'videbaek',
    'viborg',
    'grindsted',
    'hvide sande',
    'nr. nebel',
    'nørre nebel',
    'mejdal',
    'holstebro',
    'tarm',
    'snejbjerg',
    'sønder felding',
  ].map((s) => s.toLowerCase())
);

/**
 * @param {string} placeOrAddress
 * @returns {BanerRegion}
 */
export function guessJutlandRegionFromPlace(placeOrAddress) {
  const t = String(placeOrAddress || '').toLowerCase();
  for (const p of VESTJYLLAND_PLACES) {
    if (t.includes(p)) return 'Vestjylland';
  }
  return 'Østjylland';
}
