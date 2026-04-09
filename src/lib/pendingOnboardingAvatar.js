import { supabase } from './supabase'
import { uploadProfileAvatar } from './avatarUpload'

const KEY = 'pm_pending_avatar_v1'
const MAX_AGE_MS = 48 * 60 * 60 * 1000
/** sessionStorage ~5MB; base64 ~4/3 af filstørrelse */
const MAX_FILE_BYTES = 1.5 * 1024 * 1024

/**
 * Gemmer valgt profilbillede til upload efter login (når email-bekræftelse gav ingen session ved signup).
 */
export function savePendingOnboardingAvatar(userId, email, file) {
  if (!userId || !email || !file) return { ok: false, reason: 'missing' }
  if (file.size > MAX_FILE_BYTES) {
    return { ok: false, reason: 'too_large' }
  }
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result
      if (typeof dataUrl !== 'string' || !dataUrl.includes(',')) {
        resolve({ ok: false, reason: 'read_failed' })
        return
      }
      const base64 = dataUrl.split(',')[1]
      const mime = file.type || 'image/jpeg'
      const payload = JSON.stringify({
        userId,
        email: String(email).trim().toLowerCase(),
        base64,
        mime,
        exp: Date.now() + MAX_AGE_MS,
      })
      try {
        sessionStorage.setItem(KEY, payload)
        resolve({ ok: true })
      } catch {
        resolve({ ok: false, reason: 'quota' })
      }
    }
    reader.onerror = () => resolve({ ok: false, reason: 'read_failed' })
    reader.readAsDataURL(file)
  })
}

export function clearPendingOnboardingAvatar() {
  try {
    sessionStorage.removeItem(KEY)
  } catch {
    /* ignore */
  }
}

function base64ToFile(base64, mime) {
  const bin = atob(base64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  const ext =
    mime === 'image/png'
      ? 'png'
      : mime === 'image/webp'
        ? 'webp'
        : mime === 'image/gif'
          ? 'gif'
          : 'jpg'
  return new File([bytes], `avatar.${ext}`, { type: mime || 'image/jpeg' })
}

/**
 * Efter login: upload ventende avatar hvis den matcher brugeren.
 * @returns {{ uploaded: boolean, skipped?: string, error?: string }}
 */
export async function tryFinishPendingOnboardingAvatar(authUser) {
  if (!authUser?.id || !authUser.email) return { uploaded: false, skipped: 'no_user' }
  let raw
  try {
    raw = sessionStorage.getItem(KEY)
  } catch {
    return { uploaded: false, skipped: 'no_storage' }
  }
  if (!raw) return { uploaded: false, skipped: 'empty' }

  let parsed
  try {
    parsed = JSON.parse(raw)
  } catch {
    clearPendingOnboardingAvatar()
    return { uploaded: false, skipped: 'bad_json' }
  }

  if (!parsed.userId || !parsed.base64 || !parsed.mime) {
    clearPendingOnboardingAvatar()
    return { uploaded: false, skipped: 'bad_payload' }
  }

  if (parsed.exp && Date.now() > parsed.exp) {
    clearPendingOnboardingAvatar()
    return { uploaded: false, skipped: 'expired' }
  }

  const pendingEmail = String(parsed.email || '').trim().toLowerCase()
  const userEmail = String(authUser.email || '').trim().toLowerCase()
  if (parsed.userId !== authUser.id || (pendingEmail && pendingEmail !== userEmail)) {
    return { uploaded: false, skipped: 'wrong_user' }
  }

  const file = base64ToFile(parsed.base64, parsed.mime)
  try {
    const url = await uploadProfileAvatar(authUser.id, file)
    const { error } = await supabase.from('profiles').update({ avatar: url }).eq('id', authUser.id)
    if (error) throw new Error(error.message)
    clearPendingOnboardingAvatar()
    return { uploaded: true }
  } catch (e) {
    return { uploaded: false, error: e?.message || String(e) }
  }
}
