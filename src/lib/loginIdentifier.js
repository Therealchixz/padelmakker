import { normalizePhoneToE164 } from './validationHelpers.js'

/**
 * Login med e-mail ELLER telefonnummer.
 *
 * Opretter man sig med telefon, kommer mailen først på kontoen, når man har
 * klikket på linket i bekræftelsesmailen. Kunne man kun logge ind med mail, var
 * der ingen vej tilbage, hvis mailen aldrig kom frem: 16 af 49 telefon-konti sad
 * fast sådan (gennemgang 3. nov. 2026). Efter login med telefon sender appen dem
 * til mail-siden, hvor de kan få mailen igen.
 *
 * @returns {{ email: string, password: string } | { phone: string, password: string } | null}
 */
export function loginCredentialsFromIdentifier(identifier, password) {
  const raw = String(identifier || '').trim()
  if (!raw) return null
  if (raw.includes('@')) return { email: raw, password }
  const phone = normalizePhoneToE164(raw)
  if (!phone || phone.replace(/\D/g, '').length < 10) return { email: raw, password }
  return { phone, password }
}

/** Mail der venter på bekræftelse (telefon-konti har den i new_email, indtil linket er klikket). */
export function pendingAccountEmail(user) {
  return String(user?.email || user?.new_email || '').trim()
}
