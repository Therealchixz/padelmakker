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
  warm:        'var(--pm-warm)',
  warmBg:      'var(--pm-warm-bg)',
  blue:        'var(--pm-blue)',
  blueBg:      'var(--pm-blue-bg)',
  red:         'var(--pm-red)',
  redBg:       'var(--pm-red-bg)',
  green:       'var(--pm-green)',
  greenBg:     'var(--pm-green-bg)',
  purple:      'var(--pm-purple)',
  purpleBg:    'var(--pm-purple-bg)',
  border:      'var(--pm-border)',
  shadow:      'var(--pm-shadow)',
  shadowLg:    'var(--pm-shadow-lg)',
  radiusSm:    'var(--pm-radius-sm)',
  radius:      'var(--pm-radius-lg)',
  radiusXl:    'var(--pm-radius-xl)',
  space1:      'var(--pm-space-1)',
  space2:      'var(--pm-space-2)',
  space3:      'var(--pm-space-3)',
  space4:      'var(--pm-space-4)',
  controlHeight: 'var(--pm-control-h)',
};

export const btn = (primary) => ({
  fontFamily: font,
  fontSize: '14px',
  fontWeight: 700,
  padding: '10px var(--pm-space-3)',
  borderRadius: 'var(--pm-radius-md)',
  border: primary ? '1px solid var(--pm-accent)' : '1px solid var(--pm-border)',
  background: primary ? 'var(--pm-accent)' : 'var(--pm-surface)',
  color: primary ? '#fff' : 'var(--pm-text)',
  cursor: 'pointer',
  transition: 'background-color 0.18s, border-color 0.18s, color 0.18s, box-shadow 0.18s',
  letterSpacing: '-0.01em',
  lineHeight: 1.2,
  boxShadow: primary ? 'var(--pm-shadow-btn)' : 'none',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '6px',
});

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
