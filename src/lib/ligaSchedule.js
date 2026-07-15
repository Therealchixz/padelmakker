/**
 * Liga-kampsystemer: round robin, Swiss og knockout.
 * Swiss-parring lever i ligaStandings.generatePairings — wrapper her.
 */
import { computeStandings, generatePairings, groupByDivision } from './ligaStandings.js';

export const LIGA_MATCH_SYSTEMS = Object.freeze(['round_robin', 'swiss', 'knockout']);

/** @param {{ match_system?: string|null }} league */
export function resolveLigaMatchSystem(league) {
  const raw = String(league?.match_system || '').toLowerCase().trim();
  if (raw === 'round_robin' || raw === 'swiss' || raw === 'knockout') return raw;
  // Ældre ligaer uden felt brugte Swiss-parring.
  return 'swiss';
}

/** Alias — samme Swiss-algoritme som historisk generatePairings. */
export function generateSwissPairings(standings, allMatches) {
  return generatePairings(standings, allMatches);
}

export function swissTotalRounds(teamCount) {
  const n = Math.max(2, Number(teamCount) || 2);
  return Math.min(n - 1, Math.max(3, Math.ceil(Math.log2(n)) + 1));
}

export function knockoutTotalRounds(teamCount) {
  const n = Math.max(2, Number(teamCount) || 2);
  return Math.ceil(Math.log2(n));
}

export function nextPowerOfTwo(n) {
  let p = 1;
  const target = Math.max(1, Number(n) || 1);
  while (p < target) p *= 2;
  return p;
}

/**
 * Circle-method alle-mod-alle.
 * Lige n → n-1 runder; ulige n → n runder (én bye pr. runde).
 * @param {string[]} teamIds
 * @returns {{ rounds: Array<Array<{ team1_id: string, team2_id: string|null }>>, totalRounds: number }}
 */
export function generateRoundRobinRounds(teamIds) {
  const ids = [...new Set((teamIds || []).filter(Boolean))];
  if (ids.length < 2) {
    return { rounds: [], totalRounds: 0 };
  }

  let arr = [...ids];
  const odd = arr.length % 2 === 1;
  if (odd) arr.push(null);

  const n = arr.length;
  const half = n / 2;
  const totalRounds = n - 1;
  const rounds = [];

  for (let r = 0; r < totalRounds; r += 1) {
    const pairs = [];
    for (let i = 0; i < half; i += 1) {
      const a = arr[i];
      const b = arr[n - 1 - i];
      if (a && b) pairs.push({ team1_id: a, team2_id: b });
      else if (a || b) pairs.push({ team1_id: a || b, team2_id: null });
    }
    rounds.push(pairs);
    // Roter alle undtagen første position.
    arr = [arr[0], arr[n - 1], ...arr.slice(1, n - 1)];
  }

  return { rounds, totalRounds };
}

/**
 * Knockout runde 1: seedet rækkefølge (stærkest først), byes til top seeds.
 * @param {string[]} seededTeamIds
 */
export function generateKnockoutRound1(seededTeamIds) {
  const seeds = [...(seededTeamIds || [])].filter(Boolean);
  if (seeds.length < 2) return [];

  const bracketSize = nextPowerOfTwo(seeds.length);
  const byeCount = bracketSize - seeds.length;
  const pairs = [];

  for (let i = 0; i < byeCount; i += 1) {
    pairs.push({ team1_id: seeds[i], team2_id: null });
  }

  const remaining = seeds.slice(byeCount);
  let left = 0;
  let right = remaining.length - 1;
  while (left < right) {
    pairs.push({ team1_id: remaining[left], team2_id: remaining[right] });
    left += 1;
    right -= 1;
  }

  return pairs;
}

/**
 * Næste knockout-runde: par tilstødende vindere i den rækkefølge kampene stod.
 * @param {Array<{ winner_id?: string|null, team1_id?: string, team2_id?: string|null }>} prevRoundMatches
 */
export function generateKnockoutNextRound(prevRoundMatches) {
  const rows = Array.isArray(prevRoundMatches) ? prevRoundMatches : [];
  const winners = rows.map((m) => m?.winner_id).filter(Boolean);
  if (winners.length < 2) return [];

  const pairs = [];
  for (let i = 0; i < winners.length; i += 2) {
    if (i + 1 < winners.length) {
      pairs.push({ team1_id: winners[i], team2_id: winners[i + 1] });
    } else {
      pairs.push({ team1_id: winners[i], team2_id: null });
    }
  }
  return pairs;
}

function pairingToMatchRow(leagueId, roundNumber, pairing) {
  const hasOpponent = Boolean(pairing.team2_id);
  return {
    league_id: leagueId,
    round_number: roundNumber,
    team1_id: pairing.team1_id,
    team2_id: pairing.team2_id || null,
    status: hasOpponent ? 'pending' : 'reported',
    winner_id: hasOpponent ? null : pairing.team1_id,
  };
}

function teamsSortedByElo(teams) {
  return [...(teams || [])].sort(
    (a, b) => (Number(b.elo_combined) || 0) - (Number(a.elo_combined) || 0),
  );
}

/**
 * @param {{ league: object, teamsByDivision: Array<[number, object[]]> }} args
 * @returns {{ rows: object[], totalRounds: number }}
 */
