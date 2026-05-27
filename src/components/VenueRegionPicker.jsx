import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { BANER_REGION_SUBTITLE } from '../lib/banerRegions';
import { groupMatchVenueOptionsFromFlat, splitMatchVenueOptions } from '../lib/matchVenueOptions';
import { inputStyle } from '../lib/platformTheme';

/**
 * @typedef {{ id: string, label: string, courtId?: string | null }} VenueRegionOption
 */

/**
 * Kompakt dropdown: vælg region → vælg center i fold-ud liste.
 * @param {{
 *   value: string,
 *   onChange: (id: string) => void,
 *   options?: VenueRegionOption[],
 *   emptyLabel?: string,
 *   placeholder?: string,
 *   ariaLabel?: string,
 * }} props
 */
export function VenueRegionPicker({
  value,
  onChange,
  options = [],
  emptyLabel = 'Indlæser centre…',
  placeholder = 'Vælg bane',
  ariaLabel = 'Vælg bane eller center',
}) {
  const rootRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [expandedRegions, setExpandedRegions] = useState(() => new Set());

  const { special, venues } = useMemo(() => splitMatchVenueOptions(options), [options]);
  const grouped = useMemo(() => groupMatchVenueOptionsFromFlat(venues), [venues]);
  const selected = useMemo(
    () => (options || []).find((o) => o.id === value) || null,
    [options, value],
  );

  const triggerLabel = selected?.label || (options.length ? placeholder : emptyLabel);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (e) => {
      if (!rootRef.current?.contains(e.target)) setOpen(false);
    };
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

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
    const isOpen = e.currentTarget.open;
    setExpandedRegions((prev) => {
      const next = new Set(prev);
      if (isOpen) next.add(region);
      else next.delete(region);
      return next;
    });
  }, []);

  const pick = useCallback(
    (id) => {
      onChange(id);
      setOpen(false);
    },
    [onChange],
  );

  if (!options.length) {
    return (
      <div className="pm-venue-region-picker pm-venue-region-picker--empty" aria-label={ariaLabel}>
        <div className="pm-venue-region-picker-trigger pm-venue-region-picker-trigger--disabled" style={inputStyle}>
          {emptyLabel}
        </div>
      </div>
    );
  }

  return (
    <div className="pm-venue-region-picker" ref={rootRef}>
      <button
        type="button"
        className={`pm-venue-region-picker-trigger${open ? ' pm-venue-region-picker-trigger--open' : ''}`}
        style={inputStyle}
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="pm-venue-region-picker-trigger-label">{triggerLabel}</span>
        <ChevronDown size={16} className="pm-venue-region-picker-trigger-chevron" aria-hidden />
      </button>

      {open ? (
        <div className="pm-venue-region-picker-menu" role="listbox" aria-label={ariaLabel}>
          {special.length > 0 ? (
            <div className="pm-venue-region-picker-menu-special">
              {special.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  role="option"
                  aria-selected={value === o.id}
                  className={`pm-venue-region-picker-option${value === o.id ? ' pm-venue-region-picker-option--active' : ''}`}
                  onClick={() => pick(o.id)}
                >
                  {o.label}
                </button>
              ))}
            </div>
          ) : null}

          <div className="pm-venue-region-picker-menu-regions">
            {grouped.map(({ region, options: regionOptions }) => (
              <details
                key={region}
                className="pm-venue-region-picker-region"
                open={expandedRegions.has(region)}
                onToggle={(e) => onRegionToggle(region, e)}
              >
                <summary className="pm-venue-region-picker-region-summary">
                  <span className="pm-venue-region-picker-region-title">
                    {region}
                    {BANER_REGION_SUBTITLE[region] ? (
                      <span className="pm-venue-region-picker-region-sub">
                        {' '}
                        ({BANER_REGION_SUBTITLE[region]})
                      </span>
                    ) : null}
                  </span>
                  <ChevronDown size={14} className="pm-venue-region-picker-region-chevron" aria-hidden />
                </summary>
                {expandedRegions.has(region) ? (
                  <div className="pm-venue-region-picker-venue-list">
                    {regionOptions.map((o) => (
                      <button
                        key={o.id}
                        type="button"
                        role="option"
                        aria-selected={value === o.id}
                        className={`pm-venue-region-picker-option${value === o.id ? ' pm-venue-region-picker-option--active' : ''}`}
                        onClick={() => pick(o.id)}
                      >
                        {o.label}
                      </button>
                    ))}
                  </div>
                ) : null}
              </details>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
