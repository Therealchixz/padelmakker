import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  getProfileBadges,
  groupProfileBadgesByCategory,
  PROFILE_BADGE_DEFS,
} from '../../src/lib/profileBadges.js';

describe('profileBadges', () => {
  it('har badges for alle tre formater', () => {
    assert.ok(PROFILE_BADGE_DEFS['2v2'].length >= 10);
    assert.ok(PROFILE_BADGE_DEFS.americano.length >= 10);
    assert.ok(PROFILE_BADGE_DEFS.liga.length >= 8);
  });

  it('tildeler 2v2 debut og champion korrekt', () => {
    const badges = getProfileBadges('2v2', {
      games: 12,
      wins: 8,
      winPct: 67,
      elo: 1150,
      currentStreak: 2,
      bestStreak: 4,
    });
    const byKey = Object.fromEntries(badges.map((b) => [b.key, b.earned]));
    assert.equal(byKey.debut, true);
    assert.equal(byKey.team, true);
    assert.equal(byKey.champion, true);
    assert.equal(byKey.sprinter, false);
    assert.equal(byKey.elo_1300, false);
  });

  it('tildeler americano tour-badges', () => {
    const badges = getProfileBadges('americano', {
      americanoPlayed: 6,
      americanoRounds: 55,
      americanoWins: 25,
      americanoWinPct: 45,
      americanoElo: 1210,
    });
    const earned = badges.filter((b) => b.earned).map((b) => b.key);
    assert.ok(earned.includes('am_debut'));
    assert.ok(earned.includes('am_regular'));
    assert.ok(earned.includes('am_marathon'));
    assert.ok(earned.includes('am_elo_1200'));
    assert.equal(earned.includes('am_dominator'), false);
  });

  it('tildeler liga præstations-badges', () => {
    const badges = getProfileBadges('liga', {
      leagues: 2,
      ligaMatches: 16,
      ligaWins: 11,
      ligaWinPct: 69,
    });
    const earned = badges.filter((b) => b.earned).map((b) => b.key);
    assert.ok(earned.includes('lg_multi'));
    assert.ok(earned.includes('lg_clutch'));
    assert.equal(earned.includes('lg_dominant'), false);
  });

  it('grupperer badges efter kategori', () => {
    const badges = getProfileBadges('2v2', { games: 1, elo: 1000 });
    const groups = groupProfileBadgesByCategory(badges);
    assert.ok(groups.length >= 3);
    assert.equal(groups[0].category, 'milestone');
    assert.ok(groups.some((g) => g.category === 'rating'));
  });
});
