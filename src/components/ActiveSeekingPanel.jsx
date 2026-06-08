import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { theme, btn } from '../lib/platformTheme';
import { REGIONS } from '../lib/platformConstants';
import { notifyMakkerWatchersForProfile } from '../lib/makkerWatchUtils';
import { isSeekingActiveProfile } from '../lib/makkerSearchFilterCore';
import {
  isSeekingUiActive,
  isSeekingTtlExpired,
  describeActiveSeeking,
  buildSeekingProfilePatch,
  buildExpiredSeekingSyncPatch,
  hasSeekingRegion,
  seekingChannelLabel,
  seekingFilterPath,
  seekingVisibleDurationLabel,
  seekingHomeStatusLabel,
  formatSeekingTtlCountdown,
  seekingTtlRemainingMs,
} from '../lib/activeSeeking';
import {
  FILTER_RETURN_HJEM,
  FILTER_RETURN_MAKKERE,
  FILTER_RETURN_KAMPE,
} from '../lib/filterReturnNavigation';
import { AppModal } from './AppModal';
import { ChevronDown, Clock } from 'lucide-react';

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

function StatusDot({ active, expired }) {
  const color = active ? theme.accent : expired ? theme.warm : theme.textLight;
  return (
    <span
      aria-hidden
      style={{
        width: 8,
        height: 8,
        borderRadius: '50%',
        background: color,
        flexShrink: 0,
        boxShadow: active ? `0 0 0 3px ${theme.accentBg}` : 'none',
      }}
    />
  );
}

