import { supabase } from './supabase';

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || '';

/** Konverter base64url-streng til Uint8Array (kræves af pushManager.subscribe) */
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

/** Er appen åbnet som installeret PWA (hjemmeskærm)? */
export function isStandalonePwa() {
  if (typeof window === 'undefined') return false;
  try {
    return (
      window.matchMedia('(display-mode: standalone)').matches
      || window.navigator.standalone === true
    );
  } catch {
    return false;
  }
}

/** Er push understøttet i denne browser? */
export function isPushSupported() {
  return (
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    Boolean(VAPID_PUBLIC_KEY)
  );
}

/** Kort forklaring når isPushSupported() er false (til UI-tekst). */
export function getPushUnsupportedHint() {
  if (typeof window === 'undefined') return '';
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    if (isStandalonePwa()) {
      return 'Push API mangler på denne enhed. Prøv at opdatere iOS/Android og genåbn appen fra hjemmeskærmen.';
    }
    return 'Åbn PadelMakker i Safari/Chrome eller som app på hjemmeskærmen (ikke via Instagram/Facebook).';
  }
  if (!VAPID_PUBLIC_KEY) {
    return 'Push er midlertidigt utilgængelig (manglende serverkonfiguration). In-app beskeder i klokken virker stadig.';
  }
  return 'Push er ikke tilgængelig her. Du får stadig beskeder i klokken.';
}

/** Hent nuværende push-tilladelse ('granted' | 'denied' | 'default') */
export function getPushPermission() {
  return Notification.permission;
}

/**
 * Tilmeld denne browser til push-notifikationer.
 * Returnerer 'granted' | 'denied' | 'blocked' | 'unsupported' | 'error' | 'timeout' | 'default'.
 * DB-gemning fejler stille — browser-subscription er sandheden.
 *
 * @param {string} userId
 * @param {{ requestPermission?: boolean }} [options]
 *   requestPermission=false: kun subscribe når Notification.permission allerede er 'granted'.
 */
export async function subscribeToPush(userId, options = {}) {
  if (!isPushSupported()) return 'unsupported';

  const requestPermission = options.requestPermission !== false;

  // 15 sek. timeout — forhindrer at requestPermission hænger i Brave/Firefox
  let timeoutId;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error('timeout')), 15000);
  });

  try {
    const registration = await navigator.serviceWorker.ready;

    let permission = getPushPermission();
    if (permission === 'default' && requestPermission) {
      permission = await Promise.race([
        Notification.requestPermission(),
        timeoutPromise,
      ]);
    }
    clearTimeout(timeoutId);

    if (permission !== 'granted') return permission; // 'denied' eller 'default'

    // Brave/Firefox kan blokere subscribe() selv efter permission er 'granted'
    let subscription;
    try {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
    } catch {
      return 'blocked'; // browser tillader notifikationer men blokerer push
    }

    // Gem i DB — fejl her blokerer ikke
    try {
      const { endpoint, keys } = subscription.toJSON();
      await supabase.from('push_subscriptions').upsert(
        { user_id: userId, endpoint, p256dh: keys.p256dh, auth: keys.auth },
        { onConflict: 'endpoint' }
      );
    } catch (dbErr) {
      console.warn('[push] Kunne ikke gemme subscription i DB:', dbErr);
    }

    return 'granted';
  } catch (e) {
    clearTimeout(timeoutId);
    if (e.message === 'timeout') return 'timeout';
    console.warn('[push] subscribeToPush fejl:', e);
    return 'error';
  }
}

/**
 * Afmeld push-notifikationer for denne browser.
 * Sletter subscription fra databasen.
 */
export async function unsubscribeFromPush() {
  if (!isPushSupported()) return;
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (!subscription) return;

    const endpoint = subscription.endpoint;
    await subscription.unsubscribe();
    await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint);
  } catch (e) {
    console.warn('[push] unsubscribeFromPush fejl:', e);
  }
}

/**
 * Er denne browser allerede tilmeldt?
 * Tjekker browser-siden (ikke DB) — hurtigst og mest præcis.
 */
export async function isPushSubscribed() {
  if (!isPushSupported()) return false;
  try {
    const registration = await navigator.serviceWorker.ready;
    const sub = await registration.pushManager.getSubscription();
    return Boolean(sub);
  } catch {
    return false;
  }
}

/**
 * Auto-tilmeld når brugeren allerede har givet browser-tilladelse (fx tidligere besøg).
 * Kalder ikke requestPermission — undgår uønsket prompt.
 */
export async function tryAutoSubscribePush(userId) {
  if (!isPushSupported() || !userId) return 'unsupported';
  if (getPushPermission() !== 'granted') return 'not_granted';
  if (await isPushSubscribed()) return 'already_subscribed';
  return subscribeToPush(userId, { requestPermission: false });
}
