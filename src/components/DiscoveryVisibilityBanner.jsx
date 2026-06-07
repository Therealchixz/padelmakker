import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, X } from 'lucide-react';
import { useAuth } from '../lib/AuthContext';
import { theme, btn } from '../lib/platformTheme';
import { notifyMakkerWatchersForProfile } from '../lib/makkerWatchUtils';
import { isSeekingActiveProfile } from '../lib/makkerSearchFilterCore';
import {
  buildEnableVisibilityPatch,
  hasDiscoveryRegion,
  isChannelVisible,
} from '../lib/discoveryVisibility';
import { seekingVisibleDurationLabel } from '../lib/platformConstants';

const DISMISS_KEY = 'pm-discovery-banner-dismiss-v1';

function readDismissed() {
  try {
    return localStorage.getItem(DISMISS_KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * Påmindelse på Hjem når brugeren ikke er synlig for andre.
 */
export function DiscoveryVisibilityBanner({ user, showToast }) {
  const navigate = useNavigate();
  const { updateProfile } = useAuth();
  const [dismissed, setDismissed] = useState(readDismissed);
  const [busy, setBusy] = useState(false);

  if (dismissed || isSeekingActiveProfile(user)) return null;

  const makkerVisible = isChannelVisible(user, 'makker');
  const kampVisible = isChannelVisible(user, 'kamp');
  const canEnableMakker = hasDiscoveryRegion(user, 'makker');
  const durationLabel = seekingVisibleDurationLabel('makker');

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      /* ignore */
    }
    setDismissed(true);
  };

  const enableMakkerVisibility = async () => {
    if (!canEnableMakker) {
      showToast('Vælg din region under Mit makker-filter først.');
      navigate('/dashboard/makker-filter', { state: { filterReturnTo: '/dashboard/hjem' } });
      return;
    }
    setBusy(true);
    try {
      const wasSeeking = isSeekingActiveProfile(user) || user?.seeking_match === true;
      const patch = buildEnableVisibilityPatch(user, 'makker');
      await updateProfile(patch);
      if (patch.seeking_match && !wasSeeking && user?.id) {
        void notifyMakkerWatchersForProfile(user.id);
      }
      showToast(`Du er nu synlig som makker-søgende i ${durationLabel}`);
    } catch (err) {
      console.warn('enable makker visibility:', err?.message || err);
      showToast('Kunne ikke opdatere. Prøv igen.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      style={{
        background: theme.warmBg,
        border: `1px solid ${theme.warningBorder}`,
        borderRadius: 12,
        padding: '14px 14px 12px',
        marginBottom: 14,
        position: 'relative',
      }}
      role="status"
    >
      <button
        type="button"
        onClick={dismiss}
        aria-label="Skjul påmindelse"
        style={{
          position: 'absolute',
          top: 10,
          right: 10,
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: theme.textLight,
          padding: 4,
        }}
      >
        <X size={16} aria-hidden />
      </button>
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', paddingRight: 24 }}>
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
          <Eye size={18} color={theme.warm} />
        </span>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: theme.text, marginBottom: 4 }}>
            Du er usynlig for andre spillere
          </div>
          <p style={{ fontSize: 12, color: theme.textMid, lineHeight: 1.5, margin: '0 0 12px' }}>
            {makkerVisible || kampVisible
              ? 'Én af dine synligheds-kanaler er slået fra. Tænd for begge for bedre match.'
              : 'Andre kan ikke se, at du søger makker eller kamp. Det gør det sværere at finde dig.'}
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <button
              type="button"
              disabled={busy}
              onClick={() => void enableMakkerVisibility()}
              style={{ ...btn(true), fontSize: 12, padding: '8px 14px', opacity: busy ? 0.7 : 1 }}
            >
              {busy ? 'Gemmer…' : 'Gør mig synlig som makker'}
            </button>
            <button
              type="button"
              onClick={() => navigate('/dashboard/makker-filter', { state: { filterReturnTo: '/dashboard/hjem' } })}
              style={{ ...btn(false), fontSize: 12, padding: '8px 14px' }}
            >
              Opsæt filter
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
