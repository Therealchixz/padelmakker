/** Design tokens (mirrors variables.css) + shared inline-style helpers */

export const font = "'Inter', sans-serif";

export const theme = {
  bg: '#F0F4F8',
  surface: '#FFFFFF',
  text: '#0B1120',
  textMid: '#3E4C63',
  textLight: '#8494A7',
  accent: '#1D4ED8',
  accentHover: '#1E40AF',
  accentBg: '#DBEAFE',
  warm: '#D97706',
  warmBg: '#FEF3C7',
  blue: '#2563EB',
  blueBg: '#EFF6FF',
  red: '#DC2626',
  redBg: '#FEF2F2',
  border: '#D5DDE8',
  shadow: '0 1px 3px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.04)',
  shadowLg: '0 8px 32px rgba(0,0,0,0.12)',
  radius: '12px',
};

export const btn = (primary) => ({
  fontFamily: font,
  fontSize: '14px',
  fontWeight: 600,
  padding: '10px 20px',
  borderRadius: '8px',
  border: primary ? 'none' : '1px solid ' + theme.border,
  background: primary ? theme.accent : theme.surface,
  color: primary ? '#fff' : theme.text,
  cursor: 'pointer',
  transition: 'opacity 0.15s, box-shadow 0.15s',
  letterSpacing: '-0.01em',
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
});

export const inputStyle = {
  fontFamily: font,
  fontSize: '14px',
  padding: '10px 14px',
  borderRadius: '8px',
  border: '1px solid ' + theme.border,
  background: theme.surface,
  color: theme.text,
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
  color: theme.textMid,
  letterSpacing: '0.01em',
};

export const heading = (size = '24px') => ({
  fontFamily: font,
  fontSize: size,
  fontWeight: 800,
  letterSpacing: '-0.03em',
  color: theme.text,
});
