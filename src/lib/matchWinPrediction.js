import { eloV2ExpectedScore } from './eloV2Math.js';

const LOW_CONFIDENCE_GAMES = 10;

/**
 * @param {Array<{ rating: number, gamesPlayed?: number }>} team1
 * @param {Array<{ rating: number, gamesPlayed?: number }>} team2
 */
export function calculate2v2MatchWinPrediction(team1, team2) {
  if (!Array.isArray(team1) || !Array.isArray(team2) || team1.length !== 2 || team2.length !== 2) {
    return null;
  }

  const ratings1 = team1.map((p) => Number(p.rating) || 1000);
  const ratings2 = team2.map((p) => Number(p.rating) || 1000);
  const t1Avg = (ratings1[0] + ratings1[1]) / 2;
  const t2Avg = (ratings2[0] + ratings2[1]) / 2;

  const team1Expected =
    (eloV2ExpectedScore(ratings1[0], t2Avg) + eloV2ExpectedScore(ratings1[1], t2Avg)) / 2;
  const team2Expected =
    (eloV2ExpectedScore(ratings2[0], t1Avg) + eloV2ExpectedScore(ratings2[1], t1Avg)) / 2;

  const totalExpected = team1Expected + team2Expected;
  const team1WinPct =
    totalExpected > 0 ? Math.round((team1Expected / totalExpected) * 100) : 50;
  const team2WinPct = 100 - team1WinPct;

  const gamesPlayed = [...team1, ...team2].map((p) => Math.max(0, Number(p.gamesPlayed) || 0));
  const approximate = gamesPlayed.some((g) => g < LOW_CONFIDENCE_GAMES);
  const minGames = Math.min(...gamesPlayed);

  const eloDiff = Math.round(Math.abs(t1Avg - t2Avg));
  const quality =
    eloDiff <= 50
      ? 'Tæt match'
      : eloDiff <= 150
        ? 'Lille forskel'
        : eloDiff <= 300
          ? 'Moderat forskel'
          : 'Stor forskel';

  return {
    team1WinPct,
    team2WinPct,
    approximate,
    minGamesPlayed: minGames,
    quality,
    eloDiff,
    t1Avg: Math.round(t1Avg),
    t2Avg: Math.round(t2Avg),
  };
}

/** @param {number} pct @param {boolean} approximate */
export function formatWinPredictionPct(pct, approximate = false) {
  const n = Math.max(0, Math.min(100, Math.round(Number(pct) || 0)));
  return approximate ? `ca. ${n}%` : `${n}%`;
}
