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
