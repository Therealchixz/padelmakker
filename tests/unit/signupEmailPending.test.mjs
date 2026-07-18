import test from 'node:test';
import assert from 'node:assert/strict';

function installMemorySessionStorage() {
  const store = new Map();
  globalThis.sessionStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => { store.set(String(k), String(v)); },
    removeItem: (k) => { store.delete(k); },
    clear: () => { store.clear(); },
  };
}

installMemorySessionStorage();

const {
  clearPendingSignupEmail,
  readPendingSignupEmail,
  writePendingSignupEmail,
} = await import('../../src/lib/signupEmailPending.js');

test('signup email pending roundtrip in sessionStorage', () => {
  clearPendingSignupEmail();
  assert.equal(readPendingSignupEmail(), null);

  writePendingSignupEmail({ email: 'Test@Padel.dk', phone: '+4511223344' });
  assert.deepEqual(readPendingSignupEmail(), {
    email: 'test@padel.dk',
    phone: '+4511223344',
  });

  clearPendingSignupEmail();
  assert.equal(readPendingSignupEmail(), null);
});

test('signup email pending ignores invalid email', () => {
  clearPendingSignupEmail();
  writePendingSignupEmail({ email: 'not-an-email' });
  assert.equal(readPendingSignupEmail(), null);
});
