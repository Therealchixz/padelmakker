import test from 'node:test';
import assert from 'node:assert/strict';
import {
  scheduleLooksLikePadel,
  pickPadelOmraedeFromOptions,
  parseSoegOmraedeOptions,
  resolveHalbookingOmraede,
  collectInputFields,
  ymdToHalbookingBanedato,
} from '../../padelmakker-server/halbookingFetch.js';
import { halbookingOpenUrl, halbookingOpenVenueUrl } from '../../src/lib/banerVenues.js';

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

test('collectInputFields accepts single- and double-quoted value attributes', () => {
  const form = `
    <input type="hidden" name="banedato" value='19-07-2026'/>
    <input type="hidden" name='mf_funktion' value="omr_soeg"/>
  `;
  const params = collectInputFields(form);
  assert.equal(params.get('banedato'), '19-07-2026');
  assert.equal(params.get('mf_funktion'), 'omr_soeg');
});

test('ymdToHalbookingBanedato converts without timezone shift', () => {
  assert.equal(ymdToHalbookingBanedato('2026-07-19'), '19-07-2026');
  assert.equal(ymdToHalbookingBanedato('bad'), null);
});

test('halbookingOpenUrl includes selected date for Halbooking deep-link', () => {
  const url = halbookingOpenUrl('skansen_ntsc', 'Bane 1', '18:00', '2026-07-19');
  assert.match(url, /venue=skansen_ntsc/);
  assert.match(url, /pm_tid=18%3A00|pm_tid=18:00/);
  assert.match(url, /date=2026-07-19/);
  assert.equal(halbookingOpenVenueUrl('skansen_ntsc', '2026-07-19').includes('date=2026-07-19'), true);
});
