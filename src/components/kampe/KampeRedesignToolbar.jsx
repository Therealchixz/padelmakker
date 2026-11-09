import { Plus, SlidersHorizontal, ArrowLeft, Info } from 'lucide-react';
import '../../styles/kampe-v4.css';
import { ScreenHeader } from '../ScreenHeader';

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
  onFilterOpen,
  filterCount = 0,
  filterChips = [],
  onCreate,
  createLabel = 'Opret kamp',
  createBusy = false,
}) {
  return (
    <div className="pm-kampe-v2-toolbar pm-kampe-v4">
      <ScreenHeader
        title="Kampe"
        actions={onCreate ? (
          <button
            type="button"
            className="pm-kampe-v2-create pm-kampe-v4-create"
            onClick={onCreate}
            disabled={createBusy}
            aria-label={createLabel}
            title={createLabel}
          >
            {/* Redesign v4: synlig tekst, saa man ikke skal gaette, hvad plusset goer. */}
            <Plus size={16} strokeWidth={2.5} aria-hidden />
            <span>Opret</span>
          </button>
        ) : null}
      />

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

      {/* Én indgang til søgning og filtre (begge ligger i filterarket).
          Aktive filtre står som chips ved siden af, så man kan se og fjerne dem med ét tryk. */}
      <div className="pm-kampe-v4-filterbar">
        <button
          type="button"
          className="pm-kampe-v2-filter-btn pm-kampe-v4-filter-btn"
          onClick={onFilterOpen}
          aria-haspopup="dialog"
          aria-label={filterCount > 0
            ? `Filter og søgning, ${filterCount === 1 ? '1 aktivt filter' : `${filterCount} aktive filtre`}`
            : 'Filter og søgning'}
        >
          <SlidersHorizontal size={17} strokeWidth={2} aria-hidden />
          <span>Filter</span>
          {filterCount > 0 ? <span className="pm-kampe-v4-filter-count" aria-hidden>{filterCount}</span> : null}
        </button>
        <KampeActiveFilterChips chips={filterChips} />
      </div>
    </div>
  );
}

export function KampeCreateHeader({ title, onBack, onInfo = undefined }) {
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
          className={`pm-kampe-v2-active-chip pm-hit-44${chip.tone ? ` pm-kampe-v2-active-chip--${chip.tone}` : ''}`}
          onClick={chip.onClick}
          aria-label={chip.ariaLabel || undefined}
        >
          {chip.label}
        </button>
      ))}
    </div>
  );
}
