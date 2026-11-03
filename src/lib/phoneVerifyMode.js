/**
 * Hvilken slags SMS-kode venter siden "Bekræft telefonnummer" på?
 *
 * - 'signup': ny konto oprettet med telefon + adgangskode (signUpWithPhone sætter
 *   pending_email i metadata). Koden tjekkes som type 'sms'.
 * - 'phone_change': logget ind uden bekræftet telefon, fx med Google. Onboarding
 *   sender koden med updateUser({ phone }), så den skal tjekkes som 'phone_change'.
 *   Før blev Google-brugere sendt videre som 'signup', og Supabase svarede
 *   "User not found" på en korrekt kode (bruger-mail 3. nov. 2026).
 */

export function hasPendingSignupMetadata(user) {
  const meta = user?.user_metadata || {}
  return meta.phone_first_signup === true || !!meta.pending_email
}

export function shouldUseLegacyPhoneChangeFlow(user) {
  if (!user || user.phone_confirmed_at) return false
  if (hasPendingSignupMetadata(user)) return false
  return true
}

/** @returns {'signup' | 'phone_change'} */
export function resolvePhoneVerifyMode(user) {
  return shouldUseLegacyPhoneChangeFlow(user) ? 'phone_change' : 'signup'
}
