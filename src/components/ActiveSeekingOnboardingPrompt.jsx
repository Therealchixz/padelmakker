import { useState } from 'react';
import { useAuth } from '../lib/AuthContext';
import { btn } from '../lib/platformTheme';
import { regionDisplayLabel } from '../lib/appRegions';
import { notifyMakkerWatchersForProfile } from '../lib/makkerWatchUtils';
import { isSeekingActiveProfile } from '../lib/makkerSearchFilterCore';
import {
  isCombinedSeekingEnabled,
  buildSeekingProfilePatch,
  hasSeekingRegion,
} from '../lib/activeSeeking';
import { Bell } from 'lucide-react';
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
    <AppModal open={open} onClose={handleNo} ariaLabel="Aktiv søgning" maxWidthPreset="md">
      <div className="pm-modal-body pm-modal-body--compact pm-active-seeking-onboarding">
        <div className="pm-active-seeking-onboarding__icon" aria-hidden>
          <Bell size={22} strokeWidth={2} />
        </div>
        <h2 className="pm-active-seeking-onboarding__title">
          Vil du have besked om makker og kampe?
        </h2>
        <p className="pm-active-seeking-onboarding__lead">
          Få besked, når en padelmakker eller åben kamp matcher dit niveau i{' '}
          <span className="pm-active-seeking-onboarding__region">{regionLabel}</span>. Du bliver også
          synlig for andre spillere, der søger.
        </p>
        <div className="pm-active-seeking-onboarding__actions">
          <button
            type="button"
            disabled={busy}
            onClick={() => void handleYes()}
            style={{ ...btn(true), width: '100%', justifyContent: 'center', opacity: busy ? 0.7 : 1 }}
          >
            {busy ? 'Aktiverer…' : 'Ja, giv mig besked'}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={handleNo}
            style={{ ...btn(false), width: '100%', justifyContent: 'center' }}
          >
            Nej tak — senere
          </button>
        </div>
      </div>
    </AppModal>
  );
}
