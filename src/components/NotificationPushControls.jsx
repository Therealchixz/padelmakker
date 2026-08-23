import { useEffect, useRef, useState } from 'react';
import { font, theme } from '../lib/platformTheme';
import {
  isPushSupported,
  getPushPermission,
  subscribeToPush,
  unsubscribeFromPush,
  isPushSubscribed,
} from '../lib/pushNotifications';
import { createNotification } from '../lib/notifications';
import { normalizeNotificationPrefs } from '../lib/notificationPreferences';
import {
  dismissIosInstallHint,
  shouldExplainIosPushRequiresHomeScreen,
  shouldShowIosInstallHint,
} from '../lib/iosInstallPrompt';

/**
 * Aktiver / Slå fra / Test for lock-screen push.
 * Bruges både i desktop-dropdown og på mobil-siden /dashboard/notifikationer.
 */
export function NotificationPushControls({
  userId,
  notificationPrefs,
  variant = 'dropdown',
  onAfterTest,
}) {
  const isPage = variant === 'page';
  const [pushSupported, setPushSupported] = useState(() => isPushSupported());
  const [pushSubscribed, setPushSubscribed] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);
  const [pushTestLoading, setPushTestLoading] = useState(false);
  const [pushMessage, setPushMessage] = useState(null);
  const [pushBlocked, setPushBlocked] = useState(() => {
    try { return localStorage.getItem('pm_push_blocked') === '1'; } catch { return false; }
  });
  const [showIosInstallHint, setShowIosInstallHint] = useState(() => (
    isPage
      ? shouldExplainIosPushRequiresHomeScreen()
      : shouldShowIosInstallHint()
  ));
  const [permission, setPermission] = useState(() => {
    try { return getPushPermission(); } catch { return 'default'; }
  });
  const messageTimerRef = useRef(null);

  useEffect(() => {
    setPushSupported(isPushSupported());
    setShowIosInstallHint(
      isPage
        ? shouldExplainIosPushRequiresHomeScreen()
        : shouldShowIosInstallHint(),
    );
    try { setPermission(getPushPermission()); } catch { /* ignore */ }
    if (!isPushSupported()) return;
    isPushSubscribed().then(setPushSubscribed);
  }, [userId, isPage]);

  const showPushMessage = (msg) => {
    if (messageTimerRef.current) clearTimeout(messageTimerRef.current);
    setPushMessage(msg);
    messageTimerRef.current = setTimeout(() => {
      setPushMessage(null);
      messageTimerRef.current = null;
    }, 3000);
  };

  useEffect(() => () => {
    if (messageTimerRef.current) clearTimeout(messageTimerRef.current);
  }, []);

  const handleEnablePush = async () => {
    if (!userId || pushLoading) return;
    setPushLoading(true);
    try {
      const result = await subscribeToPush(userId);
      const subscribed = await isPushSubscribed();
      setPushSubscribed(subscribed);
      try { setPermission(getPushPermission()); } catch { /* ignore */ }
      if (subscribed) {
        showPushMessage('Push-beskeder aktiveret!');
      } else if (result === 'denied') {
        showPushMessage('Tilladelse afvist — tjek telefonens indstillinger');
      } else if (result === 'blocked') {
        try { localStorage.setItem('pm_push_blocked', '1'); } catch { /* ignore */ }
        setPushBlocked(true);
      } else if (result === 'timeout') {
        showPushMessage('Timeout — prøv igen');
      } else if (result === 'db_error') {
        showPushMessage('Push aktiveret i browser, men kunne ikke gemmes — prøv igen');
      } else {
        showPushMessage('Kunne ikke aktivere — prøv igen');
      }
    } finally {
      setPushLoading(false);
    }
  };

  const handleDisablePush = async () => {
    if (pushLoading) return;
    setPushLoading(true);
    try {
      await unsubscribeFromPush();
      setPushSubscribed(false);
      showPushMessage('Push-beskeder slået fra');
    } finally {
      setPushLoading(false);
    }
  };

  const handleRetryBlocked = () => {
    try { localStorage.removeItem('pm_push_blocked'); } catch { /* ignore */ }
    setPushBlocked(false);
  };

  const handleSendPushTest = async () => {
    if (!userId || pushTestLoading) return;
    setPushTestLoading(true);
    try {
      const sentAt = new Date().toLocaleTimeString('da-DK', {
        hour: '2-digit',
        minute: '2-digit',
      });
      const prefs = normalizeNotificationPrefs(notificationPrefs);
      const notifyError = await createNotification(
        userId,
        'match_invite',
        'Test-notifikation fra PadelMakker',
        `Push virker. Test sendt kl. ${sentAt}.`,
        null,
        {
          notificationPrefs: prefs,
          pushPolicy: {
            channel: 'system',
            level: 'critical',
            silent: false,
            urgency: 'high',
            cooldownSeconds: 0,
            aggregate: false,
            renotify: true,
          },
        },
      );
      if (notifyError) {
        showPushMessage('Test fejlede — prøv igen');
        return;
      }
      showPushMessage('Test sendt — tjek lock screen nu');
      onAfterTest?.();
    } finally {
      setPushTestLoading(false);
    }
  };

  const pad = isPage ? '14px 16px' : '10px 14px';
  const actionBtn = (primary) => ({
    background: primary ? theme.accent : theme.surface,
    color: primary ? theme.onAccent : theme.textMid,
    border: primary ? 'none' : '1px solid ' + theme.border,
    borderRadius: isPage ? 10 : 6,
    padding: isPage ? '10px 14px' : '5px 10px',
    fontSize: isPage ? 13 : 11,
    fontWeight: 700,
    cursor: (pushLoading || pushTestLoading) ? 'default' : 'pointer',
    opacity: (pushLoading || pushTestLoading) ? 0.6 : 1,
    whiteSpace: 'nowrap',
    fontFamily: font,
    minHeight: isPage ? 44 : undefined,
  });

  const hintBox = (emoji, children, onDismiss) => (
    <div
      className="pm-push-controls-hint"
      style={{
        padding: pad,
        borderBottom: '1px solid ' + theme.border,
        background: theme.warmBg + '40',
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
      }}
    >
      <span style={{ fontSize: 16 }} aria-hidden>{emoji}</span>
      <span style={{ flex: 1, fontSize: isPage ? 13 : 12, color: theme.textMid, lineHeight: 1.45 }}>
        {children}
      </span>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          style={{ background: 'transparent', border: 'none', color: theme.textLight, fontSize: 16, lineHeight: 1, cursor: 'pointer', padding: 0, fontFamily: font }}
          aria-label="Luk"
        >
          ×
        </button>
      )}
    </div>
  );

  return (
    <div className={`pm-push-controls pm-push-controls--${variant}`}>
      {showIosInstallHint && hintBox(
        '📲',
        <>
          Vil du have notifikationer på iPhone? Tryk på <strong>Del</strong>-ikonet
          nederst og vælg <strong>“Føj til hjemmeskærm”</strong>. Åbn derefter
          PadelMakker fra hjemmeskærmen — så vises <strong>Aktiver</strong> og{' '}
          <strong>Slå fra</strong> her.
        </>,
        isPage ? null : () => { dismissIosInstallHint(); setShowIosInstallHint(false); },
      )}

      {pushBlocked && hintBox(
        '🔕',
        <>
          Push er blokeret i denne browser.{' '}
          <button
            type="button"
            onClick={handleRetryBlocked}
            style={{ background: 'none', border: 'none', padding: 0, color: theme.accent, fontWeight: 700, cursor: 'pointer', fontFamily: font, fontSize: 'inherit' }}
          >
            Prøv igen
          </button>
        </>,
      )}

      {pushSupported && !pushBlocked && permission === 'denied' && hintBox(
        '🔕',
        <>
          Notifikationer er slået fra i telefonens indstillinger. Åbn{' '}
          <strong>Indstillinger → PadelMakker → Notifikationer</strong> og slå dem til.
        </>,
      )}

      {pushSupported && !pushBlocked && permission !== 'denied' && (
        <div
          style={{
            padding: pad,
            borderBottom: '1px solid ' + theme.border,
            background: pushSubscribed ? theme.accentBg + '30' : theme.warmBg + '40',
            display: 'flex',
            alignItems: isPage ? 'flex-start' : 'center',
            flexDirection: isPage ? 'column' : 'row',
            gap: isPage ? 12 : 10,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, flex: 1, minWidth: 0 }}>
            <span style={{ fontSize: 16 }} aria-hidden>{pushSubscribed ? '🔔' : '🔕'}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: isPage ? 13 : 12, fontWeight: 700, color: theme.text, lineHeight: 1.35 }}>
                {pushSubscribed ? 'Push-beskeder er aktiveret' : 'Få push-beskeder på telefonen'}
              </div>
              <div style={{ fontSize: isPage ? 12 : 11, color: theme.textMid, lineHeight: 1.4, marginTop: 2 }}>
                {pushMessage || (pushSubscribed
                  ? 'Du kan slå dem fra her, hvis du ikke vil have lock-screen-beskeder.'
                  : 'Virker også når appen er lukket.')}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: isPage ? '100%' : undefined }}>
            {pushSubscribed && (
              <button
                type="button"
                onClick={handleSendPushTest}
                disabled={pushLoading || pushTestLoading}
                style={{ ...actionBtn(false), flex: isPage ? 1 : undefined }}
              >
                {pushTestLoading ? '...' : 'Test'}
              </button>
            )}
            <button
              type="button"
              onClick={pushSubscribed ? handleDisablePush : handleEnablePush}
              disabled={pushLoading || pushTestLoading}
              style={{ ...actionBtn(!pushSubscribed), flex: isPage ? 1 : undefined }}
            >
              {pushLoading ? '…' : pushSubscribed ? 'Slå fra' : 'Aktiver'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
