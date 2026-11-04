/**
 * @typedef {{ player_count: number; open_matches: number; matches_last_30_days: number }} LandingPublicStats
 */

/** @param {unknown} raw */
export function normalizeLandingPublicStats(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const o = /** @type {Record<string, unknown>} */ (raw);
  const toCount = (value) => {
    const n = Number(value);
    if (!Number.isFinite(n) || n < 0) return 0;
    return Math.floor(n);
  };
  return {
    player_count: toCount(o.player_count),
    open_matches: toCount(o.open_matches),
    matches_last_30_days: toCount(o.matches_last_30_days),
  };
}

/** @param {number} n */
export function formatLandingStatCount(n) {
  if (!Number.isFinite(n) || n <= 0) return '—';
  return n.toLocaleString('da-DK');
}

/** Mindste tal, før et "live"-tal vises på forsiden. Under det viser vi faste fakta i stedet. */
export const LANDING_STAT_MIN = {
  // Et lille landsdækkende tal læses som "her er ingen nær mig" lige under løftet om
  // spillere i nærheden. Vis det først, når det er overbevisende (Impeccable, 4. nov. 2026).
  player_count: 500,
  open_matches: 5,
  matches_last_30_days: 10,
};

/**
 * Faste fakta, der altid er sande. Bruges når live-tallene er for små eller ikke kan hentes,
 * så forsiden aldrig viser "—" eller "0" (det læses som "her sker ingenting").
 */
const LANDING_STAT_FACTS = [
  { n: '150+', l: 'Centre med ledige tider' },
  { n: '4', l: 'Bookingsystemer samlet ét sted' },
  { n: 'ELO', l: 'Rating efter hver bekræftet kamp' },
  { n: 'Gratis', l: 'Opret profil uden betaling' },
];

const GRATIS_FACT = LANDING_STAT_FACTS[LANDING_STAT_FACTS.length - 1];

/**
 * Byg de fire felter i tal-båndet under toppen af forsiden.
 * Live-tal vises kun, når de er store nok; resten fyldes op med faste fakta.
 * @param {LandingPublicStats | null} stats
 * @returns {{ n: string; l: string }[]}
 */
export function buildLandingStatsItems(stats) {
  /** @type {{ n: string; l: string }[]} */
  const live = [];
  if (stats) {
    if (stats.player_count >= LANDING_STAT_MIN.player_count) {
      live.push({ n: formatLandingStatCount(stats.player_count), l: 'Spillere på platformen' });
    }
    if (stats.open_matches >= LANDING_STAT_MIN.open_matches) {
      live.push({ n: formatLandingStatCount(stats.open_matches), l: 'Åbne kampe lige nu' });
    }
    if (stats.matches_last_30_days >= LANDING_STAT_MIN.matches_last_30_days) {
      live.push({ n: formatLandingStatCount(stats.matches_last_30_days), l: 'Kampe spillet de sidste 30 dage' });
    }
  }
  const items = live.slice(0, 3);
  for (const fact of LANDING_STAT_FACTS) {
    if (items.length >= 4) break;
    items.push(fact);
  }
  // "Gratis" skal altid med som sidste felt.
  if (!items.includes(GRATIS_FACT)) items[items.length - 1] = GRATIS_FACT;
  return items;
}

/**
 * Linjerne i det rullende baand nederst paa forsidens foto.
 * Kun rigtige tal (over minimum) og faste fakta; aldrig navne eller opdigtet aktivitet.
 * @param {LandingPublicStats | null} stats
 * @returns {string[]}
 */
export function buildLandingTickerItems(stats) {
  /** @type {string[]} */
  const items = [];
  if (stats) {
    if (stats.open_matches >= LANDING_STAT_MIN.open_matches) {
      items.push(`${formatLandingStatCount(stats.open_matches)} åbne kampe lige nu`);
    }
    if (stats.matches_last_30_days >= LANDING_STAT_MIN.matches_last_30_days) {
      items.push(`${formatLandingStatCount(stats.matches_last_30_days)} kampe spillet de sidste 30 dage`);
    }
    if (stats.player_count >= LANDING_STAT_MIN.player_count) {
      items.push(`${formatLandingStatCount(stats.player_count)} spillere`);
    }
  }
  items.push(
    '150+ centre med ledige tider',
    'Halbooking, MATCHi, Bookli og Playtomic samlet',
    '2v2, Americano, Mexicano og Liga',
    'ELO efter hver bekræftet kamp',
    'Gratis profil',
  );
  return items;
}

/**
 * Den gule statuslinje under knappen i toppen. Viser antal aabne kampe, naar tallet er stort nok.
 * @param {LandingPublicStats | null} stats
 * @returns {string}
 */
export function buildLandingLiveLine(stats) {
  if (stats && stats.open_matches >= LANDING_STAT_MIN.open_matches) {
    return `${formatLandingStatCount(stats.open_matches)} åbne kampe i Danmark lige nu`;
  }
  return 'Gratis at bruge i hele Danmark';
}

/**
 * Kun de rigtige tal over minimum (til tal-baandet). Tom liste = vis ikke baandet.
 * @param {LandingPublicStats | null} stats
 * @returns {{ n: string; l: string }[]}
 */
export function buildLandingLiveStats(stats) {
  if (!stats) return [];
  /** @type {{ n: string; l: string }[]} */
  const live = [];
  if (stats.open_matches >= LANDING_STAT_MIN.open_matches) {
    live.push({ n: formatLandingStatCount(stats.open_matches), l: 'Åbne kampe lige nu' });
  }
  if (stats.matches_last_30_days >= LANDING_STAT_MIN.matches_last_30_days) {
    live.push({ n: formatLandingStatCount(stats.matches_last_30_days), l: 'Kampe spillet de sidste 30 dage' });
  }
  if (stats.player_count >= LANDING_STAT_MIN.player_count) {
    live.push({ n: formatLandingStatCount(stats.player_count), l: 'Spillere på platformen' });
  }
  return live;
}

/** Er der et rigtigt "lige nu"-tal at vise i den gule linje? */
export function hasLandingLiveCount(stats) {
  return Boolean(stats && stats.open_matches >= LANDING_STAT_MIN.open_matches);
}
