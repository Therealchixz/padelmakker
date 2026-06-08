/** @typedef {{ position: string; top: string; left: string; right: string; width: string; overflow: string; bodyBg: string; htmlBg: string; }} MobileChatViewportSnapshot */

/** Under denne højde antages tastaturet at være åbent (ios-chat-mønster). */
export const MOBILE_CHAT_KEYBOARD_VV_HEIGHT = 600;

/**
 * Fjern CSS-variabler fra mobil-chat viewport-tilpasning.
 * @param {HTMLElement} [root]
 */
export function clearMobileChatViewportCssVars(root = document.documentElement) {
  root.style.removeProperty('--vvh');
  root.style.removeProperty('--vv-top');
  root.style.removeProperty('--vvs');
}

/**
 * Gendan body/html efter mobil-chat-lås.
 * @param {MobileChatViewportSnapshot} snapshot
 * @param {HTMLElement} [root]
 * @param {HTMLElement} [body]
 */
export function restoreMobileChatViewportSnapshot(
  snapshot,
  root = document.documentElement,
  body = document.body,
) {
  body.style.position = snapshot.position;
  body.style.top = snapshot.top;
  body.style.left = snapshot.left;
  body.style.right = snapshot.right;
  body.style.width = snapshot.width;
  body.style.overflow = snapshot.overflow;
  body.style.background = snapshot.bodyBg;
  root.style.background = snapshot.htmlBg;
  clearMobileChatViewportCssVars(root);
}

/**
 * @param {HTMLElement} [root]
 * @param {HTMLElement} [body]
 * @returns {MobileChatViewportSnapshot}
 */
export function captureMobileChatViewportSnapshot(
  root = document.documentElement,
  body = document.body,
) {
  return {
    position: body.style.position,
    top: body.style.top,
    left: body.style.left,
    right: body.style.right,
    width: body.style.width,
    overflow: body.style.overflow,
    bodyBg: body.style.background,
    htmlBg: root.style.background,
  };
}

/**
 * Synkronisér --vvh / --vvs fra visualViewport (ios-chat / PWA-mønster).
 * @param {HTMLElement} [root]
 * @param {VisualViewport | null | undefined} [vv]
 */
export function syncMobileChatViewportVars(
  root = document.documentElement,
  vv = typeof window !== 'undefined' ? window.visualViewport : null,
) {
  if (!vv) return;
  root.style.setProperty('--vvh', `${vv.height}px`);
  root.style.setProperty('--vv-top', `${vv.offsetTop}px`);
  root.style.setProperty(
    '--vvs',
    vv.height < MOBILE_CHAT_KEYBOARD_VV_HEIGHT ? '0px' : 'env(safe-area-inset-bottom)',
  );
}

let mobileChatViewportBound = false;
/** @type {(() => void) | null} */
let mobileChatViewportSyncHandler = null;

/**
 * Lyt på visualViewport under aktiv mobil-chat.
 * @param {HTMLElement} [root]
 * @returns {() => void}
 */
export function bindMobileChatViewportSync(root = document.documentElement) {
  if (typeof window === 'undefined' || mobileChatViewportBound) {
    return () => {};
  }
  const vv = window.visualViewport;
  if (!vv) return () => {};

  mobileChatViewportSyncHandler = () => syncMobileChatViewportVars(root, vv);
  vv.addEventListener('resize', mobileChatViewportSyncHandler);
  vv.addEventListener('scroll', mobileChatViewportSyncHandler);
  mobileChatViewportSyncHandler();
  mobileChatViewportBound = true;

  return () => {
    if (!mobileChatViewportSyncHandler) return;
    vv.removeEventListener('resize', mobileChatViewportSyncHandler);
    vv.removeEventListener('scroll', mobileChatViewportSyncHandler);
    mobileChatViewportSyncHandler = null;
    mobileChatViewportBound = false;
    clearMobileChatViewportCssVars(root);
  };
}

/**
 * Fjern eventuelle rester fra ældre chat-viewport-lås (body position:fixed).
 * @param {HTMLElement} [root]
 * @param {HTMLElement} [body]
 */
export function clearStaleMobileChatViewportLock(
  root = document.documentElement,
  body = document.body,
) {
  clearMobileChatViewportCssVars(root);
  if (body.style.position === 'fixed') {
    body.style.position = '';
    body.style.top = '';
    body.style.left = '';
    body.style.right = '';
    body.style.width = '';
    body.style.overflow = '';
    body.style.background = '';
    root.style.background = '';
  }
}

/**
 * iOS kan efter tastatur efterlade scroll-offset → hul under fixed bundmenu.
 * Nulstil scroll og layout-viewport efter chat lukkes.
 */
export function settleMobileViewportAfterChat() {
  if (typeof window === 'undefined') return;
  clearStaleMobileChatViewportLock();
  document.body.classList.remove('pm-body--mobile-chat');

  const reset = () => {
    window.scrollTo(0, 0);
    const vv = window.visualViewport;
    if (vv && vv.offsetTop > 0) {
      window.scrollTo(0, window.scrollY + vv.offsetTop);
    }
  };

  reset();
  requestAnimationFrame(() => {
    reset();
    requestAnimationFrame(reset);
  });
}
