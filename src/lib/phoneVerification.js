/**
 * Phone SMS verification gate (Supabase Auth + Twilio).
 */

/** Klient-cooldown før "Send kode igen" (10 min). */
export const PHONE_SMS_RESEND_COOLDOWN_MS = 600_000

/** Skal matche Supabase Auth → Phone → OTP expiry (sekunder) i dashboard. */
export const PHONE_SMS_OTP_VALID_MINUTES = 10

export function formatPhoneSmsResendCountdown(totalSeconds) {
  if (totalSeconds <= 0) return ''
  const mins = Math.floor(totalSeconds / 60)
  const secs = totalSeconds % 60
  if (mins > 0) {
    return `${mins}:${String(secs).padStart(2, '0')}`
  }
  return `${secs}s`
}

export function phoneSmsResendButtonLabel(otpSent, canResend, resendSeconds) {
  if (!otpSent) return 'Send SMS-kode'
  if (canResend) return 'Send kode igen'
  return `Send igen om ${formatPhoneSmsResendCountdown(resendSeconds)}`
}

function isTruthyFlag(value) {
  return value === true || value === 'true' || value === 1 || value === '1'
}

export function isPhoneVerificationExempt(user, profile) {
  if (isTruthyFlag(profile?.phone_verification_exempt)) return true
  const meta = user?.user_metadata || {}
  return isTruthyFlag(meta.phone_verification_exempt)
}

/** Skal brugeren bekræfte telefon før dashboard? */
export function shouldRequirePhoneVerification(user, profile) {
  if (!user) return false
  if (isPhoneVerificationExempt(user, profile)) return false
  if (user.phone_confirmed_at) return false

  const meta = user.user_metadata || {}
  if (meta.phone_verified_at) return false

  return true
}

/**
 * Eksisterende konto (ikke ny signup): eget telefonvindue uden onboarding trin 1–4.
 */
export function shouldUseExistingUserPhoneFlow(user, profile) {
  if (!user || !profile) return false
  const meta = user.user_metadata || {}
  if (meta.phone_first_signup === true) return false

  if (meta.onboarding_completed === true && meta.phone_verification_required === true) {
    return false
  }

  const profileName = String(profile.full_name || profile.name || '').trim()
  const hasDbProfileData =
    profileName.length > 0 ||
    (profile.birth_year != null && String(profile.birth_year).trim() !== '') ||
    String(profile.play_style || '').trim() !== '' ||
    String(profile.area || profile.city || '').trim() !== ''

  if (!hasDbProfileData && meta.onboarding_applied_to_profile !== true) {
    return false
  }

  return true
}

/** Sti til telefon-SMS når brugeren skal bekræfte nummer. */
export function getPhoneVerificationPath(user, profile) {
  if (!shouldRequirePhoneVerification(user, profile)) return null
  if (shouldUseExistingUserPhoneFlow(user, profile)) return '/konto/telefon'
  return '/opret/bekraeft-telefon'
}

export function mapPhoneAuthError(message) {
  const m = String(message || '').toLowerCase()
  if (m.includes('already registered') || m.includes('already exists') || m.includes('duplicate')) {
    return 'Dette telefonnummer er allerede knyttet til en anden konto. Hvert nummer kan kun bruges én gang.'
  }
  if (m.includes('rate limit') || m.includes('too many') || m.includes('sms rate')) {
    return `For mange SMS-forsøg. Vent ${PHONE_SMS_OTP_VALID_MINUTES} minutter før du sender igen.`
  }
  if (m.includes('phone_exists')) {
    return 'Dette telefonnummer er allerede knyttet til en anden konto. Hvert nummer kan kun bruges én gang.'
  }
  if (
    m.includes('invalid from number') ||
    m.includes('caller id') ||
    m.includes('21212') ||
    (m.includes('sms') && m.includes('provider'))
  ) {
    return 'Dit nummer ser gyldigt ud, men SMS kunne ikke sendes (serveropsætning). Prøv igen om lidt — ved vedvarende fejl, kontakt support.'
  }
  if (m.includes('invalid') && m.includes('phone') && m.includes('e.164')) {
    return 'Ugyldigt telefonnummer. Brug 8 cifre (fx 21162004) eller med landekode (+4521162004).'
  }
  if (m.includes('invalid') && m.includes('phone')) {
    return 'Ugyldigt telefonnummer. Brug fx 20112233 eller +4520112233.'
  }
  return message || 'Telefonbekræftelse fejlede.'
}
