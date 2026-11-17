import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');

test('Tilmeld dit hold: makker skal sige ja, og knappen nævner makkeren', () => {
  const src = read('src/dashboard/LigaTilmeldScreen.jsx');
  assert.match(src, /får en besked og skal sige ja, før holdet er tilmeldt/);
  assert.match(src, /Send til \$\{partnerFirst\} og tilmeld/);
  assert.match(src, /role="radio"/);
  assert.match(read('src/dashboard/LigaTab.jsx'), /<LigaTilmeldScreen/);
});

test('Liga-oversigt viser kun rigtige tal (intet niveau-spænd, ingen ELO-løfte)', () => {
  const src = read('src/dashboard/LigaOverview.jsx');
  assert.doesNotMatch(src, /Passer til dit niveau/);
  assert.doesNotMatch(src, /ELO/);
  assert.match(src, /hold tilmeldt/);
});
