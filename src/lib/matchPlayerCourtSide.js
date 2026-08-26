/** Venstre/højre på 2v2-banen — gemmes på match_players.court_side. */

export const MATCH_COURT_SIDES = Object.freeze(['left', 'right']);

export function normalizeMatchCourtSide(raw) {
  const v = String(raw || '').trim().toLowerCase();
  if (v === 'right' || v === 'højre' || v === 'hojre') return 'right';
  if (v === 'left' || v === 'venstre') return 'left';
  return null;
}

export function courtSideLabel(side) {
  return normalizeMatchCourtSide(side) === 'right' ? 'Højre' : 'Venstre';
}

export function playerFirstName(player) {
  return String(player?.user_name || '?').trim().split(/\s+/)[0] || '?';
}

/** "Mike · Venstre" — kun side hvis den er valgt. */
export function teamPlayerNameWithSide(player) {
  const name = playerFirstName(player);
  const side = normalizeMatchCourtSide(player?.court_side);
  return side ? `${name} · ${courtSideLabel(side)}` : name;
}

export function oppositeCourtSide(side) {
  return normalizeMatchCourtSide(side) === 'right' ? 'left' : 'right';
}

/** Ledige venstre/højre-pladser på et hold (tomt hold → begge). */
export function freeMatchCourtSides(players) {
  const taken = new Set(
    (Array.isArray(players) ? players : [])
      .map((p) => normalizeMatchCourtSide(p?.court_side))
      .filter(Boolean),
  );
  return MATCH_COURT_SIDES.filter((side) => !taken.has(side));
}

/**
 * To faste pladser pr. hold: venstre og højre.
 * Spillere uden gemt side fylder ledige pladser i tilmeldingsrækkefølge.
 */
export function teamSlotsBySide(players) {
  const list = Array.isArray(players) ? [...players] : [];
  let left = list.find((p) => normalizeMatchCourtSide(p?.court_side) === 'left') || null;
  let right = list.find((p) => normalizeMatchCourtSide(p?.court_side) === 'right') || null;
  const leftovers = list.filter((p) => p !== left && p !== right);
  for (const p of leftovers) {
    if (!left) left = p;
    else if (!right) right = p;
  }
  return [
    { side: 'left', player: left },
    { side: 'right', player: right },
  ];
}

export function sortPlayersByCourtSide(players) {
  const order = { left: 0, right: 1 };
  return [...(players || [])].sort((a, b) => {
    const av = order[normalizeMatchCourtSide(a?.court_side)] ?? 2;
    const bv = order[normalizeMatchCourtSide(b?.court_side)] ?? 2;
    if (av !== bv) return av - bv;
    return String(a?.joined_at || '').localeCompare(String(b?.joined_at || ''));
  });
}

export function courtSideErrorMessage(data) {
  const code = data?.error;
  if (code === 'invalid_side') return 'Vælg venstre eller højre side.';
  if (code === 'match_not_open') return 'Siden kan kun ændres før kampen er afsluttet.';
  if (code === 'not_authorized') return 'Du har ikke lov til at ændre denne placering.';
  if (code === 'player_not_in_match') return 'Spilleren er ikke i kampen.';
  if (code === 'match_not_found') return 'Kampen blev ikke fundet.';
  return code || 'Kunne ikke skifte side.';
}
