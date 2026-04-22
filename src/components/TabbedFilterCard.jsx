import { PillTabs } from './PillTabs';

export function TabbedFilterCard({
  tabs,
  value,
  onTabChange,
  tabAriaLabel,
  action,
  bottom,
  cardClassName = 'pm-ui-card pm-kampe-controls pm-filter-card',
  cardStyle,
  topClassName = 'pm-kampe-controls-top pm-filter-card-top',
  tabsClassName = 'pm-kampe-segment pm-filter-card-tabs',
  actionClassName = 'pm-kampe-controls-action pm-filter-card-action',
  dividerClassName = 'pm-kampe-controls-divider pm-filter-card-divider',
}) {
  return (
    <div className={cardClassName} style={cardStyle}>
      <div className={topClassName}>
        <PillTabs
          tabs={tabs}
          value={value}
          onChange={onTabChange}
          ariaLabel={tabAriaLabel}
          className={tabsClassName}
        />
        <div className={actionClassName}>{action}</div>
      </div>

      {bottom ? (
        <>
          <div className={dividerClassName} />
          {bottom}
        </>
      ) : null}
    </div>
  );
}
