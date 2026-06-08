import { useMemo } from 'react';
import {
  KAMPE_LIST_REGION_OPTIONS,
  KAMPE_LIST_ELO_BANDS,
  normalizeKampeListFilter,
} from '../../lib/kampeListFilterCore';
import { useBottomSheetDragToClose } from '../../lib/useBottomSheetDragToClose';

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
      ? `${resultCount ?? 0} kampe matcher`
      : format === 'americano'
        ? `${resultCount ?? 0} turneringer matcher`
        : `${resultCount ?? 0} ligaer matcher`;

  const setRegion = (regionId) => {
    onListFilterChange?.({ ...filter, regionId });
  };

  const setEloBand = (eloBandId) => {
    onListFilterChange?.({ ...filter, eloBandId: filter.eloBandId === eloBandId ? '' : eloBandId });
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
              <div className="pm-kampe-v2-sheet-title">Filter</div>
              {resultCount != null ? (
                <div className="pm-kampe-v2-sheet-sub">{resultLabel}</div>
              ) : null}
            </div>
            <button
              type="button"
              className="pm-kampe-v2-sheet-apply"
              onClick={onClose}
              onPointerDown={(event) => event.stopPropagation()}
            >
              Anvend
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
      </div>
    </>
  );
}
