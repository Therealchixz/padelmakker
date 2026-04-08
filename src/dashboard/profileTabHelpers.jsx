import { normalizeStringArrayField, canonicalRegionForForm } from '../lib/profileUtils';
import { DEFAULT_REGION } from '../lib/platformConstants';

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
    area: canonicalRegionForForm(p.area || p.region || p.city || '') || DEFAULT_REGION,
    play_style: p.play_style || "Ved ikke endnu",
    bio: p.bio || "",
    avatar: p.avatar || "🎾",
    availability: normalizeStringArrayField(p.availability),
    birth_year: p.birth_year ? String(p.birth_year) : "",
  };
}
