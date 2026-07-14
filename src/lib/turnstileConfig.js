/** Cloudflare Turnstile site key (public) — empty when captcha is disabled. */
export function getTurnstileSiteKey() {
  const raw = typeof import.meta !== 'undefined' ? import.meta.env?.VITE_TURNSTILE_SITE_KEY : '';
  return String(raw || '').trim();
}

export function isTurnstileEnabled() {
  return getTurnstileSiteKey().length > 0;
}
