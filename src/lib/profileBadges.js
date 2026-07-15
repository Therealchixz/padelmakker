/**
 * Profil-badges pr. spilformat (2v2, americano/mexicano, liga).
 * Inspireret af milestone / rating / streak / social-kategorier fra padel- og fitness-apps.
 */

/** @typedef {'milestone' | 'rating' | 'streak' | 'performance' | 'social'} ProfileBadgeCategory */

/**
 * @typedef {object} ProfileBadgeContext
 * @property {number} games
 * @property {number} wins
 * @property {number} winPct
 * @property {number} elo
 * @property {number|null} peakElo
 * @property {number} currentStreak
 * @property {number} bestStreak
 * @property {number} todayEloChange
 * @property {number} maxPartnerGames
 * @property {number} americanoPlayed
 * @property {number} americanoRounds
 * @property {number} americanoWins
 * @property {number} americanoWinPct
 * @property {number} americanoElo
 * @property {number} leagues
 * @property {number} ligaMatches
 * @property {number} ligaWins
 * @property {number} ligaWinPct
 */

/**
 * @typedef {object} ProfileBadgeDef
 * @property {string} key
 * @property {string} label
 * @property {string} hint
 * @property {string} icon
 * @property {ProfileBadgeCategory} category
 * @property {(ctx: ProfileBadgeContext) => boolean} check
 */

