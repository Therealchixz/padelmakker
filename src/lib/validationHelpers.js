/** Brugervenlig e-mail-tjek før signup (kræver @ og domæne med mindst 2-tegns TLD). */
export function isValidSignupEmail(raw) {
  const s = String(raw || '').trim()
  if (!s || s.length > 254) return false
  // Én @, lokaldel, domæne med mindst 2-tegns TLD, ingen dobbelte punktummer
  const re = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/
  return re.test(s) && !s.includes('..')
}

/**
 * Konverterer bruger-input til E.164.
 * Default for danske brugere:
 * - 8 cifre -> +45XXXXXXXX
 * - 45XXXXXXXX -> +45XXXXXXXX
 * - 0045XXXXXXXX -> +45XXXXXXXX
 */
export function normalizePhoneToE164(raw) {
  const input = String(raw || '').trim()
  if (!input) return ''

  let compact = input.replace(/[\s().-]/g, '')
  if (compact.startsWith('00')) compact = `+${compact.slice(2)}`

  const hadPlus = compact.startsWith('+')
  const digitsOnly = compact.replace(/\D/g, '')
  if (!digitsOnly) return ''

  let normalized = ''
  if (hadPlus) {
    normalized = `+${digitsOnly}`
  } else if (digitsOnly.length === 8) {
    normalized = `+45${digitsOnly}`
  } else if (digitsOnly.length === 10 && digitsOnly.startsWith('45')) {
    normalized = `+${digitsOnly}`
  } else {
    normalized = `+${digitsOnly}`
  }

  if (!/^\+[1-9]\d{7,14}$/.test(normalized)) return ''
  return normalized
}

export function isValidSignupPhone(raw) {
  return normalizePhoneToE164(raw) !== ''
}
