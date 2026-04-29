import test from 'node:test';
import assert from 'node:assert/strict';

import { formatEloSuccessToast } from '../../src/lib/eloToastMessages.js';

test('formatEloSuccessToast keeps ELO success messages user-facing without margin internals', () => {
  const message = formatEloSuccessToast({
    players_updated: 4,
    team1_player_changes: [12, 11],
    team2_player_changes: [-12, -11],
    games_margin: 7,
    margin_multiplier: 1.12,
  });

  assert.equal(message, 'Resultatet er bekræftet. ELO er opdateret for 4 spillere.');
  assert.doesNotMatch(message, /margin|partier|×|Hold 1|Hold 2/i);
});
