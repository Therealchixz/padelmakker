import { supabase } from './supabase';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_BYTES = 2 * 1024 * 1024; // 2 MB
const PENDING_KEY = 'pm_pending_avatar_v1';

export function isAvatarUrl(avatar) {
  return typeof avatar === 'string' && /^https?:\/\//i.test(avatar.trim());
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

/**
 * Fjerner pending avatar (fx ved emoji-valg under oprettelse eller ved log ud).
 */
export function clearPendingAvatar() {
  try {
    sessionStorage.removeItem(PENDING_KEY);
  } catch {
    /* ignore */
  }
}

/** Kald med seneste e-mail før signUp, så pending kun anvendes for den konto. */
export function tagPendingAvatarEmail(email) {
  try {
    const raw = sessionStorage.getItem(PENDING_KEY);
    if (!raw) return;
    const o = JSON.parse(raw);
    o.email = String(email || '').trim().toLowerCase();
    sessionStorage.setItem(PENDING_KEY, JSON.stringify(o));
  } catch {
    /* ignore */
  }
}

/**
 * Gemmer avatarfil i sessionStorage som data URL — uploades efter login med den rigtige bruger.
 * Undgår at Supabase-storage bruger en gammel session under signUp.
 */
export async function savePendingAvatar(file) {
  if (!file) return;
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        sessionStorage.setItem(
          PENDING_KEY,
          JSON.stringify({
            dataUrl: reader.result,
            type: file.type,
            name: file.name,
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
    return Boolean(sessionStorage.getItem(PENDING_KEY));
  } catch {
    return false;
  }
}

/**
 * Uploader pending avatar til storage for den autentificerede bruger. Rydder nøglen bagefter.
 * @param {string} userEmail — skal matche den e-mail der blev brugt ved oprettelse (undgår forkert bruger på delt computer).
 * @returns {Promise<string|null>} public URL eller null
 */
export async function applyPendingAvatar(userId, userEmail) {
  if (!userId) return null;
  let raw;
  try {
    raw = sessionStorage.getItem(PENDING_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    const expected = parsed.email != null ? String(parsed.email).trim().toLowerCase() : '';
    const actual = userEmail != null ? String(userEmail).trim().toLowerCase() : '';
    /* Uden e-mail-tag (gammel data): upload ikke — kan ellers ramme forkert bruger på delt PC */
    if (!expected || !actual || expected !== actual) {
      sessionStorage.removeItem(PENDING_KEY);
      return null;
    }
    sessionStorage.removeItem(PENDING_KEY);
    const { dataUrl, type, name } = parsed;
    const response = await fetch(dataUrl);
    const blob = await response.blob();
    const file = new File([blob], name || 'avatar.jpg', { type: type || 'image/jpeg' });
    return await uploadAvatar(userId, file);
  } catch (e) {
    console.warn('applyPendingAvatar fejlede:', e?.message || e);
    try {
      sessionStorage.removeItem(PENDING_KEY);
    } catch {
      /* ignore */
    }
    return null;
  }
}
