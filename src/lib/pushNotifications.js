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
 * Gemmer subscription i push_subscriptions-tabellen.
 * Returnerer 'granted' | 'denied' | 'error'.
 */
export async function subscribeToPush(userId) {
  if (!isPushSupported()) return 'unsupported';

  try {
    const registration = await navigator.serviceWorker.ready;
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return permission; // 'denied' eller 'default'

    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });

    const { endpoint, keys } = subscription.toJSON();
    const { error } = await supabase.from('push_subscriptions').upsert(
      { user_id: userId, endpoint, p256dh: keys.p256dh, auth: keys.auth },
      { onConflict: 'endpoint' }
    );

    if (error) {
      console.warn('[push] Kunne ikke gemme subscription:', error.message);
      return 'error';
    }
    return 'granted';
  } catch (e) {
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

/** Synkronisér app-ikon badge med antal ulæste notifikationer (best effort). */
export async function syncAppBadge(count) {
  try {
    if (!('setAppBadge' in navigator) || !('clearAppBadge' in navigator)) return;
    if (typeof count === 'number' && count > 0) {
      await navigator.setAppBadge(count);
    } else {
      await navigator.clearAppBadge();
    }
  } catch {
    // Badging API er optional — ignorer fejl.
  }
}
