import { supabase } from './supabase';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_BYTES = 2 * 1024 * 1024; // 2 MB
const PENDING_KEY = 'pm_pending_avatar_v1';
/** Max alder for pending (undgår gammel junk + localStorage-kvote) */
const PENDING_MAX_AGE_MS = 48 * 60 * 60 * 1000;

function pendingStorageGet() {
  try {
    return localStorage.getItem(PENDING_KEY);
  } catch {
    try {
      return sessionStorage.getItem(PENDING_KEY);
    } catch {
      return null;
    }
  }
}

function pendingStorageSet(jsonStr) {
  try {
    localStorage.setItem(PENDING_KEY, jsonStr);
    try {
      sessionStorage.removeItem(PENDING_KEY);
    } catch {
      /* ignore */
    }
    return;
  } catch (e) {
    if (e?.name === 'QuotaExceededError') {
      console.warn('Pending avatar: localStorage fuld, bruger sessionStorage (kun samme fane).');
    }
  }
  try {
    sessionStorage.setItem(PENDING_KEY, jsonStr);
  } catch (e2) {
    console.warn('Pending avatar opbevaring fejlede:', e2?.message || e2);
  }
}

function pendingStorageRemove() {
  try {
    localStorage.removeItem(PENDING_KEY);
  } catch {
    /* ignore */
  }
  try {
    sessionStorage.removeItem(PENDING_KEY);
  } catch {
    /* ignore */
  }
}

export function isAvatarUrl(avatar) {
  return typeof avatar === 'string' && /^https?:\/\//i.test(String(avatar).trim());
}

export async function uploadAvatar(userId, file) {
  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new Error('Kun JPG, PNG og WebP billeder er tilladt.');
  }
  if (file.size > MAX_BYTES) {
    throw new Error('Billedet er for stort — maks 2 MB.');
  }
  const rawExt = file.name.includes('.') ? file.name.split('.').pop() : 'jpg';
  const ext = rawExt.toLowerCase().replace(/[^a-z]/g, '') || 'jpg';
  const path = `${userId}/avatar_${Date.now()}.${ext}`;

  const { error } = await supabase.storage.from('avatars').upload(path, file, {
    contentType: file.type,
  });

  if (error) throw error;

  const { data } = supabase.storage.from('avatars').getPublicUrl(path);
  return data.publicUrl;
}

export function clearPendingAvatar() {
  pendingStorageRemove();
}

/** Kald med seneste e-mail før signUp, så pending kun anvendes for den konto. */
export function tagPendingAvatarEmail(email) {
  try {
    const raw = pendingStorageGet();
    if (!raw) return;
    const o = JSON.parse(raw);
    o.email = String(email || '').trim().toLowerCase();
    pendingStorageSet(JSON.stringify(o));
  } catch {
    /* ignore */
  }
}

/**
 * Gemmer avatarfil i sessionStorage som data URL — uploades efter login med den rigtige bruger.
 */
export async function savePendingAvatar(file) {
  if (!file) return;
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        pendingStorageSet(
          JSON.stringify({
            dataUrl: reader.result,
            type: file.type,
            name: file.name,
            savedAt: Date.now(),
          })
        );
      } catch (e) {
        console.warn('Pending avatar opbevaring fejlede:', e?.message || e);
      }
      resolve();
    };
    reader.onerror = () => resolve();
    reader.readAsDataURL(file);
  });
}

export function hasPendingAvatar() {
  try {
    return Boolean(pendingStorageGet());
  } catch {
    return false;
  }
}

/**
 * @param {string} userEmail — skal matche den e-mail der blev brugt ved oprettelse.
 * @returns {Promise<string|null>}
 */
export async function applyPendingAvatar(userId, userEmail) {
  if (!userId) return null;
  let raw;
  try {
    raw = pendingStorageGet();
  } catch {
    return null;
  }
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    const savedAt = Number(parsed.savedAt);
    if (Number.isFinite(savedAt) && Date.now() - savedAt > PENDING_MAX_AGE_MS) {
      pendingStorageRemove();
      return null;
    }
    const expected = parsed.email != null ? String(parsed.email).trim().toLowerCase() : '';
    const actual = userEmail != null ? String(userEmail).trim().toLowerCase() : '';
    if (!expected || !actual || expected !== actual) {
      pendingStorageRemove();
      return null;
    }
    pendingStorageRemove();
    const { dataUrl, type, name } = parsed;
    const response = await fetch(dataUrl);
    const blob = await response.blob();
    const file = new File([blob], name || 'avatar.jpg', { type: type || 'image/jpeg' });
    return await uploadAvatar(userId, file);
  } catch (e) {
    console.warn('applyPendingAvatar fejlede:', e?.message || e);
    pendingStorageRemove();
    return null;
  }
}
