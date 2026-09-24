/**
 * Rækken, som "Jeg vil spille" indsætter i matches. Ligger for sig selv uden
 * Supabase-klienten, så den kan testes direkte fra node.
 */

import { buildMatchLevelRange } from './matchLevelRange.js';
import { defaultMatchLevelEloRange } from './padelLevelUtils.js';

/** Længste tidsrum en hurtig kamp kan have (en kamp er typisk 1½–2 timer). */
export const QUICK_MATCH_MAX_WINDOW_MINUTES = 180;

function clock(t) {
  return String(t || '').slice(0, 5);
}

export function buildQuickMatchRow({ user, date, start, end }) {
  const { min, max } = defaultMatchLevelEloRange(user);
  return {
    creator_id: user.id,
    court_id: null,
    court_name: '',
    date,
    time: clock(start),
    time_end: clock(end),
    level_range: buildMatchLevelRange(min, max, false, user?.elo_rating),
    status: 'open',
    max_players: 4,
    current_players: 0,
    description: `Jeg kan spille ${clock(start)}–${clock(end)}. Vi aftaler bane og præcis tid i chatten.`,
    match_type: 'open',
    price_per_person: 0,
    payment_method: 'free',
  };
}
