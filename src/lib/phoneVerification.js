/**
 * Phone SMS verification gate (Supabase Auth + Twilio).
 */

export function isPhoneVerificationExempt(user, profile) {
  if (profile?.phone_verification_exempt === true) return true
  const meta = user?.user_metadata || {}
  return meta.phone_verification_exempt === true
}

/** Skal brugeren bekræfte telefon før dashboard? (kræver canUseApp hos kalder) */
export function shouldRequirePhoneVerification(user, profile) {
  if (!user) return false
  if (isPhoneVerificationExempt(user, profile)) return false
  if (user.phone_confirmed_at) return false

  const meta = user.user_metadata || {}
  if (meta.phone_verified_at) return false

  return true
}

export function mapPhoneAuthError(message) {
  const m = String(message || '').toLowerCase()
  if (m.includes('already registered') || m.includes('already exists') || m.includes('duplicate')) {
    return 'Dette telefonnummer er allerede knyttet til en anden konto. Hvert nummer kan kun bruges én gang.'
  }
  if (m.includes('rate limit') || m.includes('too many')) {
    return 'For mange forsøg. Vent et øjeblik og prøv igen.'
  }
  if (m.includes('invalid') && m.includes('phone')) {
    return 'Ugyldigt telefonnummer. Brug fx 20112233 eller +4520112233.'
  }
  return message || 'Telefonbekræftelse fejlede.'
}
