/** @typedef {{ position: string; top: string; left: string; right: string; width: string; overflow: string; bodyBg: string; htmlBg: string; }} MobileChatViewportSnapshot */

/** Under denne højde antages tastaturet at være åbent (ios-chat-mønster). */
export const MOBILE_CHAT_KEYBOARD_VV_HEIGHT = 600;

const SETTLE_DELAYS_MS = [0, 50, 120, 280, 500, 800, 1200];
const NUDGE_DELAYS_MS = [0, 80, 220, 480, 800];

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

let viewportBindCount = 0;
/** @type {(() => void) | null} */
let mobileChatViewportSyncHandler = null;
let lastVisualViewportHeight = 0;

let settleSeq = 0;
/** @type {ReturnType<typeof setTimeout>[]} */
let settleTimers = [];

/**
 * Nulstil dokument-scroll — iOS kan efter tastatur efterlade offsetTop.
 */
export function resetMobileDocumentScroll() {
  if (typeof window === 'undefined') return;
  window.scrollTo(0, 0);
  const vv = window.visualViewport;
  if (vv && vv.offsetTop > 0) {
    window.scrollTo(0, window.scrollY + vv.offsetTop);
  }
}

/**
 * Efter iOS-tastatur lukkes: gensynk --vvh/--vvs og nulstil dokument-scroll.
 * @param {HTMLElement} [root]
 */
export function nudgeMobileChatViewportAfterKeyboard(root = document.documentElement) {
  if (typeof window === 'undefined') return;
  const vv = window.visualViewport;
  if (!vv) return;

  const tick = () => {
    syncMobileChatViewportVars(root, vv);
    resetMobileDocumentScroll();
  };

  tick();
  if (typeof requestAnimationFrame === 'function') {
    requestAnimationFrame(tick);
  }
  NUDGE_DELAYS_MS.slice(1).forEach((ms) => {
    window.setTimeout(tick, ms);
  });
}

/**
 * Lyt på visualViewport under aktiv mobil-chat (reference-tælling ved hurtig åbn/luk).
 * @param {HTMLElement} [root]
 * @returns {() => void}
 */
export function bindMobileChatViewportSync(root = document.documentElement) {
  if (typeof window === 'undefined') return () => {};
  const vv = window.visualViewport;
  if (!vv) return () => {};

  viewportBindCount += 1;
  if (viewportBindCount === 1) {
    lastVisualViewportHeight = vv.height;
    mobileChatViewportSyncHandler = () => {
      const prev = lastVisualViewportHeight;
      lastVisualViewportHeight = vv.height;
      syncMobileChatViewportVars(root, vv);
      if (prev < MOBILE_CHAT_KEYBOARD_VV_HEIGHT && vv.height >= MOBILE_CHAT_KEYBOARD_VV_HEIGHT) {
        nudgeMobileChatViewportAfterKeyboard(root);
      }
    };
    vv.addEventListener('resize', mobileChatViewportSyncHandler);
    vv.addEventListener('scroll', mobileChatViewportSyncHandler);
    syncMobileChatViewportVars(root, vv);
    resetMobileDocumentScroll();
  }

  return () => {
    if (typeof window === 'undefined') return;
    viewportBindCount = Math.max(0, viewportBindCount - 1);
    if (viewportBindCount > 0) return;
    if (!mobileChatViewportSyncHandler) return;
    vv.removeEventListener('resize', mobileChatViewportSyncHandler);
    vv.removeEventListener('scroll', mobileChatViewportSyncHandler);
    mobileChatViewportSyncHandler = null;
    lastVisualViewportHeight = 0;
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
 * iOS kan efter tastatur efterlade scroll-offset → hul under input/menu.
 * Samler flere settle-kald til én sekvens (undgår race ved hurtig ind/ud af chat).
 */
export function settleMobileViewportAfterChat() {
  if (typeof window === 'undefined') return;
  settleSeq += 1;
  const seq = settleSeq;
  settleTimers.forEach((id) => window.clearTimeout(id));
  settleTimers = [];

  const tick = () => {
    if (seq !== settleSeq) return;
    clearStaleMobileChatViewportLock();
    document.body.classList.remove('pm-mobile-chat-overlay-open');
    nudgeMobileChatViewportAfterKeyboard();
  };

  SETTLE_DELAYS_MS.forEach((ms) => {
    if (ms === 0) {
      tick();
      return;
    }
    settleTimers.push(window.setTimeout(tick, ms));
  });
}

/**
 * Luk aktivt fokus (typisk tastatur) før overlay fjernes.
 */
export function blurActiveMobileChatFocus() {
  if (typeof document === 'undefined') return;
  const active = document.activeElement;
  if (active instanceof HTMLElement) {
    active.blur();
  }
}
