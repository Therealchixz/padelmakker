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
  return (
    <div className={cx('pm-scope-search-controls', className)} style={style}>
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
      >
        <Search size={16} className={cx('pm-scope-search-icon', searchIconClassName)} />
        <input
          type="text"
          value={searchValue}
          onChange={(e) => onSearchChange?.(e.target.value)}
          placeholder={searchPlaceholder}
          className={cx('pm-scope-search-input', searchInputClassName)}
        />
      </div>
    </div>
  );
}
