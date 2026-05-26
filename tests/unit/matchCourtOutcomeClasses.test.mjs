import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getMatchCourtHeaderLabel,
  getMatchCourtOutcomeClasses,
} from '../../src/lib/matchCourtOutcomeClasses.js';

const completed = { status: 'completed', winnerTeam: 1 };

test('participant on losing team gets prominent red on own side', () => {
  const mine = getMatchCourtOutcomeClasses(2, { ...completed, joined: true, myTeam: 2 });
  assert.match(mine.side, /mine-lost/);
  assert.match(mine.header, /mine-lost/);

  const opp = getMatchCourtOutcomeClasses(1, { ...completed, joined: true, myTeam: 2 });
  assert.match(opp.side, /opp-won/);
  assert.match(opp.header, /opp-won/);
});

test('participant on winning team gets green on own side', () => {
  const mine = getMatchCourtOutcomeClasses(1, { ...completed, joined: true, myTeam: 1 });
  assert.match(mine.side, /mine-won/);

  const opp = getMatchCourtOutcomeClasses(2, { ...completed, joined: true, myTeam: 1 });
  assert.match(opp.side, /opp-lost/);
});

test('spectator gets neutral outcome classes', () => {
  const winner = getMatchCourtOutcomeClasses(1, { ...completed, joined: false, myTeam: null });
  assert.match(winner.side, /winner-neutral/);

  const loser = getMatchCourtOutcomeClasses(2, { ...completed, joined: false, myTeam: null });
  assert.match(loser.side, /loser-neutral/);
});

test('open match has no outcome classes', () => {
  assert.deepEqual(
    getMatchCourtOutcomeClasses(1, { status: 'open', winnerTeam: null }),
    { side: '', header: '' },
  );
});

test('header label adds trophy for winning side', () => {
  assert.equal(getMatchCourtHeaderLabel(1, { winnerTeam: 1 }), '🏆 Hold 1');
  assert.equal(getMatchCourtHeaderLabel(2, { winnerTeam: 1 }), 'Hold 2');
});
