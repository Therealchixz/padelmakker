import { supabase } from './supabase';

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || '';

/** Konverter base64url-streng til Uint8Array (kræves af pushManager.subscribe) */
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

/** Er push understøttet i denne browser? */
export function isPushSupported() {
  return (
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    Boolean(VAPID_PUBLIC_KEY)
  );
}

/** Hent nuværende push-tilladelse ('granted' | 'denied' | 'default') */
export function getPushPermission() {
  return Notification.permission;
}

/**
 * Tilmeld denne browser til push-notifikationer.
 * Returnerer 'granted' | 'denied' | 'blocked' | 'unsupported' | 'error' | 'timeout'.
 * DB-gemning fejler stille — browser-subscription er sandheden.
 */
export async function subscribeToPush(userId) {
  if (!isPushSupported()) return 'unsupported';

  // 15 sek. timeout — forhindrer at requestPermission hænger i Brave/Firefox
  let timeoutId;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error('timeout')), 15000);
  });

  try {
    const registration = await navigator.serviceWorker.ready;

    const permission = await Promise.race([
      Notification.requestPermission(),
      timeoutPromise,
    ]);
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
