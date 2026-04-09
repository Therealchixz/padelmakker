/** Brugervenlig e-mail-tjek før signup (kræver @ og domæne med punktum). */
export function isValidSignupEmail(raw) {
  const s = String(raw || '').trim()
  if (!s) return false
  // Én @, lokaldel og domæne med mindst ét punktum (fx x@y.dk)
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return re.test(s)
}
