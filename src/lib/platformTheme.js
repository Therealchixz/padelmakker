/** Design tokens (mirrors variables.css) + shared inline-style helpers */

export const font = "var(--pm-font)";
export const displayFont = "var(--pm-font-display)";

export const theme = {
  bg:          'var(--pm-bg)',
  surface:     'var(--pm-surface)',
  surfaceAlt:  'var(--pm-surface-alt)',
  text:        'var(--pm-text)',
  textMid:     'var(--pm-text-mid)',
  textLight:   'var(--pm-text-light)',
  accent:      'var(--pm-accent)',
  accentHover: 'var(--pm-accent-hover)',
  accentBg:    'var(--pm-accent-bg)',
  onAccent:    'var(--pm-on-accent)',
  warm:        'var(--pm-warm)',
  warmBg:      'var(--pm-warm-bg)',
  blue:        'var(--pm-blue)',
  blueBg:      'var(--pm-blue-bg)',
  infoBorder:  'var(--pm-info-border)',
  red:         'var(--pm-red)',
  redBg:       'var(--pm-red-bg)',
  dangerStrong:'var(--pm-danger-strong)',
  green:       'var(--pm-green)',
  greenBg:     'var(--pm-green-bg)',
  purple:      'var(--pm-purple)',
  purpleBg:    'var(--pm-purple-bg)',
  brandGradient: 'var(--pm-brand-gradient)',
  eloProgressTrack: 'var(--pm-elo-progress-track)',
  overlay:     'var(--pm-overlay)',
  overlayStrong: 'var(--pm-overlay-strong)',
  border:      'var(--pm-border)',
  shadow:      'var(--pm-shadow)',
  shadowLg:    'var(--pm-shadow-lg)',
  shadowSoft:  'var(--pm-shadow-soft)',
  shadowAccent:'var(--pm-shadow-accent)',
  menuShadow:  'var(--pm-menu-shadow)',
  modalShadow: 'var(--pm-modal-shadow)',
  radiusSm:    'var(--pm-radius-sm)',
  radius:      'var(--pm-radius-lg)',
  radiusXl:    'var(--pm-radius-xl)',
  space1:      'var(--pm-space-1)',
  space2:      'var(--pm-space-2)',
  space3:      'var(--pm-space-3)',
  space4:      'var(--pm-space-4)',
  controlHeight: 'var(--pm-control-h)',
};

const BTN_SIZE_PRESETS = {
  sm: {
    fontSize: '12px',
    padding: '8px var(--pm-space-2)',
    minHeight: '34px',
    gap: '5px',
  },
  md: {
    fontSize: '14px',
    padding: '10px var(--pm-space-3)',
    minHeight: 'var(--pm-control-h)',
    gap: '6px',
  },
  lg: {
    fontSize: '15px',
    padding: '12px calc(var(--pm-space-3) + 4px)',
    minHeight: '46px',
    gap: '8px',
  },
};

const BTN_RADIUS_PRESETS = {
  sm: 'var(--pm-radius-sm)',
  md: 'var(--pm-radius-md)',
  lg: 'var(--pm-radius-lg)',
  xl: 'var(--pm-radius-xl)',
  pill: '999px',
};

export const btn = (primary, options = {}) => {
  const {
    size,
    radius = 'md',
    minHeight,
    fontWeight,
  } = options;
  const sizePreset = size ? BTN_SIZE_PRESETS[size] : null;
  const radiusValue = BTN_RADIUS_PRESETS[radius] || radius;

  return {
    fontFamily: font,
    fontSize: sizePreset?.fontSize || '14px',
    fontWeight: fontWeight ?? 700,
    padding: sizePreset?.padding || '10px var(--pm-space-3)',
    borderRadius: radiusValue,
    border: primary ? '1px solid var(--pm-accent)' : '1px solid var(--pm-border)',
    background: primary ? 'var(--pm-accent)' : 'var(--pm-surface)',
    color: primary ? 'var(--pm-on-accent)' : 'var(--pm-text)',
    cursor: 'pointer',
    transition: 'background-color 0.18s, border-color 0.18s, color 0.18s, box-shadow 0.18s',
    letterSpacing: '-0.01em',
    lineHeight: 1.2,
    boxShadow: primary ? 'var(--pm-shadow-btn)' : 'none',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: sizePreset?.gap || '6px',
    ...(sizePreset?.minHeight || minHeight ? { minHeight: minHeight || sizePreset?.minHeight } : {}),
  };
};

export const inputStyle = {
  fontFamily: font,
  fontSize: '14px',
  padding: '10px calc(var(--pm-space-2) + 2px)',
  borderRadius: 'var(--pm-radius-md)',
  border: '1px solid var(--pm-border)',
  background: 'var(--pm-surface)',
  color: 'var(--pm-text)',
  width: '100%',
  boxSizing: 'border-box',
  outline: 'none',
  transition: 'border-color 0.15s',
};

export const tag = (bg, color) => ({
  fontSize: '10px',
  fontWeight: 700,
  padding: '2px 7px',
  borderRadius: '4px',
  background: bg,
  color,
  display: 'inline-flex',
  alignItems: 'center',
  gap: '3px',
  letterSpacing: '0.05em',
  textTransform: 'uppercase',
  whiteSpace: 'nowrap',
});

export const labelStyle = {
  fontSize: '12px',
  fontWeight: 600,
  display: 'block',
  marginBottom: '5px',
  color: 'var(--pm-text-mid)',
  letterSpacing: '0.01em',
};

export const heading = (size = '24px') => ({
  fontFamily: displayFont,
  fontSize: size,
  fontWeight: 800,
  letterSpacing: '-0.03em',
  color: 'var(--pm-text)',
});
