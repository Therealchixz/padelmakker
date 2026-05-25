import assert from 'node:assert/strict';
import test from 'node:test';
import {
  MATCH_VENUE_TBD,
  courtNameFromVenueSelection,
  isMatchVenueTbd,
} from '../../src/lib/matchVenueOptions.js';

test('MATCH_VENUE_TBD yields empty court name for unbooked matches', () => {
  assert.equal(isMatchVenueTbd(MATCH_VENUE_TBD), true);
  assert.equal(courtNameFromVenueSelection(MATCH_VENUE_TBD, []), '');
});
