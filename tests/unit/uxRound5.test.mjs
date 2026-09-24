import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const src = (rel) => readFile(new URL(`../../${rel}`, import.meta.url), 'utf8');

test('Beskeder: "Ny besked" erstatter søgefeltet i stedet for at lægge et ekstra under', async () => {
  const inbox = await src('src/components/chat/ChatInbox.jsx');
  assert.match(inbox, /\{composeOpen \? composeSlot : \(/);
  assert.doesNotMatch(inbox, /\{composeOpen \? composeSlot : null\}/);
  assert.match(inbox, /'Luk ny besked'/);
  const tab = await src('src/dashboard/BeskedTab.jsx');
  assert.match(tab, /if \(!composeOpen\) setInboxSearch\(''\)/);
});

test('makker- og kampfilter beskriver status i hverdagssprog', async () => {
  const { describeMakkerFilter } = await import('../../src/lib/makkerSearchFilterCore.js');
  const { describeMatchFilter } = await import('../../src/lib/matchSearchFilterCore.js');
  const profile = { area: 'Region Hovedstaden', elo_rating: 1000 };
  const base = { region: 'Region Hovedstaden', notify: false, feedVisible: false };
  for (const describe of [describeMakkerFilter, describeMatchFilter]) {
    const off = describe(base, profile);
    assert.doesNotMatch(off.detail, /kanal/);
    assert.match(off.detail, /^Slået fra/);
    assert.match(describe({ ...base, notify: true }, profile).detail, /^Du får besked om nye/);
  }
  const makker = describeMakkerFilter({ ...base, partnerCourtSide: 'any' }, profile);
  assert.doesNotMatch(makker.summary, /Ligegyldigt/);
});

test('makkerfilter: niveau vælges frit med skyder, valgfrie felter under "Flere valg"', async () => {
  const page = await src('src/dashboard/MakkerSearchFilterPage.jsx');
  assert.match(page, /<LevelRangeSlider/);
  assert.match(page, /levelMin: levelBounds\.min, levelMax: levelBounds\.max/);
  assert.doesNotMatch(page, /LEVEL_WINDOW_CHOICES/);
  assert.doesNotMatch(page, /MAKKER_PARTNER_LEVEL_FILTERS/);
  assert.match(page, /Flere valg \(valgfrit\)/);
});

test('rangliste: top 3 viser ELO én gang, og "Niveau" brydes ikke', async () => {
  const ranking = await src('src/dashboard/RankingTab.jsx');
  const pod = ranking.slice(ranking.indexOf('const renderPod'), ranking.indexOf('return (\n    <div>'));
  assert.equal((pod.match(/ELO/g) || []).length >= 1, true);
  assert.doesNotMatch(pod, /elo_rating\)\) \|\| 1000\)\} ELO/);
  assert.match(pod, /whiteSpace: 'nowrap'/);
  assert.match(ranking, /Number\(n\) === 1 \? 'kamp' : 'kampe'/);
});

test('makkerfilter: selvvalgt fra-til niveau styrer matchningen', async () => {
  const { customMakkerLevelBounds, makkerFilterLevelBounds } = await import('../../src/lib/makkerFilterMatch.js');
  const { profileMatchesMakkerFilter, normalizeMakkerSearchPrefs } = await import('../../src/lib/makkerSearchFilterCore.js');
  assert.equal(customMakkerLevelBounds({}), null);
  assert.equal(customMakkerLevelBounds({ levelMin: 3.3 }), null);
  assert.deepEqual(customMakkerLevelBounds({ levelMin: '3.7', levelMax: 3.3 }), { min: 3.3, max: 3.7 });
  // Uden selvvalgt spænd gælder den gamle beregning (±0,2 om eget niveau).
  assert.deepEqual(makkerFilterLevelBounds({ levelWindow: 0.2 }, 3.2, {}), { min: 3, max: 3.4 });
  assert.deepEqual(makkerFilterLevelBounds({ levelMin: 3.3, levelMax: 3.5 }, 3.2, {}), { min: 3.3, max: 3.5 });

  const normalized = normalizeMakkerSearchPrefs({ region: 'Region Hovedstaden', levelMin: 3.3, levelMax: 3.5 }, {});
  assert.equal(normalized.levelMin, 3.3);
  assert.equal(normalized.levelMax, 3.5);

  const watcher = { area: 'Region Hovedstaden', level: 3.2 };
  const at = (level) => ({ id: 'x', area: 'Region Hovedstaden', level });
  assert.equal(profileMatchesMakkerFilter(at(3.4), normalized, watcher), true);
  assert.equal(profileMatchesMakkerFilter(at(3.7), normalized, watcher), false);
  assert.equal(profileMatchesMakkerFilter(at(3.2), normalized, watcher), false);
});

test('SQL: makker_filter_level_bounds bruger levelMin/levelMax, når begge er sat', async () => {
  const sql = await src('supabase/sql/makker_filter_custom_level.sql');
  assert.match(sql, /p_prefs->>'levelMin'/);
  assert.match(sql, /p_prefs->>'levelMax'/);
  assert.match(sql, /WHEN c\.lo IS NOT NULL AND c\.hi IS NOT NULL/);
});

test('filtersider: region som én linje med liste fra bunden', async () => {
  for (const rel of ['src/dashboard/MatchSearchFilterPage.jsx', 'src/dashboard/MakkerSearchFilterPage.jsx']) {
    const page = await src(rel);
    assert.match(page, /<RegionPickerRow/, rel);
    assert.doesNotMatch(page, /REGIONS\.map/, rel);
  }
  const { APP_REGION_NEIGHBOURS, APP_REGIONS } = await import('../../src/lib/appRegions.js');
  // Samme naboer som public.app_region_neighbours i databasen.
  const sql = await src('supabase/migrations/20260922210546_app_region_neighbours_for_match_discovery.sql');
  for (const r of APP_REGIONS) {
    const m = new RegExp(`WHEN '${r}'\\s+THEN ARRAY\\[([^\\]]*)\\]`).exec(sql);
    assert.ok(m, r);
    const fraSql = m[1].split(',').map((x) => x.trim().replace(/'/g, '')).filter((x) => x && x !== r);
    assert.deepEqual(APP_REGION_NEIGHBOURS[r], fraSql, r);
  }
});
