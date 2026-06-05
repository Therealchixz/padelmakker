/**
 * iOS-specifik hjælper.
 *
 * Web Push virker KUN i en installeret PWA på iOS 16.4+ — ikke i en almindelig
 * Safari-fane. Det betyder at `isPushSupported()` returnerer false på iPhone i
 * browseren, så push-banneret skjules helt, og brugeren får ingen forklaring.
 *
 * Disse helpers afgør om vi skal vise en "Føj til hjemmeskærm"-besked, så
 * iPhone-brugere forstår hvad de skal gøre for at kunne slå notifikationer til.
 */

const DISMISS_KEY = 'pm-ios-install-hint-dismissed';

/** Er enheden en iPhone/iPad/iPod? (iPadOS 13+ udgiver sig som Mac → tjek touch). */
export function isIosDevice() {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  if (/iPad|iPhone|iPod/.test(ua)) return true;
  // iPadOS rapporterer "MacIntel" men har touch-skærm
  return navigator.platform === 'MacIntel' && (navigator.maxTouchPoints || 0) > 1;
}

/** Kører appen som installeret PWA (lagt på hjemmeskærmen / standalone)? */
export function isInStandalone() {
  if (typeof window === 'undefined') return false;
  if (window.navigator && window.navigator.standalone === true) return true;
  try {
    return Boolean(window.matchMedia && window.matchMedia('(display-mode: standalone)').matches);
  } catch {
    return false;
  }
}

/** Har brugeren allerede afvist beskeden? */
export function isIosInstallHintDismissed() {
  try {
    return localStorage.getItem(DISMISS_KEY) === '1';
  } catch {
    return false;
  }
}

/** Husk at brugeren afviste beskeden (vises ikke igen). */
export function dismissIosInstallHint() {
  try {
    localStorage.setItem(DISMISS_KEY, '1');
  } catch {
    /* ignorer quota-fejl */
  }
}

/**
 * Vis "installér for notifikationer"-beskeden når:
 *   iOS-enhed + IKKE installeret som PWA + ikke allerede afvist.
 * (På en installeret PWA bliver PushManager tilgængelig, så beskeden er overflødig.)
 */
export function shouldShowIosInstallHint() {
  return isIosDevice() && !isInStandalone() && !isIosInstallHintDismissed();
}
