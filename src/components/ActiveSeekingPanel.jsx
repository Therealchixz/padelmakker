import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { theme, btn } from '../lib/platformTheme';
import { REGIONS } from '../lib/platformConstants';
import { notifyMakkerWatchersForProfile } from '../lib/makkerWatchUtils';
import { isSeekingActiveProfile } from '../lib/makkerSearchFilterCore';
import {
  isCombinedSeekingEnabled,
  isChannelFeedLive,
  describeActiveSeeking,
  buildSeekingProfilePatch,
  hasSeekingRegion,
  seekingChannelLabel,
  seekingFilterPath,
  seekingVisibleDurationLabel,
} from '../lib/activeSeeking';
import {
  FILTER_RETURN_HJEM,
  FILTER_RETURN_MAKKERE,
  FILTER_RETURN_KAMPE,
} from '../lib/filterReturnNavigation';
import { AppModal } from './AppModal';
import { ChevronRight } from 'lucide-react';

function ToggleSwitch({ checked, onChange, disabled, ariaLabel }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      style={{
        width: 44,
        height: 24,
        borderRadius: 12,
        border: 'none',
        cursor: disabled ? 'wait' : 'pointer',
        background: checked ? theme.accent : theme.border,
        position: 'relative',
        flexShrink: 0,
        opacity: disabled ? 0.6 : 1,
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: 3,
          left: checked ? 23 : 3,
          width: 18,
          height: 18,
          borderRadius: '50%',
          background: theme.surface,
          transition: 'left 0.2s',
          boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
        }}
      />
    </button>
  );
}

function mergeProfilePatch(user, patch) {
  if (!user || !patch) return user;
  return {
    ...user,
    ...patch,
    match_search_prefs: patch.match_search_prefs ?? user.match_search_prefs,
    makker_search_prefs: patch.makker_search_prefs ?? user.makker_search_prefs,
  };
}

/**
 * @param {object} props
 * @param {'home' | 'compact'} props.variant
 * @param {'makker' | 'kamp'} [props.channel] — påkrævet for compact
 * @param {object} props.user
 * @param {(msg: string) => void} props.showToast
 * @param {string} [props.filterReturnTo]
 */
