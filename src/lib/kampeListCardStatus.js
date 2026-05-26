export function getKampeListStatusBadge({ status, isClosed, left, isFull }) {
  if (status === 'in_progress') {
    return { label: 'LIVE', tone: 'live' };
  }
  if (status === 'completed') {
    return { label: 'Afsluttet', tone: 'neutral' };
  }
  if (status === 'full' || isFull || (status === 'open' && left === 0)) {
    return { label: 'Fuld', tone: 'full' };
  }
  if (isClosed) {
    return { label: 'Lukket', tone: 'closed' };
  }
  if (status === 'open' && left > 0) {
    return { label: 'Åben', tone: 'open' };
  }
  return { label: 'Åben', tone: 'open' };
}

export function getKampeDetailStatusBadge({ status, isClosed, left, isFull, statusLabel, winnerTeam }) {
  if (status === 'in_progress') {
    return { label: 'LIVE', tone: 'live' };
  }
  if (winnerTeam) {
    return { label: `Hold ${winnerTeam} vandt`, tone: 'green' };
  }
  if (status === 'completed') {
    return { label: 'Afsluttet', tone: 'neutral' };
  }
  if (status === 'full' || isFull || (status === 'open' && left === 0)) {
    return { label: 'Fuld', tone: 'full' };
  }
  if (isClosed) {
    return { label: 'Lukket', tone: 'closed' };
  }
  if (status === 'open' && left > 0) {
    return { label: statusLabel?.text || `${left} ledig${left > 1 ? 'e' : ''}`, tone: 'open' };
  }
  return { label: statusLabel?.text || status, tone: 'neutral' };
}