export function buildInitialLeagueMatches({ league, teamsByDivision }) {
  const leagueId = league?.id;
  const system = resolveLigaMatchSystem(league);
  const groups = Array.isArray(teamsByDivision) && teamsByDivision.length
    ? teamsByDivision
    : [[1, []]];

  const rows = [];
  let totalRounds = 0;

  for (const [, divTeams] of groups) {
    const teams = Array.isArray(divTeams) ? divTeams : [];
    if (teams.length < 2) continue;

    if (system === 'round_robin') {
      const { rounds, totalRounds: rrRounds } = generateRoundRobinRounds(teams.map((t) => t.id));
      totalRounds = Math.max(totalRounds, rrRounds);
      rounds.forEach((pairings, idx) => {
        const rn = idx + 1;
        for (const p of pairings) rows.push(pairingToMatchRow(leagueId, rn, p));
      });
      continue;
    }

    if (system === 'knockout') {
      const seeded = teamsSortedByElo(teams).map((t) => t.id);
      const pairings = generateKnockoutRound1(seeded);
      totalRounds = Math.max(totalRounds, knockoutTotalRounds(teams.length));
      for (const p of pairings) rows.push(pairingToMatchRow(leagueId, 1, p));
      continue;
    }

    // swiss
    const standings = computeStandings(teams, []);
    const pairings = generateSwissPairings(standings, []);
    totalRounds = Math.max(totalRounds, swissTotalRounds(teams.length));
    for (const p of pairings) rows.push(pairingToMatchRow(leagueId, 1, p));
  }

  return { rows, totalRounds: Math.max(1, totalRounds) };
}

/**
 * @param {{
 *   league: object,
 *   teamsByDivision: Array<[number, object[]]>,
 *   allMatches: object[],
 * }} args
 * @returns {{ rows?: object[], advanceOnly?: boolean, done?: boolean, reason?: string }}
 */
export function buildNextLeagueRound({ league, teamsByDivision, allMatches }) {
  const leagueId = league?.id;
  const system = resolveLigaMatchSystem(league);
  const currentRound = Number(league?.current_round) || 1;
  const nextRound = currentRound + 1;
  const matches = Array.isArray(allMatches) ? allMatches : [];
  const groups = Array.isArray(teamsByDivision) && teamsByDivision.length
    ? teamsByDivision
    : [[1, []]];

  const totalRounds = Number(league?.total_rounds) || 0;
  if (totalRounds && currentRound >= totalRounds) {
    return { done: true, reason: 'all_rounds_played' };
  }

  if (system === 'round_robin') {
    const existingNext = matches.filter((m) => Number(m.round_number) === nextRound);
    if (existingNext.length > 0) {
      return { advanceOnly: true, rows: [] };
    }
    return { done: true, reason: 'schedule_exhausted' };
  }

  if (system === 'knockout') {
    const rows = [];
    let anyReal = false;
    let champions = 0;

    for (const [, divTeams] of groups) {
      const teamIds = new Set((divTeams || []).map((t) => t.id));
      // Bevar bracket-rækkefølge (insert/created_at) — ikke team-id alfabetisk.
      const prev = matches
        .filter((m) => Number(m.round_number) === currentRound)
        .filter((m) => teamIds.has(m.team1_id) || (m.team2_id && teamIds.has(m.team2_id)))
        .slice()
        .sort((a, b) => {
          const ta = a.created_at ? Date.parse(a.created_at) : NaN;
          const tb = b.created_at ? Date.parse(b.created_at) : NaN;
          if (!Number.isNaN(ta) && !Number.isNaN(tb) && ta !== tb) return ta - tb;
          return String(a.id || '').localeCompare(String(b.id || ''));
        });

      const winners = prev.map((m) => m.winner_id).filter(Boolean);
      if (winners.length <= 1) {
        if (winners.length === 1) champions += 1;
        continue;
      }

      const pairings = generateKnockoutNextRound(prev);
      for (const p of pairings) {
        if (p.team2_id) anyReal = true;
        rows.push(pairingToMatchRow(leagueId, nextRound, p));
      }
    }

    if (!rows.length) {
      return { done: true, reason: champions > 0 ? 'champion' : 'no_pairings' };
    }
    if (!anyReal && rows.every((r) => !r.team2_id)) {
      return { done: true, reason: 'champion' };
    }
    return { rows };
  }

  // swiss
  const rows = [];
  let anyReal = false;
  for (const [, divTeams] of groups) {
    const teams = Array.isArray(divTeams) ? divTeams : [];
    if (teams.length < 2) continue;
    const divTeamIds = new Set(teams.map((t) => t.id));
    const divMatches = matches.filter(
      (m) => divTeamIds.has(m.team1_id) || (m.team2_id && divTeamIds.has(m.team2_id)),
    );
    const standings = computeStandings(teams, divMatches);
    const pairings = generateSwissPairings(standings, divMatches);
    for (const p of pairings) {
      if (p.team2_id) anyReal = true;
      rows.push(pairingToMatchRow(leagueId, nextRound, p));
    }
  }

  if (!anyReal) {
    return { done: true, reason: 'no_pairings' };
  }
  return { rows };
}

/**
 * Hjælper: bygg division-grupper fra teams med division-felt.
 * @param {object[]} teams
 * @param {number} numDivisions
 */
export function divisionGroupsFromTeams(teams, numDivisions = 1) {
  const list = Array.isArray(teams) ? teams : [];
  const numDiv = Math.min(Math.max(1, Number(numDivisions) || 1), Math.max(1, list.length));
  if (numDiv > 1) return groupByDivision(list);
  return [[1, list]];
}
