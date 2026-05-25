import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildRatingFlagStatusUpdate,
  computeAdminConsoleStats,
  filterRatingAdminFlags,
} from '../../src/lib/adminConsoleUtils.js';

const NOW = Date.parse('2026-05-22T12:00:00.000Z');

test('filterRatingAdminFlags respects status, source, severity and search', () => {
  const flags = [
    {
      id: '1',
      status: 'open',
      source: '2v2',
      severity: 'high',
      reason: 'non_zero_sum_match_delta',
      match_id: 'm-abc',
      payload: { sum_change: 3 },
    },
    {
      id: '2',
      status: 'closed',
      source: 'americano',
      severity: 'low',
      reason: 'demo_flag',
      tournament_id: 't-xyz',
      payload: {},
    },
  ];

  assert.equal(
    filterRatingAdminFlags(flags, { flagStatusFilter: 'open' }).length,
    1,
  );
  assert.equal(
    filterRatingAdminFlags(flags, { flagSourceFilter: 'americano' })[0]?.id,
    '2',
  );
  assert.equal(
    filterRatingAdminFlags(flags, { flagSeverityFilter: 'high' })[0]?.id,
    '1',
  );
  assert.equal(
    filterRatingAdminFlags(flags, { flagSearch: 'm-abc' })[0]?.id,
    '1',
  );
  assert.equal(
    filterRatingAdminFlags(flags, { flagSearch: 'sum_change' })[0]?.id,
    '1',
  );
  assert.equal(filterRatingAdminFlags(flags, { flagSearch: 'ingen' }).length, 0);
});

test('computeAdminConsoleStats aggregates players, matches, americano and flags', () => {
  const oneHourAgo = new Date(NOW - 60 * 60 * 1000).toISOString();
  const twoDaysAgo = new Date(NOW - 48 * 60 * 60 * 1000).toISOString();

  const stats = computeAdminConsoleStats({
    nowMs: NOW,
    profiles: [{ is_banned: false }, { is_banned: true }],
    matchesRows: [
      { status: 'open' },
      { status: 'in_progress' },
      { status: 'completed', completed_at: oneHourAgo },
      { status: 'completed', completed_at: twoDaysAgo },
    ],
    pendingResults: [{ id: 1 }, { id: 2 }],
    americanoRows: [
      { status: 'open' },
      { status: 'playing', updated_at: oneHourAgo },
      { status: 'active' },
      { status: 'completed', updated_at: oneHourAgo },
      { status: 'completed', updated_at: twoDaysAgo },
    ],
    flags: [
      { status: 'open', severity: 'high' },
      { status: 'open', severity: 'low' },
      { status: 'closed', severity: 'high' },
    ],
  });

  assert.equal(stats.totalPlayers, 2);
  assert.equal(stats.bannedPlayers, 1);
  assert.equal(stats.pendingResults, 2);
  assert.equal(stats.openMatches, 1);
  assert.equal(stats.inProgressMatches, 1);
  assert.equal(stats.completedMatches24h, 1);
  assert.equal(stats.americanoOpen, 1);
  assert.equal(stats.americanoActive, 2);
  assert.equal(stats.americanoCompleted7d, 2);
  assert.equal(stats.openFlags, 2);
  assert.equal(stats.highFlags, 1);
});

test('buildRatingFlagStatusUpdate clears review meta when reopening', () => {
  const reviewed = buildRatingFlagStatusUpdate('reviewed', {
    userId: 'admin-1',
    note: '  ok  ',
  });
  assert.equal(reviewed.status, 'reviewed');
  assert.equal(reviewed.reviewed_by, 'admin-1');
  assert.match(reviewed.reviewed_at, /^\d{4}-/);
  assert.equal(reviewed.review_note, 'ok');

  const reopened = buildRatingFlagStatusUpdate('open');
  assert.equal(reopened.status, 'open');
  assert.equal(reopened.reviewed_by, null);
  assert.equal(reopened.reviewed_at, null);
  assert.equal(reopened.review_note, undefined);
});
