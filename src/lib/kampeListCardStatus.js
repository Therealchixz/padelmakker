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

export function getKampeDetailStatusBadge({
  status,
  isClosed,
  left,
  isFull,
  statusLabel,
  winnerTeam,
  joined = false,
  myTeam = null,
}) {
  if (status === 'in_progress') {
    return { label: 'LIVE', tone: 'live' };
  }
  if (winnerTeam) {
    const viewerTeam = Number(myTeam);
    if (joined && (viewerTeam === 1 || viewerTeam === 2)) {
      if (viewerTeam === winnerTeam) {
        return { label: 'Du vandt', tone: 'green' };
      }
      return { label: 'Du tabte', tone: 'danger' };
    }
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
