import test from 'node:test';
import assert from 'node:assert/strict';

import { completedMatchActions } from '../../src/lib/completedMatchActions.js';

test('ingen handlinger på en kamp der ikke er afsluttet', () => {
  for (const status of ['open', 'full', 'in_progress', undefined]) {
    const a = completedMatchActions({ status, resultConfirmed: true, joined: true, isCreator: true });
    assert.equal(a.canRematch, false, `status=${status}`);
    assert.equal(a.canReportResultError, false, `status=${status}`);
    assert.equal(a.hasAny, false, `status=${status}`);
  }
});

test('"Spil igen" kun for dem der var med', () => {
  const base = { status: 'completed', resultConfirmed: false };
  assert.equal(completedMatchActions({ ...base, joined: true }).canRematch, true);
  assert.equal(completedMatchActions({ ...base, isCreator: true }).canRematch, true);
  // Udenforstående — fx en admin der kigger på en fremmed kamp.
  assert.equal(completedMatchActions({ ...base, joined: false, isCreator: false }).canRematch, false);
});

test('fejlindberetning kræver et bekræftet resultat', () => {
  const base = { status: 'completed', joined: true };
  assert.equal(completedMatchActions({ ...base, resultConfirmed: true }).canReportResultError, true);
  // Ubekræftet: indsigelsen hører hjemme i godkend/afvis-flowet.
  assert.equal(completedMatchActions({ ...base, resultConfirmed: false }).canReportResultError, false);
});

test('fejlindberetning er uafhængig af om man selv var med', () => {
  const a = completedMatchActions({ status: 'completed', resultConfirmed: true, joined: false, isCreator: false });
  assert.equal(a.canReportResultError, true);
  assert.equal(a.canRematch, false);
  assert.equal(a.hasAny, true);
});

test('hasAny er sand hvis mindst én handling vises', () => {
  assert.equal(completedMatchActions({ status: 'completed', joined: true }).hasAny, true);
  assert.equal(completedMatchActions({ status: 'completed', resultConfirmed: true }).hasAny, true);
  assert.equal(completedMatchActions({ status: 'completed' }).hasAny, false);
});

test('tåler at blive kaldt uden argumenter', () => {
  const a = completedMatchActions();
  assert.deepEqual(a, { canRematch: false, canReportResultError: false, hasAny: false });
});