export function ActiveSeekingPanel({
  variant = 'home',
  channel: channelProp,
  user,
  showToast,
  filterReturnTo,
}) {
  const navigate = useNavigate();
  const { updateProfile } = useAuth();
  const [localUser, setLocalUser] = useState(null);
  const [busyChannel, setBusyChannel] = useState(null);
  const [regionModal, setRegionModal] = useState(null);

  const displayUser = localUser ?? user;

  useEffect(() => {
    setLocalUser(null);
  }, [user]);

  const returnTo = filterReturnTo
    || (variant === 'compact' && channelProp === 'kamp' ? FILTER_RETURN_KAMPE : null)
    || (variant === 'compact' && channelProp === 'makker' ? FILTER_RETURN_MAKKERE : null)
    || FILTER_RETURN_HJEM;

  const openFilter = useCallback(
    (ch) => {
      navigate(seekingFilterPath(ch), { state: { filterReturnTo: returnTo } });
    },
    [navigate, returnTo],
  );

  const persistSeeking = useCallback(
    async (ch, enabled, regionOverride) => {
      setBusyChannel(ch);
      try {
        const wasSeeking = isSeekingActiveProfile(displayUser) || displayUser?.seeking_match === true;
        const patch = buildSeekingProfilePatch(displayUser, ch, enabled, regionOverride);
        const nextUser = mergeProfilePatch(displayUser, patch);
        setLocalUser(nextUser);
        await updateProfile(patch);
        if (enabled && ch === 'makker' && patch.seeking_match && !wasSeeking && displayUser?.id) {
          void notifyMakkerWatchersForProfile(displayUser.id);
        }
        const duration = seekingVisibleDurationLabel(ch);
        showToast(
          enabled
            ? `${seekingChannelLabel(ch)} aktiv — synlig og notifikationer i ${duration}`
            : `${seekingChannelLabel(ch)} slået fra`,
        );
      } catch (err) {
        setLocalUser(null);
        console.warn('active seeking toggle:', err?.message || err);
        showToast('Kunne ikke gemme. Prøv igen.');
      } finally {
        setBusyChannel(null);
        setRegionModal(null);
      }
    },
    [displayUser, showToast, updateProfile],
  );

  const handleToggle = useCallback(
    (ch, nextOn) => {
      if (busyChannel) return;
      if (!nextOn) {
        void persistSeeking(ch, false);
        return;
      }
      if (!hasSeekingRegion(displayUser, ch)) {
        setRegionModal(ch);
        return;
      }
      void persistSeeking(ch, true);
    },
    [busyChannel, displayUser, persistSeeking],
  );

  const channels = useMemo(() => {
    if (variant === 'compact' && channelProp) return [channelProp];
    return ['makker', 'kamp'];
  }, [variant, channelProp]);

  const renderRow = (ch) => {
    const enabled = isCombinedSeekingEnabled(displayUser, ch);
    const live = isChannelFeedLive(displayUser, ch);
    const desc = describeActiveSeeking(displayUser, ch);
    const busy = busyChannel === ch;

    if (variant === 'compact') {
      return (
        <div
          key={ch}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            flexWrap: 'wrap',
            marginBottom: 16,
            padding: '10px 12px',
            background: enabled ? theme.accentBg : theme.surfaceAlt,
            border: `1px solid ${enabled ? theme.accent + '44' : theme.border}`,
            borderRadius: 10,
            fontSize: 12,
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <span style={{ fontWeight: 700, color: theme.text }}>{seekingChannelLabel(ch)}: </span>
            <span style={{ color: enabled ? theme.textMid : theme.textLight }}>
              {enabled
                ? `${live ? 'Aktiv' : 'Tændt'} · ${desc.summary}${enabled ? ' · får besked' : ''}`
                : 'Slå til for besked når der er match'}
            </span>
          </div>
          <ToggleSwitch
            checked={enabled}
            onChange={(on) => handleToggle(ch, on)}
            disabled={busy}
            ariaLabel={enabled ? `Slå ${seekingChannelLabel(ch)} fra` : `Slå ${seekingChannelLabel(ch)} til`}
          />
          <button
            type="button"
            onClick={() => openFilter(ch)}
            style={{
              ...btn(false),
              padding: '6px 10px',
              fontSize: 11,
              flexShrink: 0,
            }}
          >
            Juster
          </button>
        </div>
      );
    }

    return (
      <div
        key={ch}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '10px 0',
          borderBottom: ch === 'makker' ? `1px solid ${theme.border}` : 'none',
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: theme.text }}>{seekingChannelLabel(ch)}</span>
            {enabled && live ? (
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
                Aktiv
              </span>
            ) : null}
          </div>
          <p style={{ fontSize: 11, color: theme.textMid, margin: '4px 0 0', lineHeight: 1.45 }}>
            {enabled ? desc.detail : 'Få besked og bliv synlig når der er match på dit niveau'}
          </p>
        </div>
        <ToggleSwitch
          checked={enabled}
          onChange={(on) => handleToggle(ch, on)}
          disabled={busy}
          ariaLabel={enabled ? `Slå ${seekingChannelLabel(ch)} fra` : `Slå ${seekingChannelLabel(ch)} til`}
        />
      </div>
    );
  };

  return (
    <>
      <section
        style={{
          background: theme.surface,
          border: `1px solid ${theme.border}`,
          borderRadius: 12,
          padding: variant === 'home' ? '14px 16px' : 0,
          marginBottom: variant === 'home' ? 14 : 0,
          boxShadow: variant === 'home' ? theme.shadow : 'none',
        }}
        aria-label="Aktiv søgning"
      >
        {variant === 'home' ? (
          <>
            <p
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: theme.textLight,
                textTransform: 'uppercase',
                letterSpacing: '0.07em',
                margin: '0 0 4px',
              }}
            >
              Aktiv søgning
            </p>
            <p style={{ fontSize: 12, color: theme.textMid, margin: '0 0 8px', lineHeight: 1.45 }}>
              Én switch slår synlighed og notifikationer til — som når du gemmer et søgefilter.
            </p>
          </>
        ) : null}

        {channels.map(renderRow)}

        {variant === 'home' ? (
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 8,
              marginTop: 12,
              paddingTop: 12,
              borderTop: `1px solid ${theme.border}`,
            }}
          >
            <button
              type="button"
              onClick={() => openFilter('makker')}
              style={{
                ...btn(false),
                flex: 1,
                minWidth: 120,
                fontSize: 12,
                padding: '8px 10px',
                justifyContent: 'space-between',
              }}
            >
              Juster makker-kriterier
              <ChevronRight size={14} aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => openFilter('kamp')}
              style={{
                ...btn(false),
                flex: 1,
                minWidth: 120,
                fontSize: 12,
                padding: '8px 10px',
                justifyContent: 'space-between',
              }}
            >
              Juster kamp-kriterier
              <ChevronRight size={14} aria-hidden />
            </button>
          </div>
        ) : null}
      </section>

      <AppModal
        open={regionModal != null}
        onClose={() => setRegionModal(null)}
        ariaLabel="Vælg region"
        maxWidthPreset="sm"
      >
        <div style={{ padding: '4px 2px 8px' }}>
          <h2 style={{ fontSize: 17, fontWeight: 800, margin: '0 0 8px', color: theme.text }}>
            Vælg region
          </h2>
          <p style={{ fontSize: 13, color: theme.textMid, margin: '0 0 16px', lineHeight: 1.5 }}>
            Vi bruger din region til at matche {regionModal === 'kamp' ? 'kampe' : 'makker'} og sende relevante
            notifikationer.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: '50vh', overflowY: 'auto' }}>
            {REGIONS.map((r) => (
              <button
                key={r}
                type="button"
                disabled={busyChannel != null}
                onClick={() => void persistSeeking(regionModal, true, r)}
                style={{ ...btn(false), textAlign: 'left', padding: '10px 14px', fontSize: 13 }}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
      </AppModal>
    </>
  );
}
