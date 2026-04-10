import { REGIONS, DEFAULT_REGION } from "./platformConstants"

/**
 * Map DB-værdi til den kanoniske regionsstreng fra REGIONS (knapper bruger fuldt navn).
 * Fx "Nordjylland" / "nordjylland" → "Region Nordjylland"
 */
export function canonicalRegionForForm(stored) {
  const raw = String(stored ?? "").trim()
  if (!raw) return ""
  const lower = raw.toLowerCase()
  const exact = REGIONS.find((r) => r.toLowerCase() === lower)
  if (exact) return exact
  for (const r of REGIONS) {
    const tail = r.replace(/^Region\s+/i, "").toLowerCase()
    if (lower === tail || lower.endsWith(tail) || tail.includes(lower) || lower.includes(tail)) {
      return r
    }
  }
  return raw
}

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

/**
 * Én-gangs sync: ny bruger har onboarding-data i auth.user_metadata, men `profiles` kan være
 * oprettet af en DB-trigger uden de felter. Kør UPDATE med denne patch og sæt derefter
 * onboarding_applied_to_profile i metadata.
 *
 * @param {Record<string, unknown>} meta — user_metadata
 * @param {Record<string, unknown> | null} [existingProfile] — nuværende profiles-række (hvis nogen)
 */
export function buildOnboardingProfileRowPatch(meta, existingProfile = null) {
  if (meta == null || typeof meta !== "object") return null
  if (meta.onboarding_completed !== true || meta.onboarding_applied_to_profile === true) return null
  const displayName = String(meta.full_name || meta.name || "").trim()
  if (!displayName) return null

  const metaAvail = normalizeStringArrayField(meta.availability)
  const birthNum = meta.birth_year != null && meta.birth_year !== "" ? Number(meta.birth_year) : null
  const metaArea =
    canonicalRegionForForm(meta.area || meta.region || meta.city || "") || DEFAULT_REGION

  if (existingProfile && typeof existingProfile === "object") {
    const p = existingProfile
    const profAvail = normalizeStringArrayField(p.availability)
    const profArea = canonicalRegionForForm(String(p.area || "").trim()) || ""
    const profBirth = p.birth_year != null && p.birth_year !== "" ? Number(p.birth_year) : null
    const availMatch =
      profAvail.length === metaAvail.length &&
      metaAvail.length > 0 &&
      metaAvail.every((x, i) => x === profAvail[i])
    const birthMatch =
      profBirth != null &&
      !Number.isNaN(profBirth) &&
      birthNum != null &&
      !Number.isNaN(birthNum) &&
      profBirth === birthNum
    const areaMatch = profArea === metaArea
    const nameOk =
      String(p.full_name || p.name || "")
        .trim()
        .toLowerCase() === displayName.toLowerCase()
    if (nameOk && availMatch && birthMatch && areaMatch) {
      return null
    }
  }

  const levelNum = meta.level != null && meta.level !== "" ? Number(meta.level) : NaN
  return {
    full_name: displayName,
    name: displayName,
    level: !Number.isNaN(levelNum) ? levelNum : 5,
    play_style: String(meta.play_style || "Ved ikke endnu").trim() || "Ved ikke endnu",
    area: metaArea,
    availability: metaAvail,
    bio: String(meta.bio || "").trim(),
    avatar: (existingProfile?.avatar && String(existingProfile.avatar).startsWith('http'))
      ? existingProfile.avatar
      : (meta.avatar || "🎾"),
    birth_year: birthNum != null && !Number.isNaN(Number(birthNum)) ? Number(birthNum) : null,
  }
}

export function normalizeProfileRow(p) {
  if (p == null || typeof p !== "object") return p
  const rawRegion =
    p.area != null && String(p.area).trim() !== ""
      ? p.area
      : p.region != null && String(p.region).trim() !== ""
        ? p.region
        : p.city != null && String(p.city).trim() !== ""
          ? p.city
          : ""
  const region = rawRegion ? canonicalRegionForForm(rawRegion) : rawRegion
  return { ...p, area: region, availability: normalizeStringArrayField(p.availability) }
}

/** Danske + almindelige europæiske vokaler til navne-tjek */
const VOWEL_RE = /[aeiouyæøåäöü]/gi

/**
 * Ét navneled (ét ord — mellemnavne håndteres som flere ord i validateMultiPartNameField).
 * @returns {{ valid: true } | { valid: false, message: string }}
 */
