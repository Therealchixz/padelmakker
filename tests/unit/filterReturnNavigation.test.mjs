import test from 'node:test';
import assert from 'node:assert/strict';
import {
  filterReturnFromState,
  filterReturnBackLabel,
  FILTER_RETURN_MAKKERE,
  FILTER_RETURN_KAMPE,
  FILTER_RETURN_PROFIL,
} from '../../src/lib/filterReturnNavigation.js';

test('filterReturnFromState accepterer kendte faner', () => {
  assert.equal(filterReturnFromState({ filterReturnTo: FILTER_RETURN_MAKKERE }), FILTER_RETURN_MAKKERE);
  assert.equal(filterReturnFromState({ filterReturnTo: FILTER_RETURN_KAMPE }), FILTER_RETURN_KAMPE);
  assert.equal(filterReturnFromState({ filterReturnTo: FILTER_RETURN_PROFIL }), FILTER_RETURN_PROFIL);
  assert.equal(filterReturnFromState({ filterReturnTo: '/evil' }), FILTER_RETURN_PROFIL);
  assert.equal(filterReturnFromState(null), FILTER_RETURN_PROFIL);
});

test('filterReturnBackLabel', () => {
  assert.equal(filterReturnBackLabel(FILTER_RETURN_MAKKERE), 'Find makker');
  assert.equal(filterReturnBackLabel(FILTER_RETURN_KAMPE), 'Kampe');
  assert.equal(filterReturnBackLabel(FILTER_RETURN_PROFIL), 'profil');
});
