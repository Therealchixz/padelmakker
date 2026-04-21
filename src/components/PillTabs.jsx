import { btn, theme } from '../lib/platformTheme';

const SIZE_PRESETS = {
  sm: { padding: 'calc(var(--pm-space-1) - 1px) var(--pm-space-3)', fontSize: '12px' },
  md: { padding: 'var(--pm-space-1) var(--pm-space-3)', fontSize: '13px' },
};

export function pillTabButtonStyle(active, size = 'md') {
  const preset = SIZE_PRESETS[size] || SIZE_PRESETS.md;
  return {
    ...btn(false),
    ...preset,
    borderRadius: '999px',
    background: active ? theme.accent : theme.surfaceAlt,
    color: active ? '#fff' : theme.textMid,
    borderColor: active ? theme.accent : theme.border,
    boxShadow: active ? '0 2px 8px rgba(29, 78, 216, 0.28)' : 'none',
    fontWeight: active ? 700 : 600,
  };
}

export function PillTabs({
  tabs,
  value,
  onChange,
  ariaLabel,
  size = 'md',
  className,
  style,
}) {
  const cx = (...parts) => parts.filter(Boolean).join(' ');

  return (
    <div
      className={className}
      style={{
        display: 'flex',
        gap: 'var(--pm-space-1)',
        flexWrap: 'wrap',
        ...style,
      }}
      role="tablist"
      aria-label={ariaLabel}
    >
      {(tabs || []).map((tab) => (
        <button
          key={tab.id}
          className={cx('pm-pill-tab', value === tab.id && 'pm-pill-tab-active')}
          type="button"
          role="tab"
          aria-selected={value === tab.id}
          disabled={tab.disabled}
          onClick={() => {
            if (tab.disabled) return;
            onChange?.(tab.id);
          }}
          style={pillTabButtonStyle(value === tab.id, size)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
