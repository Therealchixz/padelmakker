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

export function mapJoinMatchError(data, error) {
  if (error) return error.message || 'Kunne ikke tilmelde kampen.';
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
