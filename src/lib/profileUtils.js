/**
 * Supabase/Postgres kan returnere text[] som:
 * - JSON array ["a","b"]
 * - JSON string "[\"a\",\"b\"]" (dobbelt-encoded)
 * - Postgres literal {a,b} eller {"a","b"}
 * React forventer array til .map() — ellers kastes der (ErrorBoundary).
 */

function parsePostgresArrayLiteral(s) {
  const t = String(s).trim()
  if (!t.startsWith("{") || !t.endsWith("}")) return null
  const inner = t.slice(1, -1).trim()
  if (inner === "") return []
  const out = []
  let cur = ""
  let inQuote = false
  for (let i = 0; i < inner.length; i++) {
    const c = inner[i]
    if (c === '"') {
      inQuote = !inQuote
      continue
    }
    if (c === "," && !inQuote) {
      out.push(cur.trim())
      cur = ""
      continue
    }
    cur += c
  }
  out.push(cur.trim())
  return out.map((p) => {
    if (p.startsWith('"') && p.endsWith('"')) return p.slice(1, -1).replace(/\\"/g, '"')
    return p
  })
}

/** Gør værdi til string[] til visning og .map() */
export function normalizeStringArrayField(value) {
  if (value == null) return []
  if (Array.isArray(value)) {
    return value.map((x) => (x == null ? "" : String(x))).filter(Boolean)
  }
  if (typeof value === "string") {
    const t = value.trim()
    if (t === "") return []
    if (t.startsWith("{") && t.endsWith("}")) {
      const p = parsePostgresArrayLiteral(t)
      return Array.isArray(p) ? p.filter(Boolean) : []
    }
    if (t.startsWith("[")) {
      try {
        const j = JSON.parse(t)
        return Array.isArray(j) ? j.map((x) => String(x)).filter(Boolean) : []
      } catch {
        return []
      }
    }
    try {
      const j = JSON.parse(t)
      if (Array.isArray(j)) return j.map((x) => String(x)).filter(Boolean)
    } catch {
      /* ikke JSON */
    }
    return []
  }
  return []
}

export function normalizeProfileRow(p) {
  if (p == null || typeof p !== "object") return p
  return { ...p, availability: normalizeStringArrayField(p.availability) }
}

/** Danske + almindelige europæiske vokaler til navne-tjek */
const VOWEL_RE = /[aeiouyæøåäöü]/gi

/**
 * Klient-side tjek af visningsnavn (forhindrer åbenlys tastatur-gibberish).
 * Kan ikke garantere "rigtige" navne — kun rimelig format + heuristik.
 * @returns {{ valid: true } | { valid: false, message: string }}
 */
export function validateDisplayName(raw) {
  const s =
    typeof raw === "string"
      ? raw
          .trim()
          .replace(/\s+/g, " ")
          .replace(/\u00AD/g, "")
      : ""
  if (!s) return { valid: false, message: "Navn må ikke være tomt." }
  if (s.length < 2) return { valid: false, message: "Navn skal være mindst 2 tegn." }
  if (s.length > 60) return { valid: false, message: "Navn må højst være 60 tegn." }

  if (!/^\p{L}/u.test(s) || !/\p{L}$/u.test(s)) {
    return { valid: false, message: "Navn skal starte og slutte med et bogstav." }
  }

  if (!/^[\p{L}\s'.-]+$/u.test(s)) {
    return {
      valid: false,
      message: "Brug kun bogstaver, mellemrum, bindestreg og apostrof (f.eks. Anne-Marie).",
    }
  }

  const letterCount = (s.match(/\p{L}/gu) || []).length
  if (letterCount < 2) {
    return { valid: false, message: "Navn skal indeholde mindst to bogstaver." }
  }

  const compact = s.replace(/\s/g, "")
  if (/(.)\1{3,}/u.test(compact)) {
    return { valid: false, message: "For mange gentagne tegn — brug dit rigtige navn." }
  }

  const parts = s.split(" ").filter(Boolean)
  for (const part of parts) {
    const lettersOnly = part.replace(/[^\p{L}]/gu, "")
    if (lettersOnly.length >= 9) {
      const vowels = lettersOnly.match(VOWEL_RE) || []
      const ratio = vowels.length / lettersOnly.length
      if (ratio < 0.22) {
        return {
          valid: false,
          message:
            "Det ligner ikke et navn (for få vokaler). Skriv dit for- og efternavn som andre kan genkende.",
        }
      }
    }
    if (lettersOnly.length >= 4 && lettersOnly.length < 9) {
      const vowels = lettersOnly.match(VOWEL_RE) || []
      if (vowels.length === 0) {
        return { valid: false, message: "Hvert navnedel skal indeholde mindst én vokal." }
      }
    }
  }

  return { valid: true }
}
