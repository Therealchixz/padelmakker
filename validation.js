export function validateMatch(newMatch) {
  if (!newMatch) return "Ugyldig data";
  if (!newMatch.court_id) return "Vælg en bane";
  if (!newMatch.date) return "Vælg en dato";

  const matchDate = new Date(newMatch.date);
  const today = new Date();
  today.setHours(0,0,0,0);

  if (isNaN(matchDate)) return "Ugyldig dato";
  if (matchDate < today) return "Dato kan ikke være i fortiden";

  return null;
}

export function validateResult(result) {
  if (!result?.winner) return "Der skal være en vinder";
  if (!Array.isArray(result.sets) || result.sets.length < 2) {
    return "Mindst 2 sæt kræves";
  }
  return null;
}
