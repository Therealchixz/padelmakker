import { useEffect } from 'react';

/**
 * Scroll et felt (eller dets container) ind i view og fokusér input hvis muligt.
 * Returnerer cleanup til setTimeout.
 */
export function scrollFormFieldIntoView(containerEl, { focusEl, block = 'center', delayMs = 50 } = {}) {
  if (!containerEl || typeof containerEl.scrollIntoView !== 'function') return undefined;
  const id = window.setTimeout(() => {
    containerEl.scrollIntoView({ behavior: 'smooth', block });
    const focusTarget = focusEl
      ?? (containerEl.matches?.('input, select, textarea, button') ? containerEl : null)
      ?? containerEl.querySelector?.(
        'input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"]), select, textarea, [tabindex]:not([tabindex="-1"])',
      );
    focusTarget?.focus?.({ preventScroll: true });
  }, delayMs);
  return () => window.clearTimeout(id);
}

/** Scroll til element via id — typisk input#login-email osv. */
export function scrollToFieldById(fieldId, options) {
  if (!fieldId || typeof document === 'undefined') return undefined;
  const el = document.getElementById(fieldId);
  if (!el) return undefined;
  const container = el.closest('[data-pm-field]') ?? el.closest('.pm-field') ?? el.parentElement ?? el;
  return scrollFormFieldIntoView(container, { focusEl: el, ...options });
}

/** Kør scroll når en fejlstreng bliver sat (efter re-render). */
export function useScrollToFieldOnError(error, fieldRef, inputRef, options) {
  const block = options?.block ?? 'center';
  const delayMs = options?.delayMs ?? 50;
  useEffect(() => {
    if (!error) return undefined;
    return scrollFormFieldIntoView(fieldRef?.current, {
      focusEl: inputRef?.current,
      block,
      delayMs,
    });
  }, [error, fieldRef, inputRef, block, delayMs]);
}

/** Første onboarding-felt ud fra missingStepRequirements-labels. */
export const ONBOARDING_MISSING_FIELD_IDS = {
  'fornavn og efternavn': 'onb-first-name',
  'gyldig email': 'onb-email',
  'email skrevet ens i begge felter': 'onb-email-confirm',
  'adgangskode på mindst 8 tegn': 'onb-password',
  'ens adgangskoder': 'onb-password-confirm',
  'gyldigt telefonnummer': 'onb-phone',
  fødselsdato: 'onb-birth-day',
  niveau: 'onb-level-section',
  spillestil: 'onb-style',
  'side på banen': 'onb-court-side',
  region: 'onb-region',
  'accept af vilkår og privatlivspolitik': 'onb-terms',
};

export function resolveOnboardingFieldIdFromMissing(missingLabels) {
  if (!Array.isArray(missingLabels) || missingLabels.length === 0) return null;
  return ONBOARDING_MISSING_FIELD_IDS[missingLabels[0]] ?? null;
}

/** Scroll til onboarding-felt ud fra finish()-fejlbesked (step 3). */
export function resolveOnboardingFieldIdFromErrorMessage(message) {
  const msg = String(message || '').toLowerCase();
  if (!msg) return null;
  if (msg.includes('handelsbetingelser') || msg.includes('privatlivspolitik')) return 'onb-terms';
  if (msg.includes('robot')) return 'onb-captcha';
  if (msg.includes('telefonnummer')) return 'onb-phone';
  if (msg.includes('region')) return 'onb-region';
  if (msg.includes('adgangskoderne er ikke ens') || msg.includes('matcher ikke')) return 'onb-password-confirm';
  if (msg.includes('adgangskode')) return 'onb-password';
  if (msg.includes('gentag din e-mail') || msg.includes('bekræft email')) return 'onb-email-confirm';
  if (msg.includes('e-mail') || msg.includes('email')) return 'onb-email';
  if (msg.includes('navn')) return 'onb-first-name';
  return null;
}

export function scrollOnboardingValidationError(message, missingLabels) {
  const fieldId = resolveOnboardingFieldIdFromErrorMessage(message)
    ?? resolveOnboardingFieldIdFromMissing(missingLabels);
  if (fieldId) return scrollToFieldById(fieldId);
  return undefined;
}
