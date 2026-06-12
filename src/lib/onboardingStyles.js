/**
 * Delte inline-styles til onboarding/opret-flowet — matcher docs/redesign-full-app.html
 * (.field, .input, .btn-navy, .btn-ghost, .topbar, .chip, .inset-card, .step-dot m.fl.)
 * Bruger theme-tokens fra platformTheme, så dark mode følger med.
 */
import { font, theme } from './platformTheme';

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
  borderRadius: 10,
  padding: '12px 14px',
  fontSize: 14,
  fontWeight: 500,
  lineHeight: 1.3,
  transition: 'border-color 0.15s',
};

/** .field label — 12px/600 */
export const obLabel = {
  display: 'block',
  fontFamily: font,
  fontSize: 12,
  fontWeight: 600,
  color: theme.text,
  marginBottom: 7,
};

/** .btn-navy — fuldbredde primærknap */
export const btnNavy = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  background: theme.navy,
  color: '#fff',
  border: 'none',
  cursor: 'pointer',
  fontFamily: font,
  fontWeight: 600,
  fontSize: 14.5,
  borderRadius: 10,
  padding: 14,
  width: '100%',
  boxShadow: '0 6px 14px rgba(22, 55, 126, 0.32)',
};

/** .btn-ghost — fuldbredde sekundærknap */
export const btnGhost = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  background: theme.surface,
  color: theme.navy,
  border: `1.5px solid ${theme.border}`,
  cursor: 'pointer',
  fontFamily: font,
  fontWeight: 600,
  fontSize: 14.5,
  borderRadius: 10,
  padding: 13,
  width: '100%',
};

/** .chip / .chip.active — pill-vælger */
export const chipStyle = (active, extra = {}) => ({
  fontFamily: font,
  border: `1.5px solid ${active ? theme.navy : theme.border}`,
  background: active ? theme.navy : theme.surface,
  color: active ? '#fff' : theme.textLight,
  fontWeight: 600,
  fontSize: 12.5,
  padding: '8px 15px',
  borderRadius: 999,
  whiteSpace: 'nowrap',
  cursor: 'pointer',
  transition: 'background 0.12s, border-color 0.12s, color 0.12s',
  ...extra,
});

/** .inset-card — grå info-flade */
export const insetCard = {
  background: theme.surfaceAlt,
  borderRadius: 14,
  padding: '14px 16px',
  border: `1px solid ${theme.border}`,
};

/** Hvidt kort (mockup .card) */
export const whiteCard = {
  background: theme.surface,
  borderRadius: 14,
  border: `1px solid ${theme.border}`,
  boxShadow: '0 2px 8px rgba(13,39,82,0.07)',
};

/** .circle-btn — rund tilbage-knap i topbar */
export const circleBtn = {
  width: 39,
  height: 39,
  borderRadius: '50%',
  background: theme.surface,
  border: `1px solid ${theme.border}`,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: theme.text,
  cursor: 'pointer',
  flex: 'none',
  padding: 0,
};

/** .topbar h2 — 19px/600/-0.3px */
export const topbarTitle = {
  flex: 1,
  fontSize: 19,
  fontWeight: 600,
  letterSpacing: '-0.3px',
  color: theme.text,
  margin: 0,
  fontFamily: font,
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
  width: 26,
  height: 4,
  borderRadius: 99,
  background: on ? theme.navy : theme.border,
  transition: 'background 0.3s',
});

/** Centreret skærm-intro: overskrift 18px/600/-0.3px + undertekst */
export const screenHeading = {
  fontSize: 18,
  fontWeight: 600,
  letterSpacing: '-0.3px',
  color: theme.text,
  fontFamily: font,
};

export const screenSub = {
  fontSize: 12.5,
  color: theme.textLight,
  marginTop: 5,
  lineHeight: 1.5,
};

/** .field-hint */
export const fieldHint = {
  fontSize: 11,
  color: theme.textLight,
  marginTop: 6,
  lineHeight: 1.5,
};