/** @type {Record<'2v2' | 'americano' | 'liga', ProfileBadgeDef[]>} */
export const PROFILE_BADGE_DEFS = {
  '2v2': [
    {
      key: 'debut',
      label: 'Debut',
      hint: 'Spil din første 2v2',
      icon: '🎾',
      category: 'milestone',
      check: (c) => c.games >= 1,
    },
    {
      key: 'team',
      label: 'Holdspiller',
      hint: 'Spil 5 kampe',
      icon: '🤝',
      category: 'milestone',
      check: (c) => c.games >= 5,
    },
    {
      key: 'local',
      label: 'Lokal helt',
      hint: 'Spil 25 kampe',
      icon: '📍',
      category: 'milestone',
      check: (c) => c.games >= 25,
    },
    {
      key: 'veteran',
      label: 'Banens veteran',
      hint: 'Spil 50 kampe',
      icon: '🏟️',
      category: 'milestone',
      check: (c) => c.games >= 50,
    },
    {
      key: 'centurion',
      label: 'Centurion',
      hint: 'Spil 100 kampe',
      icon: '💯',
      category: 'milestone',
      check: (c) => c.games >= 100,
    },
    {
      key: 'elo_1100',
      label: 'ELO 1100',
      hint: 'Nå 1100 ELO',
      icon: '📈',
      category: 'rating',
      check: (c) => c.elo >= 1100,
    },
    {
      key: 'elo_1300',
      label: 'ELO 1300',
      hint: 'Nå 1300 ELO',
      icon: '⭐',
      category: 'rating',
      check: (c) => c.elo >= 1300,
    },
    {
      key: 'elo_1500',
      label: 'ELO 1500',
      hint: 'Nå 1500 ELO',
      icon: '💎',
      category: 'rating',
      check: (c) => c.elo >= 1500,
    },
    {
      key: 'peak',
      label: 'Personlig rekord',
      hint: 'Top-ELO på 1200+',
      icon: '🏔️',
      category: 'rating',
      check: (c) => (c.peakElo ?? c.elo) >= 1200 && c.games >= 5,
    },
    {
      key: 'sprinter',
      label: 'Sprinter',
      hint: '3 sejre i træk',
      icon: '⚡',
      category: 'streak',
      check: (c) => c.currentStreak >= 3,
    },
    {
      key: 'hot_streak',
      label: 'Het stime',
      hint: '5 sejre i træk',
      icon: '🔥',
      category: 'streak',
      check: (c) => c.currentStreak >= 5 || c.bestStreak >= 5,
    },
    {
      key: 'unstoppable',
      label: 'Ustoppelig',
      hint: '7+ sejre i bedste stime',
      icon: '🚀',
      category: 'streak',
      check: (c) => c.bestStreak >= 7,
    },
    {
      key: 'champion',
      label: 'Champion',
      hint: '60% sejr over 10+ kampe',
      icon: '🏆',
      category: 'performance',
      check: (c) => c.games >= 10 && c.winPct >= 60,
    },
    {
      key: 'clutch',
      label: 'Clutch-dag',
      hint: '+30 ELO på én dag',
      icon: '📊',
      category: 'performance',
      check: (c) => c.todayEloChange >= 30,
    },
    {
      key: 'duo',
      label: 'Fast makker',
      hint: '10 kampe med samme makker',
      icon: '👥',
      category: 'social',
      check: (c) => c.maxPartnerGames >= 10,
    },
  ],
  americano: [
    {
      key: 'am_debut',
      label: 'Turneringsdebut',
      hint: 'Spil 1 turnering',
      icon: '🎾',
      category: 'milestone',
      check: (c) => c.americanoPlayed >= 1,
    },
    {
      key: 'am_regular',
      label: 'Fast deltager',
      hint: '5 turneringer',
      icon: '🎫',
      category: 'milestone',
      check: (c) => c.americanoPlayed >= 5,
    },
    {
      key: 'am_veteran',
      label: 'Tour-veteran',
      hint: '15 turneringer',
      icon: '🗺️',
      category: 'milestone',
      check: (c) => c.americanoPlayed >= 15,
    },
    {
      key: 'am_marathon',
      label: 'Runde-maskine',
      hint: '50 runder spillet',
      icon: '⚙️',
      category: 'milestone',
      check: (c) => c.americanoRounds >= 50,
    },
    {
      key: 'am_century',
      label: '100 runder',
      hint: '100 runder spillet',
      icon: '💯',
      category: 'milestone',
      check: (c) => c.americanoRounds >= 100,
    },
    {
      key: 'am_elo_1050',
      label: 'Tour-ELO 1050',
      hint: 'Nå 1050 turnerings-ELO',
      icon: '📈',
      category: 'rating',
      check: (c) => c.americanoElo >= 1050,
    },
    {
      key: 'am_elo_1200',
      label: 'Tour-ELO 1200',
      hint: 'Nå 1200 turnerings-ELO',
      icon: '⭐',
      category: 'rating',
      check: (c) => c.americanoElo >= 1200,
    },
    {
      key: 'am_elo_1400',
      label: 'Tour-ELO 1400',
      hint: 'Nå 1400 turnerings-ELO',
      icon: '💎',
      category: 'rating',
      check: (c) => c.americanoElo >= 1400,
    },
    {
      key: 'am_winner',
      label: 'Runde-vinder',
      hint: '20 runder vundet',
      icon: '✅',
      category: 'performance',
      check: (c) => c.americanoWins >= 20,
    },
    {
      key: 'am_dominator',
      label: 'Dominerende',
      hint: '60% runde-sejr over 30+ runder',
      icon: '🏆',
      category: 'performance',
      check: (c) => c.americanoRounds >= 30 && c.americanoWinPct >= 60,
    },
    {
      key: 'am_grinder',
      label: 'Grinder',
      hint: '10 turneringer + 30 runder',
      icon: '🔁',
      category: 'performance',
      check: (c) => c.americanoPlayed >= 10 && c.americanoRounds >= 30,
    },
    {
      key: 'am_social',
      label: 'Social spinner',
      hint: '3 forskellige turneringer',
      icon: '🎡',
      category: 'social',
      check: (c) => c.americanoPlayed >= 3,
    },
  ],
  liga: [
    {
      key: 'lg_debut',
      label: 'Liga-debut',
      hint: 'Tilmeld dig en liga',
      icon: '🏅',
      category: 'milestone',
      check: (c) => c.leagues >= 1,
    },
    {
      key: 'lg_player',
      label: 'Ligaspiller',
      hint: '5 ligakampe',
      icon: '🎾',
      category: 'milestone',
      check: (c) => c.ligaMatches >= 5,
    },
    {
      key: 'lg_veteran',
      label: 'Liga-veteran',
      hint: '20 ligakampe',
      icon: '🏟️',
      category: 'milestone',
      check: (c) => c.ligaMatches >= 20,
    },
    {
      key: 'lg_multi',
      label: 'Serieliga',
      hint: '2+ ligaer',
      icon: '📋',
      category: 'milestone',
      check: (c) => c.leagues >= 2,
    },
    {
      key: 'lg_port',
      label: 'Ligaport',
      hint: '10 rapporterede kampe',
      icon: '🚪',
      category: 'milestone',
      check: (c) => c.ligaMatches >= 10,
    },
    {
      key: 'lg_wins_5',
      label: 'Pointjæger',
      hint: '5 ligasejre',
      icon: '✅',
      category: 'performance',
      check: (c) => c.ligaWins >= 5,
    },
    {
      key: 'lg_wins_15',
      label: 'Liga-mester',
      hint: '15 ligasejre',
      icon: '🏆',
      category: 'performance',
      check: (c) => c.ligaWins >= 15,
    },
    {
      key: 'lg_clutch',
      label: 'Vinderprocent',
      hint: '60% sejr over 10+ kampe',
      icon: '📊',
      category: 'performance',
      check: (c) => c.ligaMatches >= 10 && c.ligaWinPct >= 60,
    },
    {
      key: 'lg_dominant',
      label: 'Dominans',
      hint: '70% sejr over 15+ kampe',
      icon: '💪',
      category: 'performance',
      check: (c) => c.ligaMatches >= 15 && c.ligaWinPct >= 70,
    },
    {
      key: 'lg_team',
      label: 'Holdånd',
      hint: '10 kampe i samme liga',
      icon: '🤝',
      category: 'social',
      check: (c) => c.ligaMatches >= 10 && c.leagues >= 1,
    },
  ],
};

