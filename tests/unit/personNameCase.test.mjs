import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { toPersonNameCase } from '../../src/lib/personNameCase.js';

test('toPersonNameCase sætter stort begyndelsesbogstav på fornavn og efternavn', () => {
  assert.equal(toPersonNameCase('KENNETH SOERENSEN'), 'Kenneth Soerensen');
  assert.equal(toPersonNameCase('kenneth soerensen'), 'Kenneth Soerensen');
  assert.equal(toPersonNameCase('  mike   pedersen '), 'Mike Pedersen');
  assert.equal(toPersonNameCase('anne-marie jensen'), 'Anne-Marie Jensen');
  assert.equal(toPersonNameCase("o'connor"), "O'Connor");
  assert.equal(toPersonNameCase('ægir søndergaard'), 'Ægir Søndergaard');
  assert.equal(toPersonNameCase(''), '');
});

test('normalizeProfileRow viser navn med korrekt casing', () => {
  const src = readFileSync('src/lib/profileUtils.js', 'utf8');
  assert.match(src, /toPersonNameCase\(p\.full_name \|\| p\.name/);
});

test('onboarding og signup gemmer navn via toPersonNameCase', () => {
  const onboarding = readFileSync('src/pages/OnboardingPage.jsx', 'utf8');
  assert.match(onboarding, /toPersonNameCase/);
  const auth = readFileSync('src/lib/AuthContext.jsx', 'utf8');
  assert.match(auth, /toPersonNameCase/);
  const bootstrap = readFileSync('src/lib/profileBootstrap.js', 'utf8');
  assert.match(bootstrap, /toPersonNameCase/);
});
