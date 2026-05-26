import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../lib/AuthContext';
import { seekingVisibleDurationLabel } from '../../lib/platformConstants';
import {
  normalizeMatchSearchPrefs,
  describeMatchFilter,
  resolveFilterRegion,
  buildProfilePatchFromMatchSearchPrefs,
} from '../../lib/matchSearchFilterUtils';
import { notifyMakkerWatchersForProfile } from '../../lib/makkerWatchUtils';
import { isSeekingActiveProfile } from '../../lib/makkerSearchFilterCore';
import { isProfileMatchFeedVisible } from '../../lib/seekingFeedTtl';
import { btn } from '../../lib/platformTheme';
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
  resultCount,
  showSeekingToggle = true,
  showMatchFilterSection = true,
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
  const info = useMemo(() => describeMatchFilter(prefs, user), [prefs, user]);
  const feedVisibleNow = isProfileMatchFeedVisible(user);
  const regionOk = Boolean(resolveFilterRegion(prefs, user) || prefs.region);
  const durationLabel = seekingVisibleDurationLabel('kamp');

  const openFilterPage = () => {
    navigate('/dashboard/kamp-filter', { state: { filterReturnTo: FILTER_RETURN_KAMPE } });
    onClose?.();
  };

  const handleToggleFeed = async (nextVisible) => {
    if (toggling) return;
    if (nextVisible && !regionOk) {
      showToast('Vælg region under Mit kamp-filter først.');
      openFilterPage();
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

  if (!open) return null;

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
        <div {...dragZoneProps}>
          <div className="pm-kampe-v2-sheet-handle" />
        </div>
        <div className="pm-kampe-v2-sheet-head">
          <div>
            <div className="pm-kampe-v2-sheet-title">Filter</div>
            {resultCount != null ? (
              <div className="pm-kampe-v2-sheet-sub">{resultCount} kampe matcher</div>
            ) : null}
          </div>
          <button type="button" className="pm-kampe-v2-sheet-apply" onClick={onClose}>
            Anvend
          </button>
        </div>

        <div className="pm-kampe-v2-sheet-section">
          <div className="pm-kampe-v2-sheet-label">Visning</div>
          <div className="pm-kampe-v2-sheet-pills">
            <button
              type="button"
              className={`pm-kampe-v2-sheet-pill${scope === 'alle' ? ' pm-kampe-v2-sheet-pill--active' : ''}`}
              onClick={() => onScopeChange('alle')}
            >
              Alle kampe
            </button>
            <button
              type="button"
              className={`pm-kampe-v2-sheet-pill${scope === 'mine' ? ' pm-kampe-v2-sheet-pill--active' : ''}`}
              onClick={() => onScopeChange('mine')}
            >
              Kun mine kampe
            </button>
          </div>
        </div>

        {showMatchFilterSection ? (
          <div className="pm-kampe-v2-sheet-section">
            <div className="pm-kampe-v2-sheet-label">Mit kamp-filter</div>
            <p className="pm-kampe-v2-sheet-copy">{info.configured ? info.summary : info.detail}</p>
            <button type="button" onClick={openFilterPage} style={{ ...btn(false), width: '100%', marginTop: 8, fontSize: 13 }}>
              Rediger region og ELO ›
            </button>
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
      </div>
    </>
  );
}
