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

export function validateJoinMatch(existingPlayers, userId, teamNum) {
  if (!userId) return "Du skal være logget ind";

  const existing = existingPlayers || [];

  if (existing.some(p => p.user_id === userId)) {
    return "Du er allerede tilmeldt denne kamp";
  }

  const teamCount = existing.filter(p => Number(p.team) === teamNum).length;

  if (teamCount >= 2) {
    return "Holdet er allerede fuldt";
  }

  return null;
}

export function validateResult(result) {
  if (!result?.winner) return "Der skal være en vinder";
  if (!Array.isArray(result.sets) || result.sets.length < 2) {
    return "Mindst 2 sæt kræves";
  }
  return null;
}

export function validateConfirmResult(matchResult, userId) {
  if (!userId) return "Ikke logget ind";
  if (!matchResult) return "Resultat ikke fundet";
  if (matchResult.confirmed) return "Allerede bekræftet";
  if (matchResult.submitted_by === userId) return "Du kan ikke bekræfte dit eget resultat";
  return null;
}
