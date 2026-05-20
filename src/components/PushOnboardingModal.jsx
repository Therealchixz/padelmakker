import { useState } from 'react';
import { AppModal } from './AppModal';
import { theme, btn, font } from '../lib/platformTheme';
import {
  getPushPermission,
  isPushSupported,
  isPushSubscribed,
  subscribeToPush,
} from '../lib/pushNotifications';
import {
  markPushOnboardingDismissed,
  markPushPermanentlyBlocked,
} from '../lib/pushOnboardingStorage';

/**
 * Dedikeret push-opt-in efter tour / for tilbagevendende brugere uden subscription.
 */
export function PushOnboardingModal({ open, onClose, userId, showToast }) {
  const [loading, setLoading] = useState(false);

  const handleDismiss = () => {
    if (userId) markPushOnboardingDismissed(userId);
    onClose?.();
  };

  const handleEnable = async () => {
    if (!userId || loading) return;
    setLoading(true);
    try {
      const result = await subscribeToPush(userId);
      const subscribed = await isPushSubscribed();
      if (subscribed) {
        showToast?.('Push-beskeder er aktiveret');
        onClose?.({ subscribed: true });
        return;
      }
      if (result === 'denied') {
        markPushPermanentlyBlocked();
        showToast?.('Tilladelse afvist — du kan ændre det i browserindstillinger');
        onClose?.({ denied: true });
        return;
      }
      if (result === 'blocked') {
        markPushPermanentlyBlocked();
        showToast?.('Browseren blokerer push — tjek indstillinger');
        onClose?.({ blocked: true });
        return;
      }
      if (result === 'timeout') {
        showToast?.('Timeout — prøv igen via klokken');
      } else {
        showToast?.('Kunne ikke aktivere — prøv igen via klokken');
      }
      handleDismiss();
    } finally {
      setLoading(false);
    }
  };

  if (!isPushSupported()) return null;

  const permission = getPushPermission();

  return (
    <AppModal
      open={open}
      onClose={handleDismiss}
      ariaLabel="Aktiver push-beskeder"
      maxWidth="420px"
      zIndex={10050}
    >
      <div style={{ padding: '22px 20px 18px', fontFamily: font }}>
        <div style={{ fontSize: '28px', marginBottom: '10px' }} aria-hidden>
          🔔
        </div>
        <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: theme.text }}>
          Få besked om kampe og invitationer
        </h2>
        <p style={{ margin: '10px 0 0', fontSize: '14px', color: theme.textMid, lineHeight: 1.55 }}>
          Vi anbefaler push, så du ikke misser når en kamp bliver fuld, du bliver inviteret, eller et
          resultat skal bekræftes — også når PadelMakker ikke er åben.
        </p>
        <p style={{ margin: '10px 0 0', fontSize: '12px', color: theme.textLight, lineHeight: 1.5 }}>
          Du får altid beskeder i appen under klokken. Push er ekstra uden for appen og kan slås fra
          når som helst under Push-kanaler.
        </p>
        {permission === 'denied' && (
          <p style={{ margin: '12px 0 0', fontSize: '12px', color: theme.red, lineHeight: 1.45 }}>
            Browseren har blokeret notifikationer. Åbn sideindstillinger og tillad notifikationer for
            at aktivere push.
          </p>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '20px' }}>
          <button
            type="button"
            disabled={loading || permission === 'denied'}
            onClick={handleEnable}
            style={{
              ...btn(true),
              width: '100%',
              justifyContent: 'center',
              opacity: loading || permission === 'denied' ? 0.65 : 1,
            }}
          >
            {loading ? 'Aktiverer…' : 'Aktiver push-beskeder'}
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={handleDismiss}
            style={{
              ...btn(false),
              width: '100%',
              justifyContent: 'center',
              background: 'transparent',
              border: '1px solid ' + theme.border,
              color: theme.textMid,
            }}
          >
            Ikke nu
          </button>
        </div>
      </div>
    </AppModal>
  );
}
