/**
 * JS reference-implementation af 2v2 ELO-algoritmen som ligger i
 * `apply_elo_for_match_core` i supabase/sql/elo_v2_glicko2_shadow.sql.
 *
 * Bruges til:
 *   - Unit tests (kan teste invarianter uden at ramme Supabase)
 *   - UI-preview af ELO-ændring inden bekræftelse (valgfri)
 *
 * VIGTIGT: Hvis SQL'en ændres, skal denne fil opdateres synkront. Ellers vil
 * UI-preview vise andre tal end den faktiske beregning.
 *
 * Algoritmen:
 *   1. expected = 1 / (1 + 10^((opp_avg - rating) / 400))
 *   2. k = 56 / 44 / 32 efter games_played (<10 / <30 / else)
 *   3. margin_mult = 1.0 / 1.20 / 1.40 / 1.60 efter |t1_games - t2_games|
 *   4. delta_raw = k * (outcome - expected) * margin_mult
 *   5. zero-sum korrektion: træk gennemsnit fra delta_raw, rund, fordel rest
 *   6. floor cap: rating kan ikke falde under 100
 */

const BASE_RATING = 1000;
const MIN_RATING = 100;

export function roundHalfAwayFromZero(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return n >= 0 ? Math.floor(n + 0.5) : Math.ceil(n - 0.5);
}

/** Forventet score for spiller mod modstander-holdets snit. */
export function eloV2ExpectedScore(rating, oppAvg) {
  return 1 / (1 + Math.pow(10, (oppAvg - rating) / 400));
}

/** K-faktor falder med erfaring. */
export function eloV2KFactor(gamesPlayed) {
  const g = Number(gamesPlayed) || 0;
  if (g < 10) return 56;
  if (g < 30) return 44;
  return 32;
}

/** Margin-multiplier baseret på samlet parti-difference over 1-3 sæt. */
export function eloV2MarginMultiplier(team1Games, team2Games) {
  const margin = Math.abs((Number(team1Games) || 0) - (Number(team2Games) || 0));
  if (margin <= 4) return 1.0;
  if (margin <= 9) return 1.2;
  if (margin <= 14) return 1.4;
  return 1.6;
}

/**
 * Beregn ELO-ændringer for en bekræftet 2v2-kamp.
 *
 * @param {{
 *   players: Array<{ userId: string, team: 1|2, rating: number, gamesPlayed: number }>,
 *   winner: 'team1' | 'team2',
 *   team1Games: number,
 *   team2Games: number,
 * }} input
 * @returns Array<{ userId, team, oldRating, delta, newRating }> — sum(delta) = 0
 * (medmindre en spiller rammer minRating-loftet).
 */
