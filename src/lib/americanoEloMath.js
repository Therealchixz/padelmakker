const DEFAULT_BASE_RATING = 1000
const DEFAULT_MIN_RATING = 100
const DEFAULT_K_FACTOR = 24
const ELO_DIVISOR = 400

function toNumber(value, fallback = 0) {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

export function roundHalfAwayFromZero(value) {
  const n = toNumber(value, 0)
  if (n >= 0) return Math.floor(n + 0.5)
  return Math.ceil(n - 0.5)
}

export function americanoExpectedScore(ratingA, ratingB) {
  const a = toNumber(ratingA, DEFAULT_BASE_RATING)
  const b = toNumber(ratingB, DEFAULT_BASE_RATING)
  return 1 / (1 + Math.pow(10, (b - a) / ELO_DIVISOR))
}

function pointsScore(pointsA, pointsB) {
  const a = toNumber(pointsA, 0)
  const b = toNumber(pointsB, 0)
  if (a > b) return 1
  if (a < b) return 0
  return 0.5
}

function normalizeZeroSum(rows) {
  const out = rows.map((row) => ({ ...row }))
  let total = out.reduce((sum, row) => sum + row.delta, 0)
  if (total === 0 || out.length === 0) return out

  if (total > 0) {
    const order = [...out].sort((a, b) => {
      const ar = a.delta - a.deltaRaw
      const br = b.delta - b.deltaRaw
      if (br !== ar) return br - ar
      return b.delta - a.delta
    })
    for (let i = 0; i < total; i += 1) {
      const target = order[i % order.length]
      target.delta -= 1
    }
  } else {
    const need = Math.abs(total)
    const order = [...out].sort((a, b) => {
      const ar = a.delta - a.deltaRaw
      const br = b.delta - b.deltaRaw
      if (ar !== br) return ar - br
      return a.delta - b.delta
    })
    for (let i = 0; i < need; i += 1) {
      const target = order[i % order.length]
      target.delta += 1
    }
  }

  total = out.reduce((sum, row) => sum + row.delta, 0)
  if (total !== 0) {
    out[0].delta -= total
  }
  return out
}

/**
 * Multiplayer-ELO for Americano baseret på slutstilling (pointsum).
 * Vi sammenligner hver spiller mod alle andre (pairwise):
 * - Faktisk score: 1 / 0.5 / 0 baseret på pointsammenligning
 * - Forventet score: klassisk ELO forventning mod hver modstander
 * - Delta: K * (actual - expected) / (N - 1)
 */
export function calculateAmericanoEloRows(players, options = {}) {
  const baseRating = toNumber(options.baseRating, DEFAULT_BASE_RATING)
  const minRating = toNumber(options.minRating, DEFAULT_MIN_RATING)
  const kFactor = toNumber(options.kFactor, DEFAULT_K_FACTOR)

  const rows = Array.isArray(players)
    ? players.map((p) => ({
        id: String(p.id),
        rating: toNumber(p.rating, baseRating),
        points: toNumber(p.points, 0),
      }))
    : []

  const n = rows.length
  if (n <= 1) {
    return rows.map((row) => ({
      ...row,
      expectedScore: 0,
      actualScore: 0,
      deltaRaw: 0,
      delta: 0,
      newRating: Math.max(minRating, roundHalfAwayFromZero(row.rating)),
    }))
  }

  const withScores = rows.map((row) => {
    let expectedScore = 0
    let actualScore = 0
    for (const opp of rows) {
      if (opp.id === row.id) continue
      expectedScore += americanoExpectedScore(row.rating, opp.rating)
      actualScore += pointsScore(row.points, opp.points)
    }
    const deltaRaw = (kFactor * (actualScore - expectedScore)) / (n - 1)
    return {
      ...row,
      expectedScore,
      actualScore,
      deltaRaw,
      delta: roundHalfAwayFromZero(deltaRaw),
      newRating: 0,
    }
  })

  const balanced = normalizeZeroSum(withScores).map((row) => ({
    ...row,
    newRating: Math.max(minRating, roundHalfAwayFromZero(row.rating + row.delta)),
  }))

  return balanced
}

