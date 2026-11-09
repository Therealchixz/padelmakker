import { useEffect, useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  bindMobileChatViewportSync,
  blurActiveMobileChatFocus,
  nudgeMobileChatViewportAfterKeyboard,
  setMobileChatBackgroundInert,
  settleMobileViewportAfterChat,
} from '../../lib/mobileChatViewport';

/**
 * Fuldskærms mobil-chat isoleret fra dashboard via portal.
 * Layout efter https://github.com/mattpilott/ios-chat (visualViewport + fixed footer).
 */
export function MobileChatOverlay({ header, footer, children, onClose = undefined }) {
  const overlayRef = useRef(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  // Skaermlaeser og tastatur: fokus flyttes ind i traaden (ikke i tekstfeltet, saa tastaturet
  // ikke springer op), Escape lukker, og fokus vender tilbage til raekken i indbakken.
  useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    overlayRef.current?.focus({ preventScroll: true });
    const onKeyDown = (e) => {
      if (e.key !== 'Escape' || !onCloseRef.current) return;
      e.preventDefault();
      onCloseRef.current();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      if (opener && document.contains(opener)) opener.focus({ preventScroll: true });
    };
  }, []);

  useLayoutEffect(() => {
    if (typeof document === 'undefined') return undefined;
    const body = document.body;
    body.classList.add('pm-mobile-chat-overlay-open');
    setMobileChatBackgroundInert(true);
    const unbindViewport = bindMobileChatViewportSync();
    nudgeMobileChatViewportAfterKeyboard();
    return () => {
      blurActiveMobileChatFocus();
      unbindViewport();
      setMobileChatBackgroundInert(false);
      body.classList.remove('pm-mobile-chat-overlay-open');
      settleMobileViewportAfterChat();
    };
  }, []);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div ref={overlayRef} tabIndex={-1} className="pm-mobile-chat-overlay" role="dialog" aria-modal="true" aria-label="Beskedtråd">
      <div className="pm-mobile-chat-screen">
        <header className="pm-mobile-chat-header">{header}</header>
        <main className="pm-mobile-chat-content">{children}</main>
        <footer className="pm-mobile-chat-footer">{footer}</footer>
      </div>
    </div>,
    document.body,
  );
}
