/**
 * Delte inline-styles til onboarding/opret-flowet — matcher docs/redesign-full-app.html
 * (.field, .input, .btn-navy, .btn-ghost, .topbar, .chip, .inset-card, .step-dot m.fl.)
 * Bruger theme-tokens fra platformTheme, så dark mode følger med.
 */
import { font, displayFont, theme } from './platformTheme.js';

/** Navy gradient-hero (mockup: linear-gradient(150deg, #0D2752, #1D4A9E)) */
export const navyGradient = `linear-gradient(150deg, ${theme.navyDeep}, ${theme.navySoft})`;

/** .input — felt-input (1.5px border, radius 10) */
export const obInput = {
  fontFamily: font,
  width: '100%',
  boxSizing: 'border-box',
  outline: 'none',
  background: theme.surface,
  color: theme.text,
  border: `1.5px solid ${theme.border}`,
  borderRadius: 'var(--pm-radius-sm)',
  minHeight: 52,
  padding: '13px 16px',
  // 16px: mindre tekst faar iPhone til at zoome ind, naar man trykker i feltet.
  fontSize: 16,
  fontWeight: 500,
  lineHeight: 1.3,
  transition: 'border-color 0.15s',
};

/** .field label — 12px/600 */
export const obLabel = {
  display: 'block',
  fontFamily: font,
  fontSize: 14,
  fontWeight: 600,
  color: theme.text,
  marginBottom: 7,
};

/** .btn-navy — fuldbredde primærknap */
export const btnNavy = {
  // H (ejeren 17. nov. 2026): skaermens hovedhandling er en lime, helt rund knap.
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  background: 'var(--pm-lime)',
  color: 'var(--pm-on-lime)',
  border: 'none',
  cursor: 'pointer',
  fontFamily: displayFont,
  fontWeight: 800,
  fontSize: 18,
  letterSpacing: '-0.01em',
  borderRadius: 999,
  minHeight: 54,
  padding: '0 20px',
  width: '100%',
};

/** .btn-ghost — fuldbredde sekundærknap */
export const btnGhost = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  background: theme.surface,
  color: theme.text,
  border: `1.5px solid ${theme.border}`,
  cursor: 'pointer',
  fontFamily: font,
  fontWeight: 700,
  fontSize: 16,
  borderRadius: 999,
  minHeight: 52,
  padding: '0 18px',
  width: '100%',
};

/** .chip / .chip.active — pill-vælger */
export const chipStyle = (active, extra = {}) => ({
  fontFamily: font,
  border: `1.5px solid ${active ? theme.navy : theme.border}`,
  background: active ? theme.navy : theme.surface,
  color: active ? '#fff' : theme.textLight,
  fontWeight: 600,
  fontSize: 13,
  padding: '8px 15px',
  borderRadius: 999,
  whiteSpace: 'nowrap',
  cursor: 'pointer',
  transition: 'background 0.12s, border-color 0.12s, color 0.12s',
  ...extra,
});

/** .inset-card — grå info-flade */
export const insetCard = {
  background: 'var(--pm-surface-muted)',
  borderRadius: 'var(--pm-radius-sm)',
  padding: '14px 16px',
};

/** Hvidt kort (mockup .card) */
export const whiteCard = {
  background: theme.surface,
  borderRadius: 'var(--pm-radius-lg)',
  border: `1px solid ${theme.border}`,
};

/** .circle-btn — rund tilbage-knap i topbar */
export const circleBtn = {
  // 44x44: tilbage- og annuller-knapperne i oprettelsen er kun ikoner, og
  // ikon-knapper er de svaereste at ramme. 39px var under Apples mindstemaal.
  width: 44,
  height: 44,
  borderRadius: '50%',
  background: theme.surface,
  border: 'none',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: theme.text,
  cursor: 'pointer',
  flex: 'none',
  padding: 0,
};

/** .topbar h1 — 19px/600/-0.3px (sidens eneste overskrift på øverste niveau) */
export const topbarTitle = {
  flex: 1,
  fontSize: 20,
  fontWeight: 700,
  letterSpacing: '-0.02em',
  color: theme.text,
  margin: 0,
  fontFamily: displayFont,
};

/** .ob-icon — rund ikon-cirkel øverst på bekræftelses-skærme */
export const obIcon = {
  width: 70,
  height: 70,
  borderRadius: '50%',
  background: theme.surfaceAlt,
  border: `1px solid ${theme.border}`,
  color: theme.navy,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  margin: '18px auto 16px',
};

/** .step-dot — trin-indikator */
export const stepDot = (on) => ({
  flex: 1,
  height: 5,
  borderRadius: 99,
  background: on ? 'var(--pm-accent-solid)' : theme.border,
  transition: 'background 0.3s',
});

/** Centreret skærm-intro: overskrift 18px/600/-0.3px + undertekst */
export const screenHeading = {
  fontSize: 28,
  fontWeight: 800,
  letterSpacing: '-0.03em',
  lineHeight: 1.1,
  color: theme.text,
  fontFamily: displayFont,
};

export const screenSub = {
  fontSize: 15,
  color: theme.textMid,
  marginTop: 6,
  lineHeight: 1.5,
};

/** .field-hint */
export const fieldHint = {
  fontSize: 13,
  color: theme.textLight,
  marginTop: 6,
  lineHeight: 1.5,
};
