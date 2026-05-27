import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../lib/AuthContext';
import { seekingVisibleDurationLabel } from '../../lib/platformConstants';
import {
  normalizeMatchSearchPrefs,
  buildProfilePatchFromMatchSearchPrefs,
} from '../../lib/matchSearchFilterUtils';
import { notifyMakkerWatchersForProfile } from '../../lib/makkerWatchUtils';
import { isSeekingActiveProfile } from '../../lib/makkerSearchFilterCore';
import { isProfileMatchFeedVisible } from '../../lib/seekingFeedTtl';
import { resolveFilterRegion } from '../../lib/matchSearchFilterCore';
import {
  KAMPE_LIST_REGION_OPTIONS,
  KAMPE_LIST_ELO_BANDS,
  normalizeKampeListFilter,
} from '../../lib/kampeListFilterCore';
import { FILTER_RETURN_KAMPE } from '../../lib/filterReturnNavigation';
import { useBottomSheetDragToClose } from '../../lib/useBottomSheetDragToClose';

function ToggleSwitch({ checked, onChange, disabled, ariaLabel }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`pm-kampe-v2-toggle${checked ? ' pm-kampe-v2-toggle--on' : ''}`}
    >
      <span className="pm-kampe-v2-toggle-knob" />
    </button>
  );
}

export function KampeFilterSheet({
  open,
  onClose,
  user,
  showToast,
  scope,
  onScopeChange,
  listFilter,
  onListFilterChange,
  resultCount,
  format = 'padel',
  showSeekingToggle = true,
  showRegionFilter = true,
  showEloFilter = true,
}) {
  const navigate = useNavigate();
  const { updateProfile } = useAuth();
  const [toggling, setToggling] = useState(false);
  const { sheetRef, dragZoneProps, sheetStyle, sheetClassName } = useBottomSheetDragToClose({
    onClose,
    enabled: open,
  });

  const prefs = useMemo(
    () => normalizeMatchSearchPrefs(user?.match_search_prefs, user),
    [user],
  );
  const filter = useMemo(() => normalizeKampeListFilter(listFilter), [listFilter]);
  const feedVisibleNow = isProfileMatchFeedVisible(user);
  const regionOk = Boolean(resolveFilterRegion(prefs, user) || prefs.region);
  const durationLabel = seekingVisibleDurationLabel('kamp');

  const resultLabel =
    format === 'padel'
      ? `${resultCount ?? 0} kampe matcher`
      : format === 'americano'
        ? `${resultCount ?? 0} turneringer matcher`
        : `${resultCount ?? 0} ligaer matcher`;

  const openAdvancedFilterPage = () => {
    navigate('/dashboard/kamp-filter', { state: { filterReturnTo: FILTER_RETURN_KAMPE } });
    onClose?.();
  };

  const handleToggleFeed = async (nextVisible) => {
    if (toggling) return;
    if (nextVisible && !regionOk) {
      showToast('Vælg region på din profil under avanceret filter først.');
      openAdvancedFilterPage();
      return;
    }
    setToggling(true);
    try {
      const wasSeeking = isSeekingActiveProfile(user) || user?.seeking_match === true;
      const nextPrefs = { ...prefs, feedVisible: nextVisible };
      const patch = buildProfilePatchFromMatchSearchPrefs(nextPrefs, user);
      await updateProfile(patch);
      if (patch.seeking_match && !wasSeeking && user?.id) {
        void notifyMakkerWatchersForProfile(user.id);
      }
      showToast(nextVisible ? 'Du vises nu som søger kamp' : 'Synlighed slået fra');
    } catch (err) {
      console.warn('toggle seeking feed:', err?.message || err);
      showToast('Kunne ikke opdatere. Prøv igen.');
    } finally {
      setToggling(false);
    }
  };

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
                ? 'Vis turneringer fra oprettere i den valgte region.'
                : format === 'liga'
                  ? 'Vis ligaer oprettet af spillere i den valgte region.'
                  : 'Vis kampe fra spillere i den valgte region.'}
            </p>
          </div>
        ) : null}

        {showEloFilter ? (
          <div className="pm-kampe-v2-sheet-section">
            <div className="pm-kampe-v2-sheet-label">ELO-niveau</div>
            <div className="pm-kampe-v2-sheet-pills">
              {KAMPE_LIST_ELO_BANDS.filter((b) => b.id !== '').map((band) => (
                <button
                  key={band.id}
                  type="button"
                  className={`pm-kampe-v2-sheet-pill${filter.eloBandId === band.id ? ' pm-kampe-v2-sheet-pill--active' : ''}`}
                  onClick={() => setEloBand(band.id)}
                >
                  {band.label}
                </button>
              ))}
            </div>
            <p className="pm-kampe-v2-sheet-copy">Viser kampe der overlapper det valgte ELO-interval.</p>
          </div>
        ) : null}

        {showSeekingToggle ? (
          <div className="pm-kampe-v2-sheet-toggle-row">
            <div>
              <div className="pm-kampe-v2-sheet-toggle-title">Søger kamp</div>
              <div className="pm-kampe-v2-sheet-toggle-copy">
                {feedVisibleNow
                  ? `Synlig i ${durationLabel}.`
                  : `Vis andre at du er klar til at spille (${durationLabel}).`}
              </div>
            </div>
            <ToggleSwitch
              checked={prefs.feedVisible}
              onChange={handleToggleFeed}
              disabled={toggling}
              ariaLabel={prefs.feedVisible ? 'Skjul søger-synlighed' : 'Vis at jeg søger kamp'}
            />
          </div>
        ) : null}

        {showSeekingToggle ? (
          <div className="pm-kampe-v2-sheet-section" style={{ marginTop: 4 }}>
            <button
              type="button"
              className="pm-kampe-v2-sheet-advanced-link"
              onClick={openAdvancedFilterPage}
            >
              Notifikationer og avanceret filter ›
            </button>
          </div>
        ) : null}
      </div>
    </>
  );
}