function SeekingTtlCountdown({ user, channel }) {
  const rem = seekingTtlRemainingMs(user, channel);
  const countdown = formatSeekingTtlCountdown(rem);

  if (!countdown.value) return null;

  return (
    <div className="pm-active-seeking-countdown" aria-label={countdown.ariaLabel}>
      <Clock size={11} className="pm-active-seeking-countdown__icon" aria-hidden />
      <span className="pm-active-seeking-countdown__value">{countdown.value}</span>
      <span className="pm-active-seeking-countdown__unit">{countdown.unit}</span>
    </div>
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
  const [homeExpanded, setHomeExpanded] = useState(false);
  const [ttlTick, setTtlTick] = useState(0);
  const expirySyncingRef = useRef(false);

  const displayUser = localUser ?? user;
  const expiredSyncPatch = useMemo(
    () => buildExpiredSeekingSyncPatch(displayUser),
    [displayUser],
  );

  useEffect(() => {
    setLocalUser(null);
  }, [user]);

  useEffect(() => {
    const id = window.setInterval(() => setTtlTick((t) => t + 1), 60_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    void ttlTick;
    if (!expiredSyncPatch || busyChannel || expirySyncingRef.current) return;
    expirySyncingRef.current = true;
    void updateProfile(expiredSyncPatch)
      .then(() => setLocalUser(null))
      .catch((err) => {
        console.warn('expire seeking sync:', err?.message || err);
      })
      .finally(() => {
        expirySyncingRef.current = false;
      });
  }, [expiredSyncPatch, busyChannel, updateProfile, ttlTick]);

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

  const homeOnline = useMemo(
    () => isSeekingUiActive(displayUser, 'makker') || isSeekingUiActive(displayUser, 'kamp'),
    [displayUser],
  );
  const homeExpired = useMemo(
    () => isSeekingTtlExpired(displayUser, 'makker') || isSeekingTtlExpired(displayUser, 'kamp'),
    [displayUser],
  );
  const homeStatus = useMemo(() => seekingHomeStatusLabel(displayUser), [displayUser]);

  const renderRow = (ch) => {
    const active = isSeekingUiActive(displayUser, ch);
    const expired = isSeekingTtlExpired(displayUser, ch);
    const desc = describeActiveSeeking(displayUser, ch);
    const busy = busyChannel === ch;

    if (variant === 'compact') {
      return (
        <div
          key={ch}
          className={`pm-active-seeking-row pm-active-seeking-row--compact${active ? ' pm-active-seeking-row--on' : ' pm-active-seeking-row--off'}`}
        >
          <div className="pm-active-seeking-row__main">
            <div className="pm-active-seeking-row__head">
              <span className="pm-active-seeking-row__title pm-active-seeking-row__title--inline">
                {seekingChannelLabel(ch)}
              </span>
              {active ? (
                <span className="pm-active-seeking-badge pm-active-seeking-badge--active">Aktiv</span>
              ) : expired ? (
                <span className="pm-active-seeking-badge pm-active-seeking-badge--expired">Udløbet</span>
              ) : null}
            </div>
            {active || expired ? (
              <>
                <p className="pm-active-seeking-filter">{desc.filterSummary}</p>
                {active ? <SeekingTtlCountdown user={displayUser} channel={ch} /> : null}
              </>
            ) : (
              <p className="pm-active-seeking-hint">Slå til for besked når der er match</p>
            )}
          </div>
          <ToggleSwitch
            checked={active}
            onChange={(on) => handleToggle(ch, on)}
            disabled={busy}
            ariaLabel={active ? `Slå ${seekingChannelLabel(ch)} fra` : `Slå ${seekingChannelLabel(ch)} til`}
          />
          <button
            type="button"
            onClick={() => openFilter(ch)}
            style={{
              ...btn(false),
              padding: '6px 10px',
              fontSize: 12,
              flexShrink: 0,
              background: theme.surface,
            }}
          >
            Juster
          </button>
        </div>
      );
    }

    return (
      <div key={ch} className="pm-active-seeking-row">
        <div className="pm-active-seeking-row__main">
          <div className="pm-active-seeking-row__head">
            <span className="pm-active-seeking-row__title">{seekingChannelLabel(ch)}</span>
            {active ? (
              <span className="pm-active-seeking-badge pm-active-seeking-badge--active">Aktiv</span>
            ) : expired ? (
              <span className="pm-active-seeking-badge pm-active-seeking-badge--expired">Udløbet</span>
            ) : null}
          </div>
          {active || expired ? (
            <>
              <p className="pm-active-seeking-filter">{desc.filterSummary}</p>
              {active ? <SeekingTtlCountdown user={displayUser} channel={ch} /> : null}
            </>
          ) : (
            <p className="pm-active-seeking-hint">
              Få besked og bliv synlig når der er match på dit niveau
            </p>
          )}
        </div>
        <ToggleSwitch
          checked={active}
          onChange={(on) => handleToggle(ch, on)}
          disabled={busy}
          ariaLabel={active ? `Slå ${seekingChannelLabel(ch)} fra` : `Slå ${seekingChannelLabel(ch)} til`}
        />
      </div>
    );
  };

  if (variant === 'compact') {
    return (
      <div className="pm-active-seeking-panel">
        {channels.map(renderRow)}
        <AppModal
          open={regionModal != null}
          onClose={() => setRegionModal(null)}
          ariaLabel="Vælg region"
          maxWidthPreset="sm"
        >
          {regionModalContent(regionModal, busyChannel, persistSeeking)}
        </AppModal>
      </div>
    );
  }

  return (
    <div className="pm-active-seeking-panel">
      <section
        style={{
          background: theme.surface,
          border: `1px solid ${theme.border}`,
          borderRadius: 12,
          marginBottom: 14,
          boxShadow: theme.shadow,
          overflow: 'hidden',
        }}
        aria-label="Aktiv søgning"
      >
        <button
          type="button"
          onClick={() => setHomeExpanded((v) => !v)}
          aria-expanded={homeExpanded}
          className={`pm-active-seeking-home-toggle${homeOnline ? ' pm-active-seeking-home-toggle--on' : ' pm-active-seeking-home-toggle--off'}`}
        >
          <StatusDot active={homeOnline} expired={!homeOnline && homeExpired} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="pm-active-seeking-home-kicker">Aktiv søgning</div>
            <div className="pm-active-seeking-home-status">{homeStatus}</div>
          </div>
          <span
            className={`pm-active-seeking-home-online${homeOnline ? ' pm-active-seeking-home-online--on' : ' pm-active-seeking-home-online--off'}`}
          >
            {homeOnline ? 'Online' : 'Offline'}
          </span>
          <ChevronDown
            size={18}
            aria-hidden
            style={{
              flexShrink: 0,
              color: theme.textMid,
              transform: homeExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.2s',
            }}
          />
        </button>

        {homeExpanded ? (
          <div className="pm-active-seeking-home-body">
            <p className="pm-active-seeking-home-intro">
              Makker og kamp har hver sin switch — synlighed og notifikationer slås til sammen. Juster
              kriterier under Find makker og Kampe.
            </p>
            {channels.map(renderRow)}
          </div>
        ) : null}
      </section>

      <AppModal
        open={regionModal != null}
        onClose={() => setRegionModal(null)}
        ariaLabel="Vælg region"
        maxWidthPreset="sm"
      >
        {regionModalContent(regionModal, busyChannel, persistSeeking)}
      </AppModal>
    </div>
  );
}

function regionModalContent(regionModal, busyChannel, persistSeeking) {
  return (
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
  );
}
