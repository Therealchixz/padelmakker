import test from 'node:test';
import assert from 'node:assert/strict';

import { scoreCandidate, getMatchSuggestions, matchReason } from '../../src/lib/matchmakingUtils.js';

const ACTIVE = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

function profile(overrides = {}) {
  return {
    id: 'me',
    elo_rating: 1000,
    games_played: 30,
    games_won: 15,
    last_active_at: ACTIVE,
    available_days: ['mandag', 'onsdag'],
    intent_now: 'traening',
    court_side: 'venstre',
    area: 'Hovedstaden',
    level: 5,
    ...overrides,
  };
}

test('past-matches boost lifts a familiar partner above an equally skilled stranger', () => {
  const me = profile({ id: 'me' });
  const stranger = profile({ id: 'stranger' });
  const familiar = profile({ id: 'familiar' });

  const strangerScore = scoreCandidate(me, stranger).total;
  const familiarScore = scoreCandidate(me, familiar, {
    pastMatchesByUserId: {
      familiar: { asTeammate: 4, winsAsTeammate: 3, asOpponent: 4, winsAgainst: 2 },
    },
  }).total;

  assert.ok(familiarScore > strangerScore, `familiar (${familiarScore}) should beat stranger (${strangerScore})`);
});

test('past-matches boost requires at least 2 shared matches to count chemistry', () => {
  const me = profile({ id: 'me' });
  const single = profile({ id: 'single' });
  const result = scoreCandidate(me, single, {
    pastMatchesByUserId: { single: { asTeammate: 1, winsAsTeammate: 1, asOpponent: 0, winsAgainst: 0 } },
  });
  assert.ok((result.breakdown.pastMatchesBoost || 0) <= 0.04, 'tiny boost only from familiarity factor');
});

test('favorite gets a clear boost over equally rated non-favorite', () => {
  /* Tighter baseline profile so the boost has room before hitting the 100 cap. */
  const meSmall = profile({ id: 'me', area: 'Sjælland', intent_now: 'hygge' });
  const favSmall = profile({ id: 'fav', area: 'Fyn', intent_now: 'konkurrence' });
  const otherSmall = profile({ id: 'other', area: 'Fyn', intent_now: 'konkurrence' });

  const baseline = scoreCandidate(meSmall, otherSmall).total;
  const boosted = scoreCandidate(meSmall, favSmall, { favoriteIds: new Set(['fav']) }).total;

  assert.ok(boosted - baseline >= 10, `favorite should outrank non-favorite (got ${boosted} vs ${baseline})`);
});

test('win-rate context lifts an underrated player and lowers an overrated one', () => {
  const me = profile({ id: 'me', elo_rating: 1000, games_played: 30, games_won: 15 });
  const underrated = profile({ id: 'u', elo_rating: 950, games_played: 30, games_won: 22 });
  const overrated = profile({ id: 'o', elo_rating: 1050, games_played: 30, games_won: 8 });

  const u = scoreCandidate(me, underrated);
  const o = scoreCandidate(me, overrated);
  /* En underrated 950-spiller (73% sejre) skal læse som ca. 1000-spiller — bedre skill-match end raw ELO antyder */
  assert.ok(u.breakdown.skill > o.breakdown.skill, `underrated skill ${u.breakdown.skill.toFixed(2)} > overrated ${o.breakdown.skill.toFixed(2)}`);
});

test('cold-start uses signup level when player has fewer than 5 games', () => {
  const me = profile({ id: 'me', games_played: 30, level: 5, elo_rating: 1000 });
  /* En ny spiller (0 kampe, level 9) skal læse som ca. 1156 ELO, ikke 1000 */
  const newbie = profile({ id: 'n', games_played: 0, games_won: 0, level: 9, elo_rating: 1000 });
  const veteran = profile({ id: 'v', games_played: 30, games_won: 15, level: 9, elo_rating: 1000 });

  const newbieResult = scoreCandidate(me, newbie);
  const veteranResult = scoreCandidate(me, veteran);
  /* For me (ELO 1000) skal newbie (efter cold-start) virke længere væk end veteran (rå ELO 1000) */
  assert.ok(newbieResult.breakdown.skill < veteranResult.breakdown.skill, 'cold-start newbie level=9 gets distance from me=1000');
});

test('fallback scores for empty profiles do not exceed the new floor', () => {
  const me = profile({ id: 'me', available_days: [], intent_now: null, court_side: null, area: null });
  const them = profile({ id: 'them', available_days: [], intent_now: null, court_side: null, area: null });
  const result = scoreCandidate(me, them);
  /* Empty profiles should not rank as high as fully-filled ones */
  assert.ok(result.breakdown.time <= 0.4, `time fallback tightened: ${result.breakdown.time}`);
  assert.ok(result.breakdown.intent <= 0.45, `intent fallback tightened: ${result.breakdown.intent}`);
  assert.ok(result.breakdown.geo <= 0.35, `geo fallback tightened: ${result.breakdown.geo}`);
});

test('matchReason mentions favoriter and past-history when relevant', () => {
  const me = profile({ id: 'me' });
  const fav = profile({ id: 'fav' });
  const result = scoreCandidate(me, fav, {
    favoriteIds: new Set(['fav']),
    pastMatchesByUserId: { fav: { asTeammate: 5, winsAsTeammate: 4, asOpponent: 5, winsAgainst: 2 } },
  });
  const reason = matchReason(result.breakdown, fav);
  assert.ok(reason.includes('Favorit'), `expected "Favorit" in ${reason}`);
  assert.ok(reason.includes('Spillet sammen'), `expected past-matches mention in ${reason}`);
});

test('getMatchSuggestions ranks favorites and familiar partners above strangers', () => {
  const me = profile({ id: 'me' });
  const candidates = [
    profile({ id: 'stranger', elo_rating: 1010 }),
    profile({ id: 'fav', elo_rating: 1000 }),
    profile({ id: 'familiar', elo_rating: 1020 }),
  ];
  const result = getMatchSuggestions(me, candidates, {
    favoriteIds: new Set(['fav']),
    pastMatchesByUserId: {
      familiar: { asTeammate: 5, winsAsTeammate: 3, asOpponent: 4, winsAgainst: 2 },
    },
  });
  const ids = result.map((r) => r.profile.id);
  assert.ok(ids.indexOf('fav') < ids.indexOf('stranger'), `fav (${ids.indexOf('fav')}) should rank before stranger (${ids.indexOf('stranger')})`);
  assert.ok(ids.indexOf('familiar') < ids.indexOf('stranger'), 'familiar should rank before stranger');
});
