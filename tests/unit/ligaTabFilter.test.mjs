import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');

test('Liga status-tab tæller respekterer region/søgning (samme base som listen)', () => {
  const src = readFileSync(join(root, 'src/dashboard/LigaTab.jsx'), 'utf8');
  assert.match(src, /leaguesMatchingListFilters/);
  assert.match(src, /leagueStatusCount = useMemo\(\(\) => \(\{/);
  assert.match(src, /leaguesMatchingListFilters\.filter\(\(l\) => l\.status === 'completed'\)/);
  assert.doesNotMatch(src, /completed: leagues\.filter\(l => l\.status === 'completed'\)/);
});
