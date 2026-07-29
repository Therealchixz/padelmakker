import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  filterReturnFromState,
  filterReturnBackLabel,
  FILTER_RETURN_HJEM,
  FILTER_RETURN_MAKKERE,
  FILTER_RETURN_KAMPE,
  FILTER_RETURN_PROFIL,
} from '../../src/lib/filterReturnNavigation.js';

test('filterReturnFromState accepterer kendte faner', () => {
  assert.equal(filterReturnFromState({ filterReturnTo: FILTER_RETURN_MAKKERE }), FILTER_RETURN_MAKKERE);
  assert.equal(filterReturnFromState({ filterReturnTo: FILTER_RETURN_KAMPE }), FILTER_RETURN_KAMPE);
  assert.equal(filterReturnFromState({ filterReturnTo: FILTER_RETURN_PROFIL }), FILTER_RETURN_PROFIL);
  assert.equal(filterReturnFromState({ filterReturnTo: FILTER_RETURN_HJEM }), FILTER_RETURN_HJEM);
  assert.equal(filterReturnFromState({ filterReturnTo: '/evil' }), FILTER_RETURN_PROFIL);
  assert.equal(filterReturnFromState(null), FILTER_RETURN_PROFIL);
});

test('filterReturnBackLabel', () => {
  assert.equal(filterReturnBackLabel(FILTER_RETURN_MAKKERE), 'Find makker');
  assert.equal(filterReturnBackLabel(FILTER_RETURN_KAMPE), 'Kampe');
  assert.equal(filterReturnBackLabel(FILTER_RETURN_PROFIL), 'Profil');
  assert.equal(filterReturnBackLabel(FILTER_RETURN_HJEM), 'Hjem');
});

test('adminSub deep link values', () => {
  const dash = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../../src/dashboard/DashboardPage.jsx'), 'utf8');
  assert.match(dash, /raw === "result_errors" \|\| raw === "reports"/);
  assert.match(dash, /setAdminInitialSubTab\(raw\)/);
});

test('MakkereTab sender filterReturnTo til makker-filter', () => {
  const makkere = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), '../../src/dashboard/MakkereTab.jsx'),
    'utf8',
  );
  assert.match(makkere, /navigate\('\/dashboard\/makker-filter',\s*\{\s*state:\s*\{\s*filterReturnTo:\s*FILTER_RETURN_MAKKERE/);
  assert.doesNotMatch(makkere, /navigate\('\/dashboard\/makker-filter'\)/);
});

test('AmericanoResultsPanel undgår DB-migration i bruger-toast', () => {
  const panel = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), '../../src/features/americano/AmericanoResultsPanel.tsx'),
    'utf8',
  );
  assert.doesNotMatch(panel, /DB-migration/);
  assert.match(panel, /Prøv igen senere/);
});
