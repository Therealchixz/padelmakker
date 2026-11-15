import { useContext, useEffect, useState } from 'react';
import { MessageCircle } from 'lucide-react';
import { NotificationBell } from './NotificationBell';
import { MessagesShortcutContext } from '../lib/messagesShortcut';

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
 * - Besked-knappen staar paa alle hovedsider (H-designet), saa Beskeder altid er eet
 *   tryk vaek, selv om den ikke har sin egen plads i bundmenuen. Slaas fra med
 *   `showMessages={false}` (fx paa selve Beskeder-siden).
 * - Undersider med tilbage-pil (Notifikationer, filtre, opret kamp) har deres
 *   egen `pm-subpage-head` og bruger ikke denne.
 */
export function ScreenHeader({ title, leading = null, actions = null, showBell = true, showMessages = true, bellTourForceOpen = false, className = '' }) {
  const isMobile = useIsMobileView();
  const bell = showBell && isMobile;
  const messages = useContext(MessagesShortcutContext);
  const chat = showMessages && messages ? messages : null;
  const unread = chat ? Number(chat.unread) || 0 : 0;
  return (
    <header className={`pm-screen-header${className ? ` ${className}` : ''}`}>
      {leading ? <div className="pm-screen-header-leading">{leading}</div> : null}
      <h1 className="pm-screen-header-title">{title}</h1>
      {actions || bell || chat ? (
        <div className="pm-screen-header-actions">
          {actions}
          {chat ? (
            <button
              type="button"
              className="pm-header-chat-btn"
              onClick={chat.open}
              aria-label={unread > 0 ? `Beskeder, ${unread} ulæste` : 'Beskeder'}
            >
              <MessageCircle size={19} aria-hidden />
              {unread > 0 ? <span className="pm-header-chat-badge" aria-hidden>{unread > 9 ? '9+' : unread}</span> : null}
            </button>
          ) : null}
          {bell ? <NotificationBell tourForceOpen={bellTourForceOpen} /> : null}
        </div>
      ) : null}
    </header>
  );
}
