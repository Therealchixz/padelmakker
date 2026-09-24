import { useMemo } from 'react';
import {
  KAMPE_LIST_REGION_OPTIONS,
  KAMPE_LIST_ELO_BANDS,
  normalizeKampeListFilter,
  defaultKampeListFilter,
} from '../../lib/kampeListFilterCore';
import { useBottomSheetDragToClose } from '../../lib/useBottomSheetDragToClose';
import { formatPlaytomicLevel } from '../../lib/padelLevelUtils';

import { COURT_FACILITY_CATALOG } from '../../lib/courtFacilities.jsx';

function FilterToggle({ checked, onChange, label }) {
  return (
    <div className="pm-kampe-v2-filter-toggle-row">
      <span className="pm-kampe-v2-filter-toggle-label">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`pm-kampe-v2-filter-toggle${checked ? ' pm-kampe-v2-filter-toggle--on' : ''}`}
      >
        <span className="pm-kampe-v2-filter-toggle-thumb" />
      </button>
    </div>
  );
}

export function KampeFilterSheet({
  open,
  onClose,
  scope,
  onScopeChange,
  listFilter,
  onListFilterChange,
  myLevel = null,
  resultCount,
  format = 'padel',
  showRegionFilter = true,
  showEloFilter = true,
  facilityOptions = [],
}) {
  const { sheetRef, dragZoneProps, sheetStyle, sheetClassName } = useBottomSheetDragToClose({
    onClose,
    enabled: open,
  });

  const filter = useMemo(() => normalizeKampeListFilter(listFilter), [listFilter]);

  const n = resultCount ?? 0;
  const resultLabel =
    format === 'padel'
      ? `${n} ${n === 1 ? 'kamp' : 'kampe'}`
      : format === 'americano'
        ? `${n} ${n === 1 ? 'turnering' : 'turneringer'}`
        : `${n} ${n === 1 ? 'liga' : 'ligaer'}`;

  const setRegion = (regionId) => {
    onListFilterChange?.({ ...filter, regionId });
  };

  const setEloBand = (eloBandId) => {
    onListFilterChange?.({ ...filter, eloBandId: filter.eloBandId === eloBandId ? '' : eloBandId });
  };

  const toggleFacility = (key) => {
    const current = Array.isArray(filter.facilities) ? filter.facilities : [];
    const next = current.includes(key) ? current.filter((f) => f !== key) : [...current, key];
    onListFilterChange?.({ ...filter, facilities: next });
  };

  const facilityChips = COURT_FACILITY_CATALOG.filter((f) => facilityOptions.includes(f.key));

  const handleReset = () => {
    const def = defaultKampeListFilter();
    onListFilterChange?.(def);
    if (scope !== 'alle') onScopeChange?.('alle');
  };

  if (!open) return null;

  const scopeAllLabel =
    format === 'americano' ? 'Alle turneringer' : format === 'liga' ? 'Alle ligaer' : 'Alle kampe';
  const scopeMineLabel =
    format === 'americano'
      ? 'Kun mine turneringer'
      : format === 'liga'
        ? 'Kun mine ligaer'
        : 'Kun mine kampe';

  return (
    <>
      <button
        type="button"
        className="pm-kampe-v2-sheet-backdrop"
        aria-label="Luk filter"
        onClick={onClose}
      />
      <div
        ref={sheetRef}
        className={`pm-kampe-v2-sheet${sheetClassName ? ` ${sheetClassName}` : ''}`}
        style={sheetStyle}
        role="dialog"
        aria-modal="true"
        aria-label="Filtrer kampe"
      >
        <div {...dragZoneProps} aria-label="Træk her for at lukke">
          <div className="pm-kampe-v2-sheet-handle" aria-hidden />
          <div className="pm-kampe-v2-sheet-head">
            <div>
              <div className="pm-kampe-v2-sheet-title">Filtrér kampe</div>
              {resultCount != null ? (
                <div className="pm-kampe-v2-sheet-sub">{resultLabel} matcher</div>
              ) : null}
            </div>
            <button
              type="button"
              className="pm-kampe-v2-filter-reset"
              onClick={handleReset}
              onPointerDown={(event) => event.stopPropagation()}
            >
              Nulstil
            </button>
          </div>
        </div>

        <div className="pm-kampe-v2-sheet-section">
          <div className="pm-kampe-v2-sheet-label">Visning</div>
          <div className="pm-kampe-v2-sheet-pills">
            <button
              type="button"
              className={`pm-kampe-v2-sheet-pill${scope === 'alle' ? ' pm-kampe-v2-sheet-pill--active' : ''}`}
              onClick={() => onScopeChange('alle')}
            >
              {scopeAllLabel}
            </button>
            <button
              type="button"
              className={`pm-kampe-v2-sheet-pill${scope === 'mine' ? ' pm-kampe-v2-sheet-pill--active' : ''}`}
              onClick={() => onScopeChange('mine')}
            >
              {scopeMineLabel}
            </button>
          </div>
        </div>

        {showRegionFilter ? (
          <div className="pm-kampe-v2-sheet-section">
            <div className="pm-kampe-v2-sheet-label">Region</div>
            <div className="pm-kampe-v2-sheet-pills">
              {KAMPE_LIST_REGION_OPTIONS.map((opt) => (
                <button
                  key={opt.id || 'alle'}
                  type="button"
                  className={`pm-kampe-v2-sheet-pill${filter.regionId === opt.id ? ' pm-kampe-v2-sheet-pill--active' : ''}`}
                  onClick={() => setRegion(opt.id)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <p className="pm-kampe-v2-sheet-copy">
              {format === 'americano'
                ? 'Med valgt bane filtreres efter centerets region — ellers efter opretterens profil-region.'
                : format === 'liga'
                  ? 'Vis ligaer oprettet af spillere i den valgte region.'
                  : 'Med valgt bane filtreres efter centerets region — uden bane bruges opretterens profil-region.'}
            </p>
          </div>
        ) : null}

        {showEloFilter ? (
          <div className="pm-kampe-v2-sheet-section">
            <div className="pm-kampe-v2-sheet-label">Niveau</div>
            {myLevel != null ? (
              <p className="pm-kampe-v2-sheet-copy" style={{ marginTop: 0, marginBottom: 10 }}>
                Dit niveau er <strong>{formatPlaytomicLevel(myLevel)}</strong>. Vælg hvor tæt kampene skal være på det.
              </p>
            ) : null}
            <div className="pm-kampe-v2-sheet-pills">
              {KAMPE_LIST_ELO_BANDS.map((band) => (
                <button
                  key={band.id || 'alle'}
                  type="button"
                  className={`pm-kampe-v2-sheet-pill${filter.eloBandId === band.id ? ' pm-kampe-v2-sheet-pill--active' : ''}`}
                  onClick={() => setEloBand(band.id)}
                >
                  {band.label}
                </button>
              ))}
            </div>
            <p className="pm-kampe-v2-sheet-copy">
              Viser kampe, hvis niveau overlapper dit valgte spænd.
            </p>
          </div>
        ) : null}

        {format === 'padel' && facilityChips.length > 0 ? (
          <div className="pm-kampe-v2-sheet-section">
            <div className="pm-kampe-v2-sheet-label">Faciliteter på banen</div>
            <div className="pm-kampe-v2-sheet-pills">
              {facilityChips.map(({ key, label, Icon }) => {
                const active = (filter.facilities || []).includes(key);
                return (
                  <button
                    key={key}
                    type="button"
                    className={`pm-kampe-v2-sheet-pill${active ? ' pm-kampe-v2-sheet-pill--active' : ''}`}
                    onClick={() => toggleFacility(key)}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                  >
                    <Icon size={14} strokeWidth={2} aria-hidden />
                    {label}
                  </button>
                );
              })}
            </div>
            <p className="pm-kampe-v2-sheet-copy">Viser kun kampe på centre med de valgte faciliteter.</p>
          </div>
        ) : null}

        {format === 'padel' ? (
          <div className="pm-kampe-v2-sheet-section">
            <div className="pm-kampe-v2-sheet-label">Præferencer</div>
            <FilterToggle
              checked={filter.onlyOpen}
              onChange={(v) => onListFilterChange?.({ ...filter, onlyOpen: v })}
              label="Kun kampe med ledige pladser"
            />
            <FilterToggle
              checked={filter.onlyBooked}
              onChange={(v) => onListFilterChange?.({ ...filter, onlyBooked: v })}
              label="Kun kampe med booket bane"
            />
          </div>
        ) : null}

        <div className="pm-kampe-v2-sheet-section" style={{ paddingBottom: 8 }}>
          <button
            type="button"
            className="pm-kampe-v2-filter-apply-btn"
            onClick={onClose}
          >
            {resultCount != null ? `Vis ${resultLabel}` : 'Anvend filter'}
          </button>
        </div>
      </div>
    </>
  );
}
