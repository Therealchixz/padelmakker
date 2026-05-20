/**
 * Phone SMS verification gate (Supabase Auth + Twilio via dashboard or send-auth-sms hook).
 */

function isTruthyFlag(value) {
  return value === true || value === 'true' || value === 1 || value === '1'
}

/** Admin kan undtage fx testkonti fra obligatorisk SMS-bekræftelse. */
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

  return meta.phone_verification_required === true
}
