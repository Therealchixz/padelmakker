export function clampElo(val, fallback = 1000) {
  if (val === '' || val == null) return Math.round(fallback);
  const n = Number(val);
  if (!Number.isFinite(n)) return Math.round(fallback);
  return Math.max(400, Math.min(3000, Math.round(n)));
}

export function parseMatchLevelRange(raw) {
  const txt = String(raw || '').trim();
  if (!txt) return { min: null, max: null, booked: null };

  const eloPart = /elo:(\d{2,4})-(\d{2,4})/i.exec(txt);
  const bookedPart = /booked:(yes|no)/i.exec(txt);
  if (eloPart || bookedPart) {
    const a = eloPart ? clampElo(eloPart[1]) : null;
    const b = eloPart ? clampElo(eloPart[2]) : null;
    return {
      min: a != null && b != null ? Math.min(a, b) : null,
      max: a != null && b != null ? Math.max(a, b) : null,
      booked: bookedPart ? bookedPart[1].toLowerCase() === 'yes' : null,
    };
  }

  const classicRange = /^(\d{2,4})\s*-\s*(\d{2,4})$/.exec(txt);
  if (classicRange) {
    const a = clampElo(classicRange[1]);
    const b = clampElo(classicRange[2]);
    return { min: Math.min(a, b), max: Math.max(a, b), booked: null };
  }

  const single = /^(\d{2,4})$/.exec(txt);
  if (single) {
    const s = clampElo(single[1]);
    return { min: s, max: s, booked: null };
  }

  return { min: null, max: null, booked: null };
}

export function buildMatchLevelRange(levelMin, levelMax, courtBooked, myElo) {
  const fallback = clampElo(myElo || 1000);
  const a = clampElo(levelMin, fallback - 100);
  const b = clampElo(levelMax, fallback + 100);
  const lo = Math.min(a, b);
  const hi = Math.max(a, b);
  const bookedTag = courtBooked ? 'yes' : 'no';
  return `elo:${lo}-${hi}|booked:${bookedTag}`;
}
