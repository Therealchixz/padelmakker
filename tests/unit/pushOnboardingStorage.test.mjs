import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PUSH_BLOCKED_STORAGE_KEY,
  PUSH_ONBOARDING_REPROMPT_MS,
  isPushPermanentlyBlocked,
  markPushOnboardingDismissed,
  markPushPermanentlyBlocked,
  pushOnboardingDismissedKey,
  shouldRepromptPushOnboarding,
  shouldShowPushOnboardingPrompt,
  shouldShowPushBellBanner,
} from '../../src/lib/pushOnboardingStorage.js';

const USER = 'user-abc-123';

test('shouldShowPushOnboardingPrompt when supported and not subscribed', () => {
  assert.equal(
    shouldShowPushOnboardingPrompt(USER, {
      isSubscribed: false,
      permission: 'default',
      pushSupported: true,
    }),
    true,
  );
  assert.equal(
    shouldShowPushOnboardingPrompt(USER, {
      isSubscribed: true,
      permission: 'default',
      pushSupported: true,
    }),
    false,
  );
  assert.equal(
    shouldShowPushOnboardingPrompt(USER, {
      isSubscribed: false,
      permission: 'denied',
      pushSupported: true,
    }),
    false,
  );
});

test('dismiss does not block bell banner but blocks modal until reprompt', () => {
  const storage = new Map();
  globalThis.localStorage = {
    getItem: (k) => (storage.has(k) ? storage.get(k) : null),
    setItem: (k, v) => storage.set(k, String(v)),
    removeItem: (k) => storage.delete(k),
  };

  markPushOnboardingDismissed(USER);
  assert.equal(storage.get(pushOnboardingDismissedKey(USER)) != null, true);
  assert.equal(
    shouldShowPushOnboardingPrompt(USER, {
      isSubscribed: false,
      permission: 'default',
      pushSupported: true,
    }),
    false,
  );
  assert.equal(
    shouldShowPushBellBanner({
      isSubscribed: false,
      permission: 'default',
      pushSupported: true,
    }),
    true,
  );

  const old = Date.now() - PUSH_ONBOARDING_REPROMPT_MS - 1000;
  storage.set(pushOnboardingDismissedKey(USER), String(old));
  assert.equal(shouldRepromptPushOnboarding(USER), true);
  assert.equal(
    shouldShowPushOnboardingPrompt(USER, {
      isSubscribed: false,
      permission: 'default',
      pushSupported: true,
    }),
    true,
  );
});

test('permanent block hides modal and bell banner', () => {
  const storage = new Map();
  globalThis.localStorage = {
    getItem: (k) => (storage.has(k) ? storage.get(k) : null),
    setItem: (k, v) => storage.set(k, String(v)),
    removeItem: (k) => storage.delete(k),
  };

  markPushPermanentlyBlocked();
  assert.equal(isPushPermanentlyBlocked(), true);
  assert.equal(storage.get(PUSH_BLOCKED_STORAGE_KEY), '1');
  assert.equal(
    shouldShowPushBellBanner({
      isSubscribed: false,
      permission: 'default',
      pushSupported: true,
    }),
    false,
  );
});
