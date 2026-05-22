import test from 'node:test';
import assert from 'node:assert/strict';
import {
  scheduleLooksLikePadel,
  pickPadelOmraedeFromOptions,
  parseSoegOmraedeOptions,
} from '../../padelmakker-server/halbookingFetch.js';

test('scheduleLooksLikePadel rejects HTPK tennis baner', () => {
  const courts = [{ name: 'Bane T1' }, { name: 'ZBM Patents - Bane T2' }];
  assert.equal(scheduleLooksLikePadel(courts), false);
});

test('scheduleLooksLikePadel accepts padel baner', () => {
  const courts = [{ name: 'Spar Nord - Bane P1' }, { name: 'Bane P2' }];
  assert.equal(scheduleLooksLikePadel(courts, '<h1># Padel</h1>'), true);
});

test('pickPadelOmraedeFromOptions prefers Padel label', () => {
  const options = [
    { omraede: '1', label: 'Udendørs Tennis' },
    { omraede: '5', label: 'Padel' },
  ];
  assert.equal(pickPadelOmraedeFromOptions(options), '5');
});

test('parseSoegOmraedeOptions reads select', () => {
  const html = `<select name="soeg_omraede"><option value='3'>Padel</option></select>`;
  assert.deepEqual(parseSoegOmraedeOptions(html), [{ omraede: '3', label: 'Padel' }]);
});
