const SIZE_CLASS = {
  sm: 'pm-pill-tab--sm',
  md: 'pm-pill-tab--md',
};

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
  const sizeClass = SIZE_CLASS[size] || SIZE_CLASS.md;

  return (
    <div
      className={cx('pm-pill-tabs', className)}
      style={style}
      role="tablist"
      aria-label={ariaLabel}
    >
      {(tabs || []).map((tab) => (
        <button
          key={tab.id}
          className={cx(
            'pm-pill-tab',
            sizeClass,
            value === tab.id && 'pm-pill-tab-active'
          )}
          type="button"
          role="tab"
          aria-selected={value === tab.id}
          disabled={tab.disabled}
          onClick={() => {
            if (tab.disabled) return;
            onChange?.(tab.id);
          }}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
