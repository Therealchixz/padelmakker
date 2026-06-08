import { useState } from 'react';
import { useAuth } from '../lib/AuthContext';
import { theme, btn } from '../lib/platformTheme';
import { regionDisplayLabel } from '../lib/appRegions';
import { notifyMakkerWatchersForProfile } from '../lib/makkerWatchUtils';
import { isSeekingActiveProfile } from '../lib/makkerSearchFilterCore';
import {
  isCombinedSeekingEnabled,
  buildSeekingProfilePatch,
  hasSeekingRegion,
} from '../lib/activeSeeking';
import { AppModal } from './AppModal';

const STORAGE_KEY = 'pm-active-seeking-onboarding-v1';

function shouldOffer(user) {
  try {
    if (localStorage.getItem(STORAGE_KEY) === '1') return false;
  } catch {
    return false;
  }
  if (!user?.id) return false;
  if (isCombinedSeekingEnabled(user, 'makker') || isCombinedSeekingEnabled(user, 'kamp')) return false;
  return true;
}

function dismiss() {
  try {
    localStorage.setItem(STORAGE_KEY, '1');
  } catch {
    /* ignore */
  }
}

/**
 * Én gang efter onboarding: tilbud om aktiv søgning for makker og kamp.
 */
export function ActiveSeekingOnboardingPrompt({ user, showToast }) {
  const { updateProfile } = useAuth();
  const [open, setOpen] = useState(() => shouldOffer(user));
  const [busy, setBusy] = useState(false);

  if (!open || !showToast) return null;

  const regionLabel = regionDisplayLabel(user?.area) || user?.area || 'dit område';
  const canEnable = hasSeekingRegion(user, 'makker') || Boolean(user?.area);

  const handleYes = async () => {
    if (!canEnable) {
      showToast('Vælg region på profilen først.');
      dismiss();
      setOpen(false);
      return;
    }
    setBusy(true);
    try {
      const wasSeeking = isSeekingActiveProfile(user) || user?.seeking_match === true;
      let patch = buildSeekingProfilePatch(user, 'makker', true);
      const kampPatch = buildSeekingProfilePatch(
        { ...user, ...patch },
        'kamp',
        true,
      );
      patch = { ...patch, ...kampPatch };
      await updateProfile(patch);
      if (patch.seeking_match && !wasSeeking && user?.id) {
        void notifyMakkerWatchersForProfile(user.id);
      }
      showToast('Aktiv søgning er slået til for makker og kamp');
    } catch (err) {
      console.warn('active seeking onboarding:', err?.message || err);
      showToast('Kunne ikke aktivere — prøv under Aktiv søgning');
    } finally {
      setBusy(false);
      dismiss();
      setOpen(false);
    }
  };

  const handleNo = () => {
    dismiss();
    setOpen(false);
  };

  return (
    <AppModal open={open} onClose={handleNo} ariaLabel="Aktiv søgning" maxWidthPreset="sm">
      <div style={{ padding: '4px 2px 8px' }}>
        <h2 style={{ fontSize: 18, fontWeight: 800, margin: '0 0 10px', color: theme.text }}>
          Vil du have besked om makker og kampe?
        </h2>
        <p style={{ fontSize: 14, color: theme.textMid, margin: '0 0 18px', lineHeight: 1.55 }}>
          Vi kan give dig besked når en padelmakker eller åben kamp passer dit niveau i{' '}
          <strong style={{ color: theme.text }}>{regionLabel}</strong>. Du bliver også synlig for andre
          spillere, der søger.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button
            type="button"
            disabled={busy}
            onClick={() => void handleYes()}
            style={{ ...btn(true), width: '100%', padding: '12px', opacity: busy ? 0.7 : 1 }}
          >
            {busy ? 'Aktiverer…' : 'Ja, giv mig besked'}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={handleNo}
            style={{ ...btn(false), width: '100%', padding: '12px' }}
          >
            Nej tak — senere
          </button>
        </div>
      </div>
    </AppModal>
  );
}
