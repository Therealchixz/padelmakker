import test from 'node:test';
import assert from 'node:assert/strict';
import {
  matchPlayerTeam,
  splitPlayersByTeam,
  teamMoveErrorMessage,
} from '../../src/lib/matchTeams.js';

const ids = ({ t1, t2 }) => ({ t1: t1.map((p) => p.id), t2: t2.map((p) => p.id) });

test('matchPlayerTeam laeser hold som tal', () => {
  assert.equal(matchPlayerTeam({ team: 1 }), 1);
  assert.equal(matchPlayerTeam({ team: '2' }), 2);
  assert.ok(Number.isNaN(matchPlayerTeam(undefined)));
});

test('team: null giver 0, ikke NaN - og det er harmloest', () => {
  // Number(null) === 0 er en klassisk faldgrube. Her er den ufarlig, fordi
  // splitPlayersByTeam kun spoerger "er det 1 eller 2?" - 0 falder i samme
  // kurv som NaN og behandles som "uden hold". Testen staar her, saa nogen
  // opdager det, hvis den antagelse en dag aendrer sig.
  assert.equal(matchPlayerTeam({ team: null }), 0);
  // b staar fast paa hold 1; a har intet hold og gaar til den tomme side.
  const ud = splitPlayersByTeam([{ id: 'a', team: null }, { id: 'b', team: 1 }]);
  assert.deepEqual(ids(ud), { t1: ['b'], t2: ['a'] });
});

test('spillere med hold bliver paa deres hold', () => {
  const ud = splitPlayersByTeam([
    { id: 'a', team: 1 },
    { id: 'b', team: 2 },
    { id: 'c', team: 1 },
  ]);
  assert.deepEqual(ids(ud), { t1: ['a', 'c'], t2: ['b'] });
});

test('spillere uden hold fylder den side der har plads', () => {
  const ud = splitPlayersByTeam([
    { id: 'a', team: 1 },
    { id: 'x' },
    { id: 'y' },
  ]);
  // a er paa hold 1, saa foerste ledige gaar til hold 2, naeste til hold 1.
  assert.deepEqual(ids(ud), { t1: ['a', 'y'], t2: ['x'] });
});

test('ved lige stand gaar den foerste til hold 1', () => {
  const ud = splitPlayersByTeam([{ id: 'x' }, { id: 'y' }]);
  assert.deepEqual(ids(ud), { t1: ['x'], t2: ['y'] });
});

test('flere end fire spillere fordeles stadig, ikke tabes', () => {
  const ud = splitPlayersByTeam([
    { id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }, { id: 'e' }, { id: 'f' },
  ]);
  assert.equal(ud.t1.length + ud.t2.length, 6, 'ingen spillere maa forsvinde');
});

test('tom eller manglende liste giver to tomme hold', () => {
  assert.deepEqual(ids(splitPlayersByTeam([])), { t1: [], t2: [] });
  assert.deepEqual(ids(splitPlayersByTeam(null)), { t1: [], t2: [] });
});

test('teamMoveErrorMessage oversaetter kendte koder', () => {
  assert.equal(teamMoveErrorMessage({ error: 'team_full', team: 2 }, 1), 'Hold 2 er fuldt.');
  assert.equal(teamMoveErrorMessage({ error: 'team_full' }, 1), 'Hold 1 er fuldt.');
  assert.match(teamMoveErrorMessage({ error: 'match_not_open' }), /før kampen er startet/);
  assert.match(teamMoveErrorMessage({ error: 'not_authorized' }), /ikke lov/);
  assert.match(teamMoveErrorMessage({ error: 'player_not_in_match' }), /ikke i kampen/);
  assert.match(teamMoveErrorMessage({ error: 'match_not_found' }), /blev ikke fundet/);
});

test('ukendt kode gives videre raat frem for at blive slugt', () => {
  assert.equal(teamMoveErrorMessage({ error: 'noget_nyt' }), 'noget_nyt');
  assert.equal(teamMoveErrorMessage({}), 'Ukendt fejl');
  assert.equal(teamMoveErrorMessage(null), 'Ukendt fejl');
});
