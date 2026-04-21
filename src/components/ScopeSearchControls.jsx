import { Search } from 'lucide-react';
import { PillTabs } from './PillTabs';

function cx(...parts) {
  return parts.filter(Boolean).join(' ');
}

export function ScopeSearchControls({
  tabs,
  value,
  onTabChange,
  searchValue,
  onSearchChange,
  searchPlaceholder,
  tabAriaLabel,
  size = 'md',
  className,
  tabsClassName,
  searchWrapClassName,
  searchInputClassName,
  searchIconClassName,
  style,
}) {
  const rowStyle = className
    ? {}
    : {
        display: 'grid',
        gridTemplateColumns: 'auto minmax(0, 1fr)',
        gap: 'var(--pm-space-2)',
        alignItems: 'center',
      };

  return (
    <div
      className={className}
      style={{
        ...rowStyle,
        ...style,
      }}
    >
      <PillTabs
        tabs={tabs}
        value={value}
        onChange={onTabChange}
        ariaLabel={tabAriaLabel}
        size={size}
        className={tabsClassName}
        style={{ margin: 0 }}
      />

      <div
        className={cx('pm-scope-search-wrap', searchWrapClassName)}
        style={{ position: 'relative', minWidth: 0 }}
      >
        <Search
          size={16}
          className={searchIconClassName}
          style={{
            position: 'absolute',
            left: 11,
            top: '50%',
            transform: 'translateY(-50%)',
            color: 'var(--pm-text-light)',
            pointerEvents: 'none',
          }}
        />
        <input
          type="text"
          value={searchValue}
          onChange={(e) => onSearchChange?.(e.target.value)}
          placeholder={searchPlaceholder}
          className={searchInputClassName}
          style={{
            width: '100%',
            height: 'var(--pm-control-h)',
            padding: '9px 12px 9px 36px',
            borderRadius: 'var(--pm-radius-md)',
            border: '1px solid var(--pm-border)',
            fontSize: 13,
            color: 'var(--pm-text)',
            background: 'var(--pm-surface)',
            outline: 'none',
            boxSizing: 'border-box',
          }}
        />
      </div>
    </div>
  );
}
