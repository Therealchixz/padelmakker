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

test('makkerfilter: ét niveauvalg og valgfrie felter under "Flere valg"', async () => {
  const page = await src('src/dashboard/MakkerSearchFilterPage.jsx');
  assert.match(page, /MAKKER_LEVEL_CHOICES/);
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
