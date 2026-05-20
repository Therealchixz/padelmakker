/**
 * Phone SMS verification gate (Supabase Auth + Twilio via dashboard or send-auth-sms hook).
 *
 * Sikkerhed: Stol kun på server-kontrollerede kilder:
 * - profiles.phone_verification_exempt (admin via RPC + DB-trigger)
 * - user.phone_confirmed_at (Supabase Auth efter rigtig OTP)
 * Brugere kan selv skrive vilkårlige værdier i user_metadata via updateUser — det må ikke bruges til at undgå SMS.
 */

function isTruthyFlag(value) {
  return value === true || value === 'true' || value === 1 || value === '1'
}

/** Admin kan undtage fx testkonti fra obligatorisk SMS-bekræftelse. Kun DB-felt — ikke JWT metadata. */
export function isPhoneVerificationExempt(_user, profile) {
  return isTruthyFlag(profile?.phone_verification_exempt)
}

/** Skal brugeren bekræfte telefon før dashboard? */
export function shouldRequirePhoneVerification(user, profile) {
  if (!user) return false
  if (isPhoneVerificationExempt(user, profile)) return false
  if (user.phone_confirmed_at) return false
  return true
}
