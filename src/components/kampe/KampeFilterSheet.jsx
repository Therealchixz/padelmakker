import { useMemo } from 'react';
import {
  KAMPE_LIST_REGION_OPTIONS,
  KAMPE_LIST_ELO_BANDS,
  normalizeKampeListFilter,
  defaultKampeListFilter,
} from '../../lib/kampeListFilterCore';
import { useBottomSheetDragToClose } from '../../lib/useBottomSheetDragToClose';
import { theme } from '../../lib/platformTheme';

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
  myElo = null,
  resultCount,
  format = 'padel',
  showRegionFilter = true,
  showEloFilter = true,
}) {
  const { sheetRef, dragZoneProps, sheetStyle, sheetClassName } = useBottomSheetDragToClose({
    onClose,
    enabled: open,
  });

  const filter = useMemo(() => normalizeKampeListFilter(listFilter), [listFilter]);

  const resultLabel =
    format === 'padel'
      ? `${resultCount ?? 0} kampe`
      : format === 'americano'
        ? `${resultCount ?? 0} turneringer`
        : `${resultCount ?? 0} ligaer`;

  const setRegion = (regionId) => {
    onListFilterChange?.({ ...filter, regionId });
  };

  const setEloBand = (eloBandId) => {
    onListFilterChange?.({ ...filter, eloBandId: filter.eloBandId === eloBandId ? '' : eloBandId });
  };

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
            <div className="pm-kampe-v2-sheet-label">ELO-niveau</div>
            {myElo != null ? (
              <p className="pm-kampe-v2-sheet-copy" style={{ marginTop: 0, marginBottom: 10 }}>
                Din ELO <strong>{Math.round(Number(myElo) || 1000)}</strong> — vælg hvor tæt kampe skal matche dit niveau.
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
              Viser kampe hvor kampens ELO-interval overlapper dit valgte spænd.
            </p>
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
