import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { BANER_REGION_SUBTITLE } from '../lib/banerRegions';
import { groupMatchVenueOptionsFromFlat, splitMatchVenueOptions } from '../lib/matchVenueOptions';
import { theme } from '../lib/platformTheme';

/**
 * @typedef {{ id: string, label: string, courtId?: string | null }} VenueRegionOption
 */

/**
 * Vælg bane/center: fold regioner ud og vælg center under landsdelen.
 * Genbruger Baner-fanens region-styling.
 * @param {{
 *   value: string,
 *   onChange: (id: string) => void,
 *   options?: VenueRegionOption[],
 *   emptyLabel?: string,
 *   ariaLabel?: string,
 * }} props
 */
export function VenueRegionPicker({
  value,
  onChange,
  options = [],
  emptyLabel = 'Indlæser centre…',
  ariaLabel = 'Vælg bane eller center',
}) {
  const { special, venues } = useMemo(() => splitMatchVenueOptions(options), [options]);
  const grouped = useMemo(() => groupMatchVenueOptionsFromFlat(venues), [venues]);
  const selected = useMemo(
    () => (options || []).find((o) => o.id === value) || null,
    [options, value],
  );
  const [expandedRegions, setExpandedRegions] = useState(() => new Set());

  useEffect(() => {
    if (!value) return;
    for (const g of grouped) {
      if (g.options.some((o) => o.id === value)) {
        setExpandedRegions((prev) => {
          if (prev.has(g.region)) return prev;
          const next = new Set(prev);
          next.add(g.region);
          return next;
        });
        break;
      }
    }
  }, [value, grouped]);

  const onRegionToggle = useCallback((region, e) => {
    const open = e.currentTarget.open;
    setExpandedRegions((prev) => {
      const next = new Set(prev);
      if (open) next.add(region);
      else next.delete(region);
      return next;
    });
  }, []);

  if (!options.length) {
    return (
      <div className="pm-venue-region-picker pm-venue-region-picker--empty" aria-label={ariaLabel}>
        <p className="pm-venue-region-picker-empty">{emptyLabel}</p>
      </div>
    );
  }

  return (
    <div className="pm-venue-region-picker" role="group" aria-label={ariaLabel}>
      {selected ? (
        <div className="pm-venue-region-picker-selected">
          <span className="pm-venue-region-picker-selected-label">Valgt</span>
          <span className="pm-venue-region-picker-selected-name">{selected.label}</span>
        </div>
      ) : null}

      {special.length > 0 ? (
        <div className="pm-venue-region-picker-special">
          {special.map((o) => (
            <button
              key={o.id}
              type="button"
              className={`pm-venue-region-picker-option${value === o.id ? ' pm-venue-region-picker-option--active' : ''}`}
              aria-pressed={value === o.id}
              onClick={() => onChange(o.id)}
            >
              {o.label}
            </button>
          ))}
        </div>
      ) : null}

      <div className="pm-venue-region-picker-regions">
        {grouped.map(({ region, options: regionOptions }) => (
          <details
            key={region}
            className="pm-baner-region pm-baner-region-fold pm-ui-card pm-venue-region-picker-region"
            open={expandedRegions.has(region)}
            onToggle={(e) => onRegionToggle(region, e)}
          >
            <summary className="pm-baner-region-summary">
              <div className="pm-baner-region-summary-text">
                <h3 className="pm-baner-region-title">
                  {region}
                  {BANER_REGION_SUBTITLE[region] ? (
                    <span className="pm-baner-region-sub"> ({BANER_REGION_SUBTITLE[region]})</span>
                  ) : null}
                </h3>
                <span className="pm-baner-region-count">
                  {regionOptions.length} {regionOptions.length === 1 ? 'center' : 'centre'}
                </span>
              </div>
              <ChevronDown size={18} className="pm-baner-region-chevron" aria-hidden />
            </summary>
            {expandedRegions.has(region) ? (
              <div className="pm-baner-region-body">
                <div className="pm-venue-region-picker-venue-list">
                  {regionOptions.map((o) => (
                    <button
                      key={o.id}
                      type="button"
                      className={`pm-venue-region-picker-option${value === o.id ? ' pm-venue-region-picker-option--active' : ''}`}
                      aria-pressed={value === o.id}
                      onClick={() => onChange(o.id)}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </details>
        ))}
      </div>

      {!selected && grouped.length > 0 ? (
        <p className="pm-venue-region-picker-hint" style={{ color: theme.textLight }}>
          Fold en region ud og vælg center.
        </p>
      ) : null}
    </div>
  );
}
