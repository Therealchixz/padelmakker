import { useLayoutEffect } from 'react';
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
export function MobileChatOverlay({ header, footer, children }) {
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
    <div className="pm-mobile-chat-overlay" role="dialog" aria-modal="true" aria-label="Beskedtråd">
      <div className="pm-mobile-chat-screen">
        <header className="pm-mobile-chat-header">{header}</header>
        <main className="pm-mobile-chat-content">{children}</main>
        <footer className="pm-mobile-chat-footer">{footer}</footer>
      </div>
    </div>,
    document.body,
  );
}
