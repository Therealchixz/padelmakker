import { PillTabs } from './PillTabs';

export function TabbedFilterCard({
  tabs,
  value,
  onTabChange,
  tabAriaLabel,
  action,
  bottom,
  cardClassName = 'pm-ui-card pm-kampe-controls',
  cardStyle,
  topClassName = 'pm-kampe-controls-top',
  tabsClassName = 'pm-kampe-segment',
  actionClassName = 'pm-kampe-controls-action',
  dividerClassName = 'pm-kampe-controls-divider',
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
