import { normalizeStringArrayField, canonicalRegionForForm } from '../lib/profileUtils';
import { DEFAULT_REGION, levelStringFromNum } from '../lib/platformConstants';

export function splitDisplayNameToFirstLast(full) {
  const t = String(full || "").trim();
  const i = t.indexOf(" ");
  if (i === -1) return { first_name: t, last_name: "" };
  return { first_name: t.slice(0, i).trim(), last_name: t.slice(i + 1).trim() };
}

export function profileFormState(p) {
  const { first_name, last_name } = splitDisplayNameToFirstLast(p.full_name || p.name || "");
  return {
    first_name,
    last_name,
    full_name: p.full_name || p.name || "",
    area: canonicalRegionForForm(p.area || p.region || '') || DEFAULT_REGION,
    city: p.city != null ? String(p.city).trim() : '',
    level: levelStringFromNum(p.level) || "",
    play_style: p.play_style || "Ved ikke endnu",
    court_side: p.court_side || "",
    bio: p.bio || "",
    avatar: p.avatar || "🎾",
    availability: normalizeStringArrayField(p.availability),
    available_days: normalizeStringArrayField(p.available_days),
    birth_year: p.birth_year ? String(p.birth_year) : "",
    birth_month: p.birth_month ? String(p.birth_month) : "",
    birth_day: p.birth_day ? String(p.birth_day) : "",
    // Matchmaking
    seeking_match:  p.seeking_match  === true,
    intent_now:     p.intent_now     ?? "",
    travel_willing: p.travel_willing === true,
  };
}
