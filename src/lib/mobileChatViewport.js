/** @typedef {{ position: string; top: string; left: string; right: string; width: string; overflow: string; bodyBg: string; htmlBg: string; }} MobileChatViewportSnapshot */

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
 * iOS kan efter tastatur + position:fixed efterlade et hul under bundnavigationen.
 * Nulstil scroll og layout-viewport efter chat lukkes.
 */
export function settleMobileViewportAfterChat() {
  if (typeof window === 'undefined') return;
  const main = document.querySelector('#pm-app-shell .pm-dash-main');
  const reset = () => {
    window.scrollTo(0, 0);
    if (main) main.scrollTop = 0;
  };
  reset();
  requestAnimationFrame(() => {
    reset();
    requestAnimationFrame(reset);
  });
}
