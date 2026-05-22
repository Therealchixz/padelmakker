import test from 'node:test';
import assert from 'node:assert/strict';
import {
  scheduleLooksLikePadel,
  pickPadelOmraedeFromOptions,
  parseSoegOmraedeOptions,
  resolveHalbookingOmraede,
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

test('resolveHalbookingOmraede keeps allowlist id when several Padel Lounge cities share URL', () => {
  const options = [
    { omraede: '2', label: 'Padel - Herning - Godsbanevej 5' },
    { omraede: '3', label: 'Padel - Aalborg - Poul Larsens vej 36' },
    { omraede: '4', label: 'Padel - Aarhus - Graham Bells Vej 23B' },
  ];
  assert.equal(resolveHalbookingOmraede('3', options).omraede, '3');
  assert.equal(resolveHalbookingOmraede('', options).omraede, '2');
});

test('resolveHalbookingOmraede keeps Match Padel omraede without "padel" in label', () => {
  const options = [
    { omraede: '5', label: 'AALBORG, Nibevej 58 9200 Aalborg' },
    { omraede: '1', label: 'AARHUS, Sindalsvej 2 8240 Risskov' },
    { omraede: '11', label: 'HOBRO, Jyllandsvej 7 9500 Hobro' },
  ];
  assert.equal(resolveHalbookingOmraede('5', options).omraede, '5');
  assert.equal(resolveHalbookingOmraede('1', options).omraede, '1');
});

test('scheduleLooksLikePadel accepts lowercase bane names (Bornholm)', () => {
  const courts = [{ name: 'Gudhjem bane 1' }, { name: 'Svaneke bane 2' }];
  assert.equal(scheduleLooksLikePadel(courts), true);
});

test('scheduleLooksLikePadel accepts Match Padel city baner without padel in name', () => {
  const courts = [{ name: 'Aalborg - Bane 1' }, { name: 'Aalborg - Single' }];
  assert.equal(scheduleLooksLikePadel(courts), true);
});

test('scheduleLooksLikePadel accepts Padel Lounge court names with Padel heading in HTML', () => {
  const courts = [{ name: 'Aalborg Double  1' }, { name: 'Aalborg Single 7' }];
  assert.equal(
    scheduleLooksLikePadel(courts, '<h1>Padel - Aalborg - Poul Larsens vej 36</h1>'),
    true
  );
});

test('scheduleLooksLikePadel accepts Match Padel singlebaner and sponsor-named padel baner', () => {
  assert.equal(scheduleLooksLikePadel([{ name: 'Ballerup Single 1' }]), true);
  assert.equal(scheduleLooksLikePadel([{ name: 'Kvickly Banen' }, { name: 'Hjemmefest Banen' }]), true);
});
