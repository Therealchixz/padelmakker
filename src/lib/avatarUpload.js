import { supabase } from './supabase';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_BYTES = 2 * 1024 * 1024; // 2 MB

const PENDING_KEY = 'pm_pending_avatar';

export function isAvatarUrl(avatar) {
  return typeof avatar === 'string' && /^https?:\/\//i.test(String(avatar).trim());
}

/**
 * Konverterer data-URL (fx fra FileReader) til Blob uden fetch().
 * fetch(data:...) blokeres af CSP connect-src på produktion (Vercel).
 */
function blobFromDataUrl(dataUrl, fallbackMime = 'image/jpeg') {
  if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:')) return null;
  const comma = dataUrl.indexOf(',');
  if (comma === -1) return null;
  const header = dataUrl.slice(5, comma);
  const payload = dataUrl.slice(comma + 1);
  const mime = (header.split(';')[0] || '').trim() || fallbackMime;
  const isBase64 = header.split(';').some((p) => p.toLowerCase() === 'base64');
  if (isBase64) {
    const binStr = atob(payload.replace(/\s/g, ''));
    const len = binStr.length;
    const arr = new Uint8Array(len);
    for (let i = 0; i < len; i++) arr[i] = binStr.charCodeAt(i);
    return new Blob([arr], { type: mime });
  }
  try {
    return new Blob([decodeURIComponent(payload)], { type: mime });
  } catch {
    return null;
  }
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
 * Gemmer en avatarfil i sessionStorage som base64, så den kan uploades
 * efter login (undgår sessions-problemer under oprettelse af konto).

 */
export async function savePendingAvatar(file) {
  if (!file) return;
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        let email = '';
        try {
          const prev = sessionStorage.getItem(PENDING_KEY);
          if (prev) {
            const o = JSON.parse(prev);
            if (typeof o.email === 'string') email = o.email;
          }
        } catch {
          /* ignore */
        }
        sessionStorage.setItem(
          PENDING_KEY,
          JSON.stringify({
            dataUrl: reader.result,
            type: file.type,
            name: file.name,
            ...(email ? { email } : {}),
          })
        );
      } catch (e) {
        // sessionStorage fuld — spring over uden fejl
        console.warn('Pending avatar opbevaring fejlede:', e.message);
      }
      resolve();
    };
    reader.onerror = () => resolve();
    reader.readAsDataURL(file);
  });
}

/** Knytter pending-avatar til e-mail så vi ikke uploader til forkert bruger efter login. */
export function tagPendingAvatarEmail(email) {
  const normalized = String(email || '')
    .trim()
    .toLowerCase();
  if (!normalized) return;
  try {
    const raw = sessionStorage.getItem(PENDING_KEY);
    if (!raw) return;
    const o = JSON.parse(raw);
    o.email = normalized;
    sessionStorage.setItem(PENDING_KEY, JSON.stringify(o));
  } catch {
    /* ignore */
  }
}

export function hasPendingAvatar() {
  try {

    return Boolean(sessionStorage.getItem(PENDING_KEY));

  } catch {
    return false;
  }
}

/**

 * Uploader en gemt pending-avatar til storage og returnerer URL'en.
 * Rydder sessionStorage uanset om det lykkes.
 */
export async function applyPendingAvatar(userId, userEmail) {
  try {
    const raw = sessionStorage.getItem(PENDING_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const pendingEmail =
      typeof parsed.email === 'string' ? parsed.email.trim().toLowerCase() : '';
    const authEmail =
      typeof userEmail === 'string' ? userEmail.trim().toLowerCase() : '';
    if (pendingEmail && authEmail && pendingEmail !== authEmail) {
      return null;
    }
    const { dataUrl, type, name } = parsed;
    const blob = blobFromDataUrl(dataUrl, type || 'image/jpeg');
    if (!blob) {
      console.warn('applyPendingAvatar: kunne ikke læse billeddata');
      try {
        sessionStorage.removeItem(PENDING_KEY);
      } catch {
        /* ignore */
      }
      return null;
    }
    sessionStorage.removeItem(PENDING_KEY);
    const file = new File([blob], name || 'avatar.jpg', { type: type || blob.type || 'image/jpeg' });
    return await uploadAvatar(userId, file);
  } catch (e) {
    console.warn('applyPendingAvatar fejlede:', e.message);
    try {
      sessionStorage.removeItem(PENDING_KEY);
    } catch {
      /* ignore */
    }
    return null;
  }
}
