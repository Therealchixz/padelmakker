/**
 * Phone SMS verification gate (Supabase Auth + Twilio via dashboard or send-auth-sms hook).
 */

export function shouldRequirePhoneVerification(user) {
  if (!user) return false
  if (user.phone_confirmed_at) return false

  const meta = user.user_metadata || {}
  if (meta.phone_verified_at) return false

  return meta.phone_verification_required === true
}
