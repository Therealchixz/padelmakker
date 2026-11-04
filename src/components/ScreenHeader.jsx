import { useEffect, useState } from 'react';
import { NotificationBell } from './NotificationBell';

const MOBILE_QUERY = '(max-width: 768px)';

function useIsMobileView() {
  const [mobile, setMobile] = useState(() =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia(MOBILE_QUERY).matches
      : false,
  );
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined;
    const mq = window.matchMedia(MOBILE_QUERY);
    const onChange = () => setMobile(mq.matches);
    onChange();
    mq.addEventListener?.('change', onChange);
    return () => mq.removeEventListener?.('change', onChange);
  }, []);
  return mobile;
}

/**
 * Fælles toplinje for appens hovedsider (Hjem, Makkere, Baner, Kampe, Rangliste,
 * Beskeder, Min profil). Ejeren 4. nov. 2026: "Én fælles toplinje" — før havde
 * hver fane sin egen titel med forskellig størrelse, afstand og placering.
 *
 * - Titlen er sidens <h1>, så skærmlæsere kan hoppe til den.
 * - Sidens egne knapper står til højre (`actions`).
 * - På mobil står notifikationsklokken altid yderst til højre. På computer ligger
 *   den i den øverste bjælke ved navnet, så den vises ikke her.
 * - Undersider med tilbage-pil (Notifikationer, filtre, opret kamp) har deres
 *   egen `pm-subpage-head` og bruger ikke denne.
 */
export function ScreenHeader({ title, leading = null, actions = null, showBell = true, bellTourForceOpen = false, className = '' }) {
  const isMobile = useIsMobileView();
  const bell = showBell && isMobile;
  return (
    <header className={`pm-screen-header${className ? ` ${className}` : ''}`}>
      {leading ? <div className="pm-screen-header-leading">{leading}</div> : null}
      <h1 className="pm-screen-header-title">{title}</h1>
      {actions || bell ? (
        <div className="pm-screen-header-actions">
          {actions}
          {bell ? <NotificationBell tourForceOpen={bellTourForceOpen} /> : null}
        </div>
      ) : null}
    </header>
  );
}