export const PROFILE_BADGE_CATEGORY_LABELS = {
  milestone: 'Milepæle',
  rating: 'Rating',
  streak: 'Stime',
  performance: 'Præstation',
  social: 'Socialt',
};

/**
 * @param {'2v2' | 'americano' | 'liga'} mode
 * @param {Partial<ProfileBadgeContext>} raw
 */
export function buildProfileBadgeContext(raw = {}) {
  return {
    games: Number(raw.games) || 0,
    wins: Number(raw.wins) || 0,
    winPct: Number(raw.winPct) || 0,
    elo: Number(raw.elo) || 0,
    peakElo: raw.peakElo != null ? Number(raw.peakElo) : null,
    currentStreak: Number(raw.currentStreak) || 0,
    bestStreak: Number(raw.bestStreak) || 0,
    todayEloChange: Number(raw.todayEloChange) || 0,
    maxPartnerGames: Number(raw.maxPartnerGames) || 0,
    americanoPlayed: Number(raw.americanoPlayed) || 0,
    americanoRounds: Number(raw.americanoRounds) || 0,
    americanoWins: Number(raw.americanoWins) || 0,
    americanoWinPct: Number(raw.americanoWinPct) || 0,
    americanoElo: Number(raw.americanoElo) || 0,
    leagues: Number(raw.leagues) || 0,
    ligaMatches: Number(raw.ligaMatches) || 0,
    ligaWins: Number(raw.ligaWins) || 0,
    ligaWinPct: Number(raw.ligaWinPct) || 0,
  };
}

/**
 * @param {'2v2' | 'americano' | 'liga'} mode
 * @param {Partial<ProfileBadgeContext>} raw
 */
export function getProfileBadges(mode, raw = {}) {
  const ctx = buildProfileBadgeContext(raw);
  const defs = PROFILE_BADGE_DEFS[mode] || [];
  return defs.map((def) => ({
    key: def.key,
    label: def.label,
    hint: def.hint,
    icon: def.icon,
    category: def.category,
    earned: def.check(ctx),
  }));
}

/**
 * @param {ReturnType<typeof getProfileBadges>} badges
 */
export function groupProfileBadgesByCategory(badges) {
  const order = ['milestone', 'rating', 'streak', 'performance', 'social'];
  const groups = new Map();
  for (const badge of badges) {
    const cat = badge.category || 'milestone';
    if (!groups.has(cat)) groups.set(cat, []);
    groups.get(cat).push(badge);
  }
  return order
    .filter((cat) => groups.has(cat))
    .map((cat) => ({
      category: cat,
      label: PROFILE_BADGE_CATEGORY_LABELS[cat] || cat,
      badges: groups.get(cat),
    }));
}
