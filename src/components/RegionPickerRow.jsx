import { useState } from 'react';
import { Check, ChevronRight } from 'lucide-react';
import { APP_REGIONS, APP_REGION_NEIGHBOURS, canonicalAppRegion } from '../lib/appRegions';
import { ChatActionSheet } from './chat/ChatActionSheet';

/**
 * Region som én linje ("Nordjylland ›" + nabo-regionerne), der åbner en liste
 * fra bunden. Før fyldte otte knapper ca. en tredjedel af filtersiderne, selv
 * om man sjældent skifter region.
 */
export function RegionPickerRow({ value, onChange, sheetHint = '' }) {
  const [open, setOpen] = useState(false);
  const region = canonicalAppRegion(value);
  const neighbours = APP_REGION_NEIGHBOURS[region] || [];

  return (
    <>
      <button
        type="button"
        className="pm-region-row"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-label={`Region: ${region || 'ikke valgt'}. Skift region`}
      >
        <span className="pm-region-row-text">
          <span className="pm-region-row-title">{region || 'Vælg region'}</span>
          {neighbours.length > 0 ? (
            <span className="pm-region-row-sub">+ nabo-regioner: {neighbours.join(', ')}</span>
          ) : null}
        </span>
        <ChevronRight size={18} aria-hidden className="pm-region-row-chevron" />
      </button>

      <ChatActionSheet open={open} title="Vælg region" onClose={() => setOpen(false)}>
        {sheetHint ? <p className="pm-region-sheet-hint">{sheetHint}</p> : null}
        {APP_REGIONS.map((r) => {
          const active = r === region;
          return (
            <button
              key={r}
              type="button"
              className={`pm-region-sheet-option${active ? ' pm-region-sheet-option--active' : ''}`}
              aria-pressed={active}
              onClick={() => {
                onChange(r);
                setOpen(false);
              }}
            >
              <span>{r}</span>
              {active ? <Check size={18} aria-hidden /> : null}
            </button>
          );
        })}
      </ChatActionSheet>
    </>
  );
}
