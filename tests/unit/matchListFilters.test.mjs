import test from 'node:test';
import assert from 'node:assert/strict';

import { buildKampeMatchLists } from '../../src/lib/matchListFilters.js';

const matches = [
  { id: 'old-open', status: 'open', creator_id: 'other', created_at: '2026-01-01T10:00:00Z', court_name: 'Skansen Padel', description: 'Morgenkamp', level_range: '800-1200' },
  { id: 'joined-open', status: 'open', creator_id: 'other', created_at: '2026-01-01T09:00:00Z', court_name: 'Racket Club', description: 'Svedig kamp', level_range: '1000-1400' },
  { id: 'new-open', status: 'full', creator_id: 'me', created_at: '2026-01-02T10:00:00Z', court_name: 'Skansen Padel', description: 'Aftenkamp', level_range: '900-1300' },
  { id: 'empty-open', status: 'open', creator_id: 'me', created_at: '2026-01-03T10:00:00Z', court_name: 'Tom bane', description: '', level_range: '' },
  { id: 'active-mine', status: 'in_progress', creator_id: 'other', created_at: '2026-01-04T10:00:00Z', court_name: 'Skansen Padel', description: '', level_range: '' },
  { id: 'active-other', status: 'in_progress', creator_id: 'other', created_at: '2026-01-05T10:00:00Z', court_name: 'Skansen Padel', description: '', level_range: '' },
  { id: 'completed-old', status: 'completed', creator_id: 'other', created_at: '2026-01-06T10:00:00Z', court_name: 'Skansen Padel', description: '', level_range: '' },
  { id: 'completed-new', status: 'completed', creator_id: 'other', created_at: '2026-01-07T10:00:00Z', court_name: 'Skansen Padel', description: '', level_range: '' },
];

const matchPlayers = {
  'old-open': [{ user_id: 'p1', user_name: 'Karl' }],
  'joined-open': [{ user_id: 'me', user_name: 'Mig' }],
  'new-open': [{ user_id: 'me', user_name: 'Mig' }, { user_id: 'p2', user_name: 'Nina' }],
  'empty-open': [],
  'active-mine': [{ user_id: 'me', user_name: 'Mig' }],
  'active-other': [{ user_id: 'other', user_name: 'Ole' }],
  'completed-old': [{ user_id: 'me', user_name: 'Mig' }],
  'completed-new': [{ user_id: 'me', user_name: 'Mig' }],
};

test('buildKampeMatchLists keeps open matches with players and sorts joined matches first', () => {
  const lists = buildKampeMatchLists({
    matches,
    matchPlayers,
    joinedMatchIds: new Set(['joined-open', 'active-mine', 'completed-old', 'completed-new']),
    currentUserId: 'me',
    completedSortMs: (match) => match.id === 'completed-new' ? 200 : 100,
  });

  assert.deepEqual(lists.openMatches.map((match) => match.id), ['joined-open', 'new-open', 'old-open']);
  assert.deepEqual(lists.activeMatches.map((match) => match.id), ['active-mine', 'active-other']);
  assert.deepEqual(lists.completedMatches.map((match) => match.id), ['completed-new', 'completed-old']);
});

test('buildKampeMatchLists applies mine scope like the dashboard does today', () => {
  const lists = buildKampeMatchLists({
    matches,
    matchPlayers,
    joinedMatchIds: new Set(['joined-open', 'active-mine', 'completed-old', 'completed-new']),
    isMine: true,
    currentUserId: 'me',
    completedSortMs: (match) => match.id === 'completed-new' ? 200 : 100,
  });

  assert.deepEqual(lists.openMatches.map((match) => match.id), ['new-open']);
  assert.deepEqual(lists.activeMatches.map((match) => match.id), ['active-mine']);
  assert.deepEqual(lists.completedMatches.map((match) => match.id), ['completed-new', 'completed-old']);
});

test('buildKampeMatchLists searches players, court name, description and level range', () => {
  const byPlayer = buildKampeMatchLists({
    matches,
    matchPlayers,
    joinedMatchIds: new Set(),
    currentUserId: 'me',
    searchQuery: 'nina',
  });
  const byCourt = buildKampeMatchLists({
    matches,
    matchPlayers,
    joinedMatchIds: new Set(),
    currentUserId: 'me',
    searchQuery: 'racket',
  });
  const byLevel = buildKampeMatchLists({
    matches,
    matchPlayers,
    joinedMatchIds: new Set(),
    currentUserId: 'me',
    searchQuery: '800-1200',
  });

  assert.deepEqual(byPlayer.openMatches.map((match) => match.id), ['new-open']);
  assert.deepEqual(byCourt.openMatches.map((match) => match.id), ['joined-open']);
  assert.deepEqual(byLevel.openMatches.map((match) => match.id), ['old-open']);
});
