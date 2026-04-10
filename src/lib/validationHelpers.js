/** Brugervenlig e-mail-tjek før signup (kræver @ og domæne med mindst 2-tegns TLD). */
export function isValidSignupEmail(raw) {
  const s = String(raw || '').trim()
  if (!s || s.length > 254) return false
  // Én @, lokaldel, domæne med mindst 2-tegns TLD, ingen dobbelte punktummer
  const re = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/
  return re.test(s) && !s.includes('..')
}
