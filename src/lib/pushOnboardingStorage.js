/** Permanent blokering (browser denied / push blokeret) — ikke “Ikke nu”. */
export const PUSH_BLOCKED_STORAGE_KEY = 'pm_push_blocked';

/** Vis push-onboarding-modal igen efter dismiss. */
export const PUSH_ONBOARDING_REPROMPT_MS = 7 * 24 * 60 * 60 * 1000;

export function pushOnboardingDismissedKey(userId) {
  return `pm_push_onboarding_dismissed_${userId}`;
}

export function isPushPermanentlyBlocked() {
  try {
    return localStorage.getItem(PUSH_BLOCKED_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function markPushPermanentlyBlocked() {
  try {
    localStorage.setItem(PUSH_BLOCKED_STORAGE_KEY, '1');
  } catch {
    /* ignore */
  }
}

export function getPushOnboardingDismissedAt(userId) {
  if (!userId) return null;
  try {
    const raw = localStorage.getItem(pushOnboardingDismissedKey(userId));
    if (!raw) return null;
    const ts = Number(raw);
    return Number.isFinite(ts) && ts > 0 ? ts : null;
  } catch {
    return null;
  }
}

export function markPushOnboardingDismissed(userId) {
  if (!userId) return;
  try {
    localStorage.setItem(pushOnboardingDismissedKey(userId), String(Date.now()));
  } catch {
    /* ignore */
  }
}

/** True hvis vi må vise prompt igen (aldrig dismisset eller ældre end reprompt-vindue). */
export function shouldRepromptPushOnboarding(userId, nowMs = Date.now()) {
  const dismissedAt = getPushOnboardingDismissedAt(userId);
  if (!dismissedAt) return true;
  return nowMs - dismissedAt >= PUSH_ONBOARDING_REPROMPT_MS;
}

/**
 * Skal dedikeret onboarding-modal vises?
 * Kræver at kaldende har tjekket subscription + permission + support.
 */
export function shouldShowPushOnboardingPrompt(userId, { isSubscribed, permission, pushSupported }) {
  if (!userId || !pushSupported) return false;
  if (isSubscribed) return false;
  if (permission === 'denied') return false;
  if (isPushPermanentlyBlocked()) return false;
  return shouldRepromptPushOnboarding(userId);
}

/** Banner i klokken: vis opt-in så længe push ikke er aktivt og browser ikke har afvist permanent. */
export function shouldShowPushBellBanner({ isSubscribed, permission, pushSupported }) {
  if (!pushSupported) return false;
  if (isSubscribed) return false;
  if (permission === 'denied') return false;
  if (isPushPermanentlyBlocked()) return false;
  return true;
}
