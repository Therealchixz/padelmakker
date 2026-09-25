/**
 * Slet/forlad en kamp fra kampens egen side.
 *
 * Ejeren slettede en kamp 25. sep. 2026 og fik bagefter "Kampen blev ikke
 * fundet", fordi siden blev stående på den nu slettede kamp. Nu går appen
 * tilbage til listen, ligesom når en kamp slettes via "Slet kamp".
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const src = readFileSync(join(root, 'src/dashboard/KampeTab.jsx'), 'utf8');

test('forlad/slet fra kampens side går tilbage til listen', () => {
  const start = src.indexOf('const leaveMatch = async');
  const end = src.indexOf('// ---- Join request functions', start);
  assert.ok(start > 0 && end > start, 'fandt ikke leaveMatch');
  const fn = src.slice(start, end);
  const close = fn.indexOf('if (String(detailMatchId) === String(matchId)) close2v2Detail();');
  assert.ok(close > 0, 'lukker ikke kampens side');
  assert.ok(close > fn.indexOf('await rpcLeaveMatch(matchId)'), 'lukker først efter afmelding');
  assert.ok(close < fn.indexOf('await loadData();'), 'lukker før listen genindlæses');
});
