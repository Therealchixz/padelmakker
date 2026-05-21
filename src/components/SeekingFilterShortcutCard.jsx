import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { theme } from '../lib/platformTheme';
import { seekingVisibleDurationLabel } from '../lib/platformConstants';
import {
  normalizeMatchSearchPrefs,
  describeMatchFilter,
  resolveFilterRegion,
  buildProfilePatchFromMatchSearchPrefs,
} from '../lib/matchSearchFilterUtils';
import {
  normalizeMakkerSearchPrefs,
  describeMakkerFilter,
  resolveMakkerFilterRegion,
  buildProfilePatchFromMakkerSearchPrefs,
} from '../lib/makkerSearchFilterUtils';
import { notifyMakkerWatchersForProfile } from '../lib/makkerWatchUtils';
import { isSeekingActiveProfile } from '../lib/makkerSearchFilterCore';
import {
  isProfileMatchFeedVisible,
  isProfileMakkerFeedVisible,
} from '../lib/seekingFeedTtl';
import { ChevronRight, Filter, Users } from 'lucide-react';

/**
 * @param {'kamp' | 'makker'} channel
 * @param {object} user
 * @param {(msg: string) => void} showToast
 * @param {string} returnTo — filterReturnNavigation path
 */
export function SeekingFilterShortcutCard({ channel, user, showToast, returnTo }) {
  const navigate = useNavigate();
  const { updateProfile } = useAuth();
  const [toggling, setToggling] = useState(false);

  const isKamp = channel === 'kamp';
  const prefs = useMemo(
    () =>
      isKamp
        ? normalizeMatchSearchPrefs(user?.match_search_prefs, user)
        : normalizeMakkerSearchPrefs(user?.makker_search_prefs, user),
    [isKamp, user],
  );
  const info = useMemo(
    () => (isKamp ? describeMatchFilter(prefs, user) : describeMakkerFilter(prefs, user)),
    [isKamp, prefs, user],
  );
  const feedVisibleNow = isKamp
    ? isProfileMatchFeedVisible(user)
    : isProfileMakkerFeedVisible(user);
  const regionOk = isKamp
    ? Boolean(resolveFilterRegion(prefs, user) || prefs.region)
    : Boolean(resolveMakkerFilterRegion(prefs, user) || prefs.region);

  const filterPath = isKamp ? '/dashboard/kamp-filter' : '/dashboard/makker-filter';
  const filterLabel = isKamp ? 'Mit kamp-filter' : 'Mit makker-filter';
  const durationLabel = seekingVisibleDurationLabel(isKamp ? 'kamp' : 'makker');
  const Icon = isKamp ? Filter : Users;

  const openFilter = () => {
    navigate(filterPath, { state: { filterReturnTo: returnTo } });
  };

  const handleToggleFeed = async (e) => {
    e.stopPropagation();
    if (toggling) return;
    const nextVisible = !prefs.feedVisible;
    if (nextVisible && !regionOk) {
      showToast(`Vælg region under ${filterLabel} først.`);
      openFilter();
      return;
    }
    setToggling(true);
    try {
      const wasSeeking = isSeekingActiveProfile(user) || user?.seeking_match === true;
      const nextPrefs = { ...prefs, feedVisible: nextVisible };
      const patch = isKamp
        ? buildProfilePatchFromMatchSearchPrefs(nextPrefs, user)
        : buildProfilePatchFromMakkerSearchPrefs(nextPrefs, user);
      await updateProfile(patch);
      if (patch.seeking_match && !wasSeeking && user?.id) {
        void notifyMakkerWatchersForProfile(user.id);
      }
      showToast(nextVisible ? `Du vises nu som søger ${isKamp ? 'kamp' : 'makker'}` : 'Synlighed slået fra');
    } catch (err) {
      console.warn('toggle seeking feed:', err?.message || err);
      showToast('Kunne ikke opdatere. Prøv igen.');
    } finally {
      setToggling(false);
    }
  };

  return (
    <div
      style={{
        background: theme.surfaceAlt,
        border: `1px solid ${feedVisibleNow ? theme.accent + '55' : theme.border}`,
        borderRadius: 10,
        padding: '12px 14px',
        marginBottom: 16,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <span
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            background: feedVisibleNow ? theme.accentBg : theme.blueBg,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Icon size={18} color={theme.accent} aria-hidden />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: theme.text }}>
              {isKamp ? 'Søger kamp' : 'Søger makker'}
            </span>
            {feedVisibleNow ? (
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: 100,
                  background: theme.accentBg,
                  color: theme.accent,
                }}
              >
                Synlig
              </span>
            ) : null}
          </div>
          <p style={{ fontSize: 11, color: theme.textMid, lineHeight: 1.45, margin: '4px 0 0' }}>
            {feedVisibleNow
              ? `Du vises i ${isKamp ? 'aktivitetsfeed' : 'Find makker'} i ${durationLabel}.`
              : info.configured
                ? `Slå synlighed til for at blive fundet (${durationLabel}).`
                : info.detail}
          </p>
          {isKamp ? (
            <p style={{ fontSize: 10, color: theme.textLight, lineHeight: 1.4, margin: '6px 0 0' }}>
              Ikke det samme som «Råb op» på en enkelt kamp.
            </p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={handleToggleFeed}
          disabled={toggling}
          aria-pressed={prefs.feedVisible}
          aria-label={prefs.feedVisible ? 'Skjul søger-synlighed' : 'Vis at jeg søger'}
          style={{
            width: 44,
            height: 24,
            borderRadius: 12,
            border: 'none',
            cursor: toggling ? 'wait' : 'pointer',
            background: prefs.feedVisible ? theme.accent : theme.border,
            position: 'relative',
            flexShrink: 0,
            opacity: toggling ? 0.6 : 1,
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: 3,
              left: prefs.feedVisible ? 23 : 3,
              width: 18,
              height: 18,
              borderRadius: '50%',
              background: '#fff',
              transition: 'left 0.2s',
              boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
            }}
          />
        </button>
      </div>
      <button
        type="button"
        onClick={openFilter}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          marginTop: 10,
          padding: '8px 10px',
          background: theme.surface,
          border: `1px solid ${theme.border}`,
          borderRadius: 8,
          cursor: 'pointer',
          fontFamily: 'inherit',
          textAlign: 'left',
        }}
      >
        <span style={{ fontSize: 12, fontWeight: 600, color: theme.textMid }}>{filterLabel}</span>
        <ChevronRight size={16} color={theme.textLight} aria-hidden />
      </button>
    </div>
  );
}
