import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  sha1Hex,
  countBreachesInRangeBody,
  checkPasswordBreached,
  BREACHED_PASSWORD_MESSAGE,
} from '../../src/lib/passwordBreachCheck.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');

test('sha1Hex giver den kendte sum for "password" i store bogstaver', async () => {
  // Velkendt SHA-1 for "password".
  assert.equal(await sha1Hex('password'), '5BAA61E4C9B93F3F0682250B6CF8331B7EE68FD8');
});

test('countBreachesInRangeBody finder antallet for det rigtige suffiks', () => {
  const body = [
    '003D68EB55068C33ACE09247EE4C639306B:3',
    '1E4C9B93F3F0682250B6CF8331B7EE68FD8:9659365',
    '012C4B1C1B9E9E1B9D9E1B9D9E1B9D9E1B9:1',
  ].join('\r\n');
  assert.equal(countBreachesInRangeBody(body, '1E4C9B93F3F0682250B6CF8331B7EE68FD8'), 9659365);
  assert.equal(countBreachesInRangeBody(body, '003D68EB55068C33ACE09247EE4C639306B'), 3);
});

test('countBreachesInRangeBody giver 0 for ukendt suffiks og for skrammel', () => {
  const body = '003D68EB55068C33ACE09247EE4C639306B:3';
  assert.equal(countBreachesInRangeBody(body, 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'), 0);
  assert.equal(countBreachesInRangeBody('', 'ABC'), 0);
  assert.equal(countBreachesInRangeBody(body, ''), 0);
  assert.equal(countBreachesInRangeBody('uden kolon', 'ABC'), 0);
});

test('countBreachesInRangeBody er ufølsom for store/små bogstaver', () => {
  const body = 'ABCDEF0123456789ABCDEF0123456789ABC:7';
  assert.equal(countBreachesInRangeBody(body, 'abcdef0123456789abcdef0123456789abc'), 7);
});

test('checkPasswordBreached sender kun de første fem tegn af summen', async () => {
  let kaldtUrl = '';
  await checkPasswordBreached('password', {
    fetchImpl: async (url) => {
      kaldtUrl = url;
      return { ok: true, text: async () => '' };
    },
  });
  // SHA-1("password") starter med 5BAA6 — resten må aldrig sendes.
  assert.equal(kaldtUrl, 'https://api.pwnedpasswords.com/range/5BAA6');

  // Alt efter /range/ er præcis fem tegn: hverken resten af summen eller
  // kodeordet selv forlader enheden. (Domænet hedder "pwnedpasswords", så
  // en simpel includes('password') ville ramme værtsnavnet, ikke stien.)
  const sti = new URL(kaldtUrl).pathname;
  const sendtPraefiks = sti.replace('/range/', '');
  assert.equal(sendtPraefiks.length, 5);
  assert.equal(sendtPraefiks, '5BAA6');
  assert.ok(!sti.includes('1E4C9B93F3F0682250B6CF8331B7EE68FD8'));
  assert.ok(!sti.toLowerCase().includes('password'));
});

test('checkPasswordBreached melder læk når suffikset er i svaret', async () => {
  const res = await checkPasswordBreached('password', {
    fetchImpl: async () => ({
      ok: true,
      text: async () => '1E4C9B93F3F0682250B6CF8331B7EE68FD8:9659365',
    }),
  });
  assert.equal(res.breached, true);
  assert.equal(res.checked, true);
  assert.equal(res.count, 9659365);
});

test('checkPasswordBreached melder fri bane når suffikset mangler', async () => {
  const res = await checkPasswordBreached('password', {
    fetchImpl: async () => ({ ok: true, text: async () => 'FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF:2' }),
  });
  assert.equal(res.breached, false);
  assert.equal(res.checked, true);
});

test('checkPasswordBreached fejler åbent ved netværksfejl', async () => {
  const res = await checkPasswordBreached('password', {
    fetchImpl: async () => { throw new Error('offline'); },
  });
  assert.deepEqual(res, { breached: false, count: 0, checked: false });
});

test('checkPasswordBreached fejler åbent ved HTTP-fejl', async () => {
  const res = await checkPasswordBreached('password', {
    fetchImpl: async () => ({ ok: false, status: 503, text: async () => '' }),
  });
  assert.equal(res.breached, false);
  assert.equal(res.checked, false);
});

test('checkPasswordBreached rører ikke netværket for tom adgangskode', async () => {
  let kaldt = false;
  const res = await checkPasswordBreached('', { fetchImpl: async () => { kaldt = true; return { ok: true, text: async () => '' }; } });
  assert.equal(kaldt, false);
  assert.equal(res.checked, false);
});

test('tjekket er koblet på både oprettelse og nulstilling, og CSP tillader tjenesten', () => {
  const onboarding = readFileSync(join(root, 'src/pages/OnboardingPage.jsx'), 'utf8');
  const reset = readFileSync(join(root, 'src/pages/ResetPasswordPage.jsx'), 'utf8');
  const vercel = readFileSync(join(root, 'vercel.json'), 'utf8');

  for (const [navn, kilde] of [['OnboardingPage', onboarding], ['ResetPasswordPage', reset]]) {
    assert.ok(kilde.includes('checkPasswordBreached'), `${navn} kalder ikke checkPasswordBreached`);
    assert.ok(kilde.includes('BREACHED_PASSWORD_MESSAGE'), `${navn} bruger ikke fællesbeskeden`);
  }

  // Uden dette i connect-src blokerer browseren kaldet i produktion.
  assert.ok(
    vercel.includes('https://api.pwnedpasswords.com'),
    'CSP i vercel.json mangler api.pwnedpasswords.com i connect-src',
  );
  assert.ok(BREACHED_PASSWORD_MESSAGE.length > 20);
});
