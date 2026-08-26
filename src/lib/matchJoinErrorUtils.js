const JOIN_ERROR_MESSAGES = {
  not_authenticated: 'Du skal være logget ind.',
  banned: 'Din konto kan ikke tilmelde sig kampe.',
  match_not_found: 'Kampen findes ikke længere.',
  match_closed: 'Denne kamp kræver godkendelse fra opretteren.',
  match_not_open: 'Kampen accepterer ikke tilmeldinger lige nu.',
  match_full: 'Kampen er allerede fuld.',
  team_full: 'Det hold er fuldt — vælg det andet hold.',
  invalid_team: 'Ugyldigt hold.',
  insert_failed: 'Kunne ikke tilmelde — prøv igen.',
  match_locked: 'Du kan ikke forlade en kamp der er i gang eller afsluttet.',
  not_in_match: 'Du er ikke tilmeldt denne kamp.',
};

const KICK_ERROR_MESSAGES = {
  not_authenticated: 'Du skal være logget ind.',
  match_not_found: 'Kampen findes ikke længere.',
  match_locked: 'Du kan ikke fjerne spillere fra en kamp der er i gang eller afsluttet.',
  not_allowed: 'Kun opretteren eller en admin kan fjerne spillere.',
  not_in_match: 'Spilleren er ikke tilmeldt denne kamp.',
  cannot_kick_self: 'Du kan ikke fjerne dig selv — forlad kampen i stedet.',
};

export function mapJoinMatchError(data, error) {
  if (error) {
    const raw = String(error.message || '');
    if (/unique_team_side|court_side/i.test(raw)) {
      return 'Den side er optaget. Vælg det andet hold, eller opdater siden og prøv igen.';
    }
    if (/duplicate key|unique constraint|already exists/i.test(raw)) {
      return 'Du er allerede tilmeldt. Opdater siden og prøv igen.';
    }
    return raw || 'Kunne ikke tilmelde kampen.';
  }
  const code = data?.error;
  if (code && JOIN_ERROR_MESSAGES[code]) {
    if (code === 'team_full' && data?.team) {
      return `Hold ${data.team} er fuldt — vælg det andet hold.`;
    }
    return JOIN_ERROR_MESSAGES[code];
  }
  if (data?.success === false) return 'Kunne ikke tilmelde kampen.';
  return null;
}

export function mapLeaveMatchError(data, error) {
  if (error) return error.message || 'Kunne ikke forlade kampen.';
  const code = data?.error;
  if (code && JOIN_ERROR_MESSAGES[code]) return JOIN_ERROR_MESSAGES[code];
  if (data?.success === false) return 'Kunne ikke forlade kampen.';
  return null;
}

export function mapKickMatchError(data, error) {
  if (error) return error.message || 'Kunne ikke fjerne spilleren.';
  const code = data?.error;
  if (code && KICK_ERROR_MESSAGES[code]) return KICK_ERROR_MESSAGES[code];
  if (data?.success === false) return 'Kunne ikke fjerne spilleren.';
  return null;
}
