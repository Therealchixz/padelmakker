import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');

test('Liga-oversigten bygger på samme filtrerede liste som søgning/region', () => {
  const src = readFileSync(join(root, 'src/dashboard/LigaTab.jsx'), 'utf8');
  assert.match(src, /const overviewData = useMemo/);
  assert.match(src, /for \(const league of leaguesMatchingListFilters\)/);
  assert.match(src, /<LigaOverview/);
  // Ingen faner (Tilmelding · Aktiv · Afsluttede) længere – alt på én side (ejeren 17. nov. 2026).
  assert.doesNotMatch(src, /leagueStatusTabs/);
});
