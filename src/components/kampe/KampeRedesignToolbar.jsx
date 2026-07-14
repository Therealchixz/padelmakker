import { Plus, Search, SlidersHorizontal, ArrowLeft, Info } from 'lucide-react';

function UnreadBadge({ count }) {
  if (!count) return null;
  return (
    <span
      className="pm-kampe-v2-unread"
      aria-label={`${count} ulæste notifikationer`}
    >
      {count > 9 ? '9+' : count}
    </span>
  );
}

export function KampeRedesignToolbar({
  formatTabs,
  format,
  onFormatChange,
  searchQuery,
  onSearchChange,
  searchPlaceholder,
  onFilterOpen,
  filterActive = false,
  onCreate,
  createLabel = 'Opret kamp',
  createBusy = false,
}) {
  return (
    <div className="pm-kampe-v2-toolbar">
      <div className="pm-kampe-v2-head">
        <h2 className="pm-kampe-v2-title">Kampe</h2>
        {onCreate ? (
          <button
            type="button"
            className="pm-kampe-v2-create pm-kampe-v2-create--icon"
            onClick={onCreate}
            disabled={createBusy}
            aria-label={createLabel}
            title={createLabel}
          >
            <Plus size={18} strokeWidth={2.5} aria-hidden />
          </button>
        ) : null}
      </div>

      <div className="pm-kampe-v2-format-row" role="tablist" aria-label="Kampe format">
        {formatTabs.map((tab) => {
          const active = format === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active}
              className={`pm-kampe-v2-format-pill${active ? ' pm-kampe-v2-format-pill--active' : ''}`}
              onClick={() => onFormatChange(tab.id)}
            >
              <span>{tab.label}</span>
              {active && tab.count != null ? (
                <span className="pm-kampe-v2-format-count">{tab.count}</span>
              ) : null}
              {!active && tab.unread ? <UnreadBadge count={tab.unread} /> : null}
            </button>
          );
        })}
      </div>

      <div className="pm-kampe-v2-search-row">
        <label className="pm-kampe-v2-search-wrap">
          <Search size={16} className="pm-kampe-v2-search-icon" aria-hidden />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            className="pm-kampe-v2-search-input"
          />
        </label>
        <button
          type="button"
          className={`pm-kampe-v2-filter-btn${filterActive ? ' pm-kampe-v2-filter-btn--active' : ''}`}
          onClick={onFilterOpen}
          aria-label="Filtrer kampe"
        >
          <SlidersHorizontal size={18} strokeWidth={2} aria-hidden />
        </button>
      </div>
    </div>
  );
}

export function KampeCreateHeader({ title, onBack, onInfo }) {
  return (
    <div className="pm-kampe-v2-create-head">
      <button
        type="button"
        className="pm-kampe-v2-circle-btn"
        onClick={onBack}
        aria-label="Tilbage"
      >
        <ArrowLeft size={18} strokeWidth={2.2} aria-hidden />
      </button>
      <h2 className="pm-kampe-v2-create-title">{title}</h2>
      {onInfo ? (
        <button
          type="button"
          className="pm-kampe-v2-circle-btn"
          onClick={onInfo}
          aria-label="Information"
        >
          <Info size={18} strokeWidth={2} aria-hidden />
        </button>
      ) : (
        <span className="pm-kampe-v2-circle-btn pm-kampe-v2-circle-btn--ghost" aria-hidden />
      )}
    </div>
  );
}

export function KampeActiveFilterChips({ chips }) {
  if (!chips?.length) return null;
  return (
    <div className="pm-kampe-v2-active-chips">
      {chips.map((chip) => (
        <button
          key={chip.id}
          type="button"
          className={`pm-kampe-v2-active-chip${chip.tone ? ` pm-kampe-v2-active-chip--${chip.tone}` : ''}`}
          onClick={chip.onClick}
        >
          {chip.label}
        </button>
      ))}
    </div>
  );
}