export function calculate2v2EloChanges(input) {
  const players = Array.isArray(input?.players) ? input.players : [];
  if (players.length !== 4) {
    throw new Error('2v2 ELO kræver præcis 4 spillere');
  }
  const t1 = players.filter((p) => Number(p.team) === 1);
  const t2 = players.filter((p) => Number(p.team) === 2);
  if (t1.length !== 2 || t2.length !== 2) {
    throw new Error('2v2 ELO kræver 2 spillere pr. hold');
  }
  const userIds = new Set(players.map((p) => String(p.userId)));
  if (userIds.size !== 4) {
    throw new Error('Spillere skal være unikke');
  }
  if (input.winner !== 'team1' && input.winner !== 'team2') {
    throw new Error('winner skal være "team1" eller "team2"');
  }

  const team1Won = input.winner === 'team1';
  const marginMult = eloV2MarginMultiplier(input.team1Games, input.team2Games);

  const t1Avg = (Number(t1[0].rating) + Number(t1[1].rating)) / 2;
  const t2Avg = (Number(t2[0].rating) + Number(t2[1].rating)) / 2;

  /* Step 1: rå delta pr. spiller */
  const raw = players.map((p) => {
    const team = Number(p.team);
    const rating = Number(p.rating) || BASE_RATING;
    const oppAvg = team === 1 ? t2Avg : t1Avg;
    const expected = eloV2ExpectedScore(rating, oppAvg);
    const outcome = (team === 1 && team1Won) || (team === 2 && !team1Won) ? 1 : 0;
    const k = eloV2KFactor(p.gamesPlayed);
    const deltaRaw = k * (outcome - expected) * marginMult;
    return {
      userId: String(p.userId),
      team,
      oldRating: Math.round(rating),
      gamesPlayed: Number(p.gamesPlayed) || 0,
      expected,
      outcome,
      k,
      deltaRaw,
    };
  });

  /* Step 2: center omkring 0 og rund. Sum bør være ~0 efter centrering. */
  const avgRaw = raw.reduce((s, r) => s + r.deltaRaw, 0) / raw.length;
  const centered = raw.map((r) => ({
    ...r,
    deltaCentered: r.deltaRaw - avgRaw,
    deltaRounded: roundHalfAwayFromZero(r.deltaRaw - avgRaw),
  }));

  /* Step 3: fordel rounding-rest så summen bliver præcis 0.
     SQL'en sorterer efter rounding_residual, derefter delta_rounded, derefter user_id. */
  let totalDelta = centered.reduce((s, r) => s + r.deltaRounded, 0);
  const adjusted = centered.map((r) => ({ ...r }));

  if (totalDelta > 0) {
    const order = [...adjusted].sort((a, b) => {
      const arRes = a.deltaRounded - a.deltaCentered;
      const brRes = b.deltaRounded - b.deltaCentered;
      if (brRes !== arRes) return brRes - arRes;
      if (b.deltaRounded !== a.deltaRounded) return b.deltaRounded - a.deltaRounded;
      return a.userId < b.userId ? -1 : 1;
    });
    for (let i = 0; i < totalDelta; i += 1) {
      order[i].deltaRounded -= 1;
    }
  } else if (totalDelta < 0) {
    const need = Math.abs(totalDelta);
    const order = [...adjusted].sort((a, b) => {
      const arRes = a.deltaRounded - a.deltaCentered;
      const brRes = b.deltaRounded - b.deltaCentered;
      if (arRes !== brRes) return arRes - brRes;
      if (a.deltaRounded !== b.deltaRounded) return a.deltaRounded - b.deltaRounded;
      return a.userId < b.userId ? -1 : 1;
    });
    for (let i = 0; i < need; i += 1) {
      order[i].deltaRounded += 1;
    }
  }

  /* Step 4: rating-floor cap (delta kan ikke trække under min_rating). */
  const capped = adjusted.map((r) => {
    const minDelta = MIN_RATING - r.oldRating;
    const deltaCapped = Math.max(r.deltaRounded, minDelta);
    return { ...r, minDelta, deltaCapped };
  });

  /* Step 5: hvis nogle blev cappet, fordel "overskuddet" til spillere der
     vandt point — så zero-sum bevares så vidt muligt. */
  const overflowTotal = capped.reduce((s, r) => s + (r.deltaCapped - r.deltaRounded), 0);
  if (overflowTotal > 0) {
    const capOrdered = [...capped].sort((a, b) => {
      if (b.deltaCapped !== a.deltaCapped) return b.deltaCapped - a.deltaCapped;
      return a.userId < b.userId ? -1 : 1;
    });
    let remaining = overflowTotal;
    for (const r of capOrdered) {
      if (remaining <= 0) break;
      const giveBackCapacity = Math.max(r.deltaCapped - r.minDelta, 0);
      const giveBack = Math.min(giveBackCapacity, remaining);
      r.deltaCapped -= giveBack;
      remaining -= giveBack;
    }
  }

  return capped.map((r) => ({
    userId: r.userId,
    team: r.team,
    oldRating: r.oldRating,
    delta: r.deltaCapped,
    newRating: Math.max(MIN_RATING, r.oldRating + r.deltaCapped),
  }));
}
