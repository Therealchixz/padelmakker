/**
 * "Alle tider": spillere uden kampe må ikke stå over dem, der har spillet.
 *
 * Alle starter på 1000 ELO. Sorteret på ELO alene stod ejeren som nr. 98,
 * under ca. 90 spillere, der aldrig havde spillet, fordi han havde tabt en kamp.
 * Nu hentes de spillede først (nummereret), derefter resten uden nummer.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fetchRankingPage, RANKING_START_CURSOR } from '../../src/lib/rankingPages.js';

function fakeSource(ranked, unranked) {
  const calls = [];
  return {
    calls,
    fetchRanked: async (offset, limit) => {
      calls.push(['ranked', offset, limit]);
      return ranked.slice(offset, offset + limit);
    },
    fetchUnranked: async (offset, limit) => {
      calls.push(['unranked', offset, limit]);
      return unranked.slice(offset, offset + limit);
    },
  };
}

const people = (prefix, n) => Array.from({ length: n }, (_, i) => ({ id: `${prefix}${i + 1}` }));

test('spillede kommer først med nummer, resten bagefter uden nummer', async () => {
  const src = fakeSource(people('r', 5), people('u', 93));
  const page = await fetchRankingPage({ cursor: RANKING_START_CURSOR, pageSize: 50, ...src });
  assert.equal(page.rows.length, 50);
  assert.deepEqual(page.rows.slice(0, 5).map((r) => r._globalRank), [1, 2, 3, 4, 5]);
  assert.ok(page.rows.slice(0, 5).every((r) => r._unranked === false));
  assert.ok(page.rows.slice(5).every((r) => r._unranked === true && r._globalRank === null));
  assert.equal(page.rankedComplete, true, 'alle 5 spillede er hentet, så "af 5" er endeligt');
  assert.equal(page.cursor.ranked, 5);
  assert.equal(page.hasMore, true);
});

test('"Indlæs flere" fortsætter blandt dem uden kampe uden dubletter', async () => {
  const src = fakeSource(people('r', 5), people('u', 93));
  const p1 = await fetchRankingPage({ cursor: RANKING_START_CURSOR, pageSize: 50, ...src });
  const p2 = await fetchRankingPage({ cursor: p1.cursor, pageSize: 50, ...src });
  const ids = [...p1.rows, ...p2.rows].map((r) => r.id);
  assert.equal(ids.length, 98);
  assert.equal(new Set(ids).size, 98);
  assert.equal(p2.hasMore, false);
});

test('mange spillede: nummereringen fortsætter over sider', async () => {
  const src = fakeSource(people('r', 70), people('u', 10));
  const p1 = await fetchRankingPage({ cursor: RANKING_START_CURSOR, pageSize: 50, ...src });
  assert.equal(p1.rankedComplete, false, 'der kan være flere spillede, så "af 50+"');
  assert.ok(p1.rows.every((r) => !r._unranked));
  const p2 = await fetchRankingPage({ cursor: p1.cursor, pageSize: 50, ...src });
  assert.deepEqual(p2.rows.slice(0, 20).map((r) => r._globalRank), Array.from({ length: 20 }, (_, i) => 51 + i));
  assert.ok(p2.rows.slice(20).every((r) => r._unranked));
  assert.equal(p2.rows.length, 30);
  assert.equal(p2.hasMore, false);
});

test('RankingTab: egen placering tæller kun spillede, og listen viser overskriften', async () => {
  const tab = await readFile(new URL('../../src/dashboard/RankingTab.jsx', import.meta.url), 'utf8');
  assert.match(tab, /\.gt\(gamesColumn, 0\)\s*\n\s*\.gt\(orderColumn, myScore\)/);
  assert.match(tab, /Har ikke spillet endnu/);
  assert.match(tab, /areaRankedCount >= 3/);
});