export function validateNameWord(raw, fieldLabel) {
  const label = fieldLabel || "Navn"
  const s =
    typeof raw === "string"
      ? raw.trim().replace(/\u00AD/g, "")
      : ""
  if (!s) return { valid: false, message: `${label} må ikke være tomt.` }
  if (s.length < 2) return { valid: false, message: `${label} skal være mindst 2 tegn pr. del.` }
  if (s.length > 40) return { valid: false, message: `${label}: hver del må højst være 40 tegn.` }

  if (!/^\p{L}/u.test(s) || !/\p{L}$/u.test(s)) {
    return { valid: false, message: `${label}: hver del skal starte og slutte med et bogstav.` }
  }

  if (!/^[\p{L}'.-]+$/u.test(s)) {
    return {
      valid: false,
      message: `${label}: brug kun bogstaver, bindestreg og apostrof (pr. del).`,
    }
  }

  const letterCount = (s.match(/\p{L}/gu) || []).length
  if (letterCount < 2) {
    return { valid: false, message: `${label}: hver del skal indeholde mindst to bogstaver.` }
  }

  if (/(.)\1{3,}/u.test(s)) {
    return { valid: false, message: `${label}: for mange gentagne tegn — brug dit rigtige navn.` }
  }

  const lettersOnly = s.replace(/[^\p{L}]/gu, "")
  if (lettersOnly.length >= 9) {
    const vowels = lettersOnly.match(VOWEL_RE) || []
    const ratio = vowels.length / lettersOnly.length
    if (ratio < 0.22) {
      return {
        valid: false,
        message: `${label} ligner ikke et rigtigt navn (for få vokaler).`,
      }
    }
  }
  if (lettersOnly.length >= 4 && lettersOnly.length < 9) {
    const vowels = lettersOnly.match(VOWEL_RE) || []
    if (vowels.length === 0) {
      return { valid: false, message: `${label} skal indeholde mindst én vokal pr. del.` }
    }
  }

  return { valid: true }
}

const MAX_NAME_WORDS = 4

/**
 * Fornavn eller efternavn med mellemnavne: flere ord adskilt af mellemrum (fx "Mathias Dam Røn").
 * @returns {{ valid: true } | { valid: false, message: string }}
 */
export function validateMultiPartNameField(raw, fieldLabel) {
  const label = fieldLabel || "Navn"
  const full =
    typeof raw === "string"
      ? raw.trim().replace(/\u00AD/g, "").replace(/\s+/g, " ")
      : ""
  if (!full) return { valid: false, message: `${label} må ikke være tomt.` }
  const parts = full.split(" ").filter(Boolean)
  if (parts.length > MAX_NAME_WORDS) {
    return {
      valid: false,
      message: `${label}: højst ${MAX_NAME_WORDS} navnedele adskilt af mellemrum (inkl. mellemnavne).`,
    }
  }
  for (let i = 0; i < parts.length; i++) {
    const w = validateNameWord(parts[i], label)
    if (!w.valid) return w
  }
  const lettersJoined = full.replace(/[^\p{L}]/gu, "")
  if (lettersJoined.length >= 12) {
    const vowels = lettersJoined.match(VOWEL_RE) || []
    const ratio = vowels.length / lettersJoined.length
    if (ratio < 0.2) {
      return {
        valid: false,
        message: `${label} ligner ikke et rigtigt navn (for få vokaler i alt).`,
      }
    }
  }
  return { valid: true }
}

/**
 * Én navnedel uden mellemrum (bagudkompatibilitet / enkelt felter).
 * @deprecated Brug validateMultiPartNameField for fornavn/efternavn med mellemnavne.
 */
export function validateSingleNameField(raw, fieldLabel) {
  const label = fieldLabel || "Navn"
  const s =
    typeof raw === "string"
      ? raw.trim().replace(/\u00AD/g, "")
      : ""
  if (/\s/.test(s)) {
    return {
      valid: false,
      message: `${label}: brug mellemrum mellem fornavn og mellemnavne (eller ét ord pr. felt).`,
    }
  }
  return validateNameWord(s, label)
}

/**
 * Fornavn + efternavn (mellemnavne tilladt i hvert felt).
 * @returns {{ valid: true } | { valid: false, message: string }}
 */
export function validateFirstLastName(firstRaw, lastRaw) {
  const f = validateMultiPartNameField(firstRaw, "Fornavn")
  if (!f.valid) return f
  const l = validateMultiPartNameField(lastRaw, "Efternavn")
  if (!l.valid) return l
  return { valid: true }
}

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
