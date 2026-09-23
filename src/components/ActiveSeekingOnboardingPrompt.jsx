import { useState } from 'react';
import { useAuth } from '../lib/AuthContext';
import { btn } from '../lib/platformTheme';
import { regionDisplayLabel } from '../lib/appRegions';
import { notifyMakkerWatchersForProfile, makkerMatchToast } from '../lib/makkerWatchUtils';
import { isProfileMakkerFeedVisible } from '../lib/seekingFeedTtl';
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
  if (isCombinedSeekingEnabled(user, 'makker')) return false;
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
 * Én gang efter onboarding: tilbud om at blive synlig som makker.
 * `deferred` holder den tilbage, mens velkomst/rundvisning kører, så nye
 * brugere ikke får flere vinduer oven i hinanden.
 */
export function ActiveSeekingOnboardingPrompt({ user, showToast, deferred = false }) {
  const { updateProfile } = useAuth();
  const [open, setOpen] = useState(() => shouldOffer(user));
  const [busy, setBusy] = useState(false);

  if (!open || !showToast || deferred) return null;

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
      // Kun makker: kampe klares af "Jeg vil spille" og besked om nye kampe,
      // som er slået til som standard.
      const wasMakkerOn = isProfileMakkerFeedVisible(user);
      await updateProfile(buildSeekingProfilePatch(user, 'makker', true));
      if (!wasMakkerOn && user?.id) {
        const res = await notifyMakkerWatchersForProfile(user.id);
        const matchMsg = makkerMatchToast(res.matches);
        showToast(matchMsg || 'Du er nu synlig som makker');
      } else {
        showToast('Du er nu synlig som makker');
      }
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
    <AppModal open={open} onClose={handleNo} ariaLabel="Synlig som makker" maxWidthPreset="md">
      <div className="pm-modal-body pm-modal-body--compact pm-active-seeking-onboarding">
        <div className="pm-active-seeking-onboarding__icon" aria-hidden>
          <Bell size={22} strokeWidth={2} />
        </div>
        <h2 className="pm-active-seeking-onboarding__title">
          Søger du en fast makker?
        </h2>
        <p className="pm-active-seeking-onboarding__lead pm-active-seeking-onboarding__lead--tight">
          Bliv synlig som makker i{' '}
          <span className="pm-active-seeking-onboarding__region">{regionLabel}</span>:
        </p>
        <ul className="pm-active-seeking-onboarding__list">
          <li>Andre spillere kan se dig under Find makker.</li>
          <li>Du får besked, når en spiller på dit niveau også søger.</li>
        </ul>
        <p className="pm-active-seeking-onboarding__note">
          Du kan slå det fra igen under Makkere.
        </p>
        <div className="pm-active-seeking-onboarding__actions">
          <button
            type="button"
            disabled={busy}
            onClick={() => void handleYes()}
            style={{ ...btn(true), width: '100%', justifyContent: 'center', opacity: busy ? 0.7 : 1 }}
          >
            {busy ? 'Aktiverer…' : 'Ja, vis mig som makker'}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={handleNo}
            style={{ ...btn(false), width: '100%', justifyContent: 'center' }}
          >
            Nej tak
          </button>
        </div>
      </div>
    </AppModal>
  );
}
