import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { theme, btn } from '../lib/platformTheme';
import { seekingVisibleDurationLabel } from '../lib/platformConstants';
import {
  normalizeMatchSearchPrefs,
  describeMatchFilter,
  buildProfilePatchFromMatchSearchPrefs,
} from '../lib/matchSearchFilterUtils';
import {
  normalizeMakkerSearchPrefs,
  describeMakkerFilter,
  buildProfilePatchFromMakkerSearchPrefs,
} from '../lib/makkerSearchFilterUtils';
import { notifyMakkerWatchersForProfile } from '../lib/makkerWatchUtils';
import { isSeekingActiveProfile } from '../lib/makkerSearchFilterCore';
import {
  buildEnableVisibilityPatch,
  hasDiscoveryRegion,
  isChannelVisible,
} from '../lib/discoveryVisibility';
import { ChevronRight, Filter, Users, Search } from 'lucide-react';

/**
 * @param {'kamp' | 'makker'} channel
 * @param {object} user
 * @param {(msg: string) => void} showToast
 * @param {string} returnTo — filterReturnNavigation path
 * @param {() => void} [onBrowse]
 */
export function SeekingFilterShortcutCard({ channel, user, showToast, returnTo, onBrowse }) {
  const navigate = useNavigate();
  const { updateProfile } = useAuth();
  const [busy, setBusy] = useState(false);

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
  const feedVisibleNow = isChannelVisible(user, isKamp ? 'kamp' : 'makker');
  const regionOk = hasDiscoveryRegion(user, isKamp ? 'kamp' : 'makker');

  const filterPath = isKamp ? '/dashboard/kamp-filter' : '/dashboard/makker-filter';
  const filterLabel = isKamp ? 'Mit kamp-filter' : 'Mit makker-filter';
  const durationLabel = seekingVisibleDurationLabel(isKamp ? 'kamp' : 'makker');
  const Icon = isKamp ? Filter : Users;
  const seekLabel = isKamp ? 'kamp' : 'makker';
  const browseLabel = isKamp ? 'Se åbne kampe' : 'Se alle spillere';

  const openFilter = () => {
    navigate(filterPath, { state: { filterReturnTo: returnTo } });
  };

  const setVisibility = async (nextVisible) => {
    if (busy) return;
    if (nextVisible && !regionOk) {
      showToast(`Vælg region under ${filterLabel} først.`);
      openFilter();
      return;
    }
    setBusy(true);
    try {
      const wasSeeking = isSeekingActiveProfile(user) || user?.seeking_match === true;
      let patch;
      if (nextVisible) {
        patch = buildEnableVisibilityPatch(user, isKamp ? 'kamp' : 'makker');
      } else {
        const nextPrefs = { ...prefs, feedVisible: false };
        patch = isKamp
          ? buildProfilePatchFromMatchSearchPrefs(nextPrefs, user)
          : buildProfilePatchFromMakkerSearchPrefs(nextPrefs, user);
      }
      await updateProfile(patch);
      if (patch.seeking_match && !wasSeeking && user?.id) {
        void notifyMakkerWatchersForProfile(user.id);
      }
      showToast(
        nextVisible
          ? `Du vises nu som søger ${seekLabel} i ${durationLabel}`
          : 'Synlighed slået fra',
      );
    } catch (err) {
      console.warn('toggle seeking feed:', err?.message || err);
      showToast('Kunne ikke opdatere. Prøv igen.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      style={{
        background: theme.surface,
        border: `1px solid ${feedVisibleNow ? theme.accent + '55' : theme.border}`,
        borderRadius: 12,
        padding: '14px',
        marginBottom: 16,
        boxShadow: theme.shadow,
      }}
    >
      <div
        style={{
          background: feedVisibleNow ? theme.accentBg : theme.warmBg,
          border: `1px solid ${feedVisibleNow ? theme.accent + '44' : theme.warningBorder}`,
          borderRadius: 10,
          padding: '12px 14px',
          marginBottom: 12,
        }}
      >
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <span
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: theme.surface,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
            aria-hidden
          >
            <Icon size={18} color={feedVisibleNow ? theme.accent : theme.warm} />
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: theme.text, marginBottom: 4 }}>
              {feedVisibleNow ? `Du er synlig som søger ${seekLabel}` : `Bliv fundet — søger ${seekLabel}`}
            </div>
            <p style={{ fontSize: 11, color: theme.textMid, lineHeight: 1.45, margin: 0 }}>
              {feedVisibleNow
                ? `Andre kan se dig i ${durationLabel}. Slå fra når du er i mål.`
                : 'Uden synlighed kan andre ikke finde dig — du forbliver usynlig i feedet.'}
            </p>
            {feedVisibleNow ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => void setVisibility(false)}
                style={{
                  ...btn(false),
                  marginTop: 10,
                  fontSize: 12,
                  padding: '7px 12px',
                  opacity: busy ? 0.7 : 1,
                }}
              >
                {busy ? 'Gemmer…' : 'Skjul mig'}
              </button>
            ) : (
              <button
                type="button"
                disabled={busy}
                onClick={() => void setVisibility(true)}
                style={{
                  ...btn(true),
                  marginTop: 10,
                  fontSize: 12,
                  padding: '8px 14px',
                  opacity: busy ? 0.7 : 1,
                }}
              >
                {busy ? 'Gemmer…' : `Gør mig synlig (${durationLabel})`}
              </button>
            )}
          </div>
        </div>
      </div>

      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          color: theme.textLight,
          textTransform: 'uppercase',
          letterSpacing: '0.07em',
          marginBottom: 8,
        }}
      >
        Eller find selv
      </div>
      <button
        type="button"
        onClick={() => {
          if (onBrowse) onBrowse();
          else if (isKamp) navigate('/dashboard/kampe');
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          width: '100%',
          padding: '10px 12px',
          background: theme.surfaceAlt,
          border: `1px solid ${theme.border}`,
          borderRadius: 8,
          cursor: 'pointer',
          fontFamily: 'inherit',
          textAlign: 'left',
          marginBottom: 8,
        }}
      >
        <Search size={16} color={theme.accent} aria-hidden />
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'block', fontSize: 13, fontWeight: 700, color: theme.text }}>{browseLabel}</span>
          <span style={{ display: 'block', fontSize: 11, color: theme.textMid, marginTop: 2 }}>
            {isKamp ? 'Gennemse og tilmeld dig åbne kampe' : 'Søg og filtrér spillere i din region'}
          </span>
        </span>
        <ChevronRight size={16} color={theme.textLight} aria-hidden />
      </button>

      <button
        type="button"
        onClick={openFilter}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          padding: '8px 10px',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          fontFamily: 'inherit',
          textAlign: 'left',
        }}
      >
        <span style={{ fontSize: 12, fontWeight: 600, color: theme.textMid }}>
          {filterLabel}
          {info.configured ? '' : ' · ikke sat op'}
        </span>
        <ChevronRight size={16} color={theme.textLight} aria-hidden />
      </button>
    </div>
  );
}
