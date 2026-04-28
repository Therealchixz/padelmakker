export function matchStatusLabel(status, left) {
  const labels = {
    open: {
      text: left > 0 ? `${left} ledig${left > 1 ? 'e' : ''}` : 'Fuld',
      tone: left > 0 ? 'accent' : 'warm',
    },
    full: { text: 'Klar til start', tone: 'blue' },
    in_progress: { text: 'I gang', tone: 'warm' },
    completed: { text: 'Afsluttet', tone: 'neutral' },
  };
  return labels[status] || { text: status, tone: 'neutral' };
}

export function buildMatchCardState({
  match,
  players,
  teamStats,
  matchResult,
  joined,
  currentUserId,
  busyId,
  status,
  joinRequests,
  isAdmin,
  adminActionsOpen = false,
  chatOpen = false,
  chatMessages = [],
  chatDraft = '',
  chatLoading = false,
  chatSending = false,
  chatError = '',
  unreadChatCount = 0,
  unreadMatchCount = 0,
}) {
  const t1 = teamStats?.t1 || [];
  const t2 = teamStats?.t2 || [];
  const currentUserKey = String(currentUserId);
  const left = (match?.max_players || 4) - (Array.isArray(players) ? players.length : 0);
  const isCreator = String(match?.creator_id) === currentUserKey;
  const isFull = t1.length >= 2 && t2.length >= 2;
  const isPlayerInMatch = Boolean(joined);
  const myTeam = t1.some((p) => String(p.user_id) === currentUserKey)
    ? 1
    : t2.some((p) => String(p.user_id) === currentUserKey)
      ? 2
      : null;
  const requestRows = Array.isArray(joinRequests) ? joinRequests : [];
  const hasAdminActions = Boolean(isAdmin && (
    ((isCreator || isAdmin) && (status === 'open' || status === 'full')) ||
    (status === 'in_progress' && (isPlayerInMatch || isAdmin) && !matchResult) ||
    (matchResult && !matchResult.confirmed && (isPlayerInMatch || isAdmin)) ||
    ((isCreator || isAdmin) && status !== 'completed' && status !== 'in_progress')
  ));

  return {
    left,
    joined: Boolean(joined),
    isCreator,
    busy: busyId === match?.id,
    status,
    t1,
    t2,
    isFull,
    isPlayerInMatch,
    myTeam,
    isClosed: (match?.match_type || 'open') === 'closed',
    myRequest: requestRows.find((request) => String(request.user_id) === currentUserKey),
    pendingRequests: requestRows.filter((request) => request.status === 'pending'),
    hasAdminActions,
    adminActionsOpen: Boolean(adminActionsOpen),
    canUseMatchChat: Boolean(joined || isAdmin),
    canWriteMatchChat: Boolean(joined),
    chatOpen: Boolean(chatOpen),
    chatMessages: Array.isArray(chatMessages) ? chatMessages : [],
    chatDraft: chatDraft || '',
    chatLoading: Boolean(chatLoading),
    chatSending: Boolean(chatSending),
    chatError: chatError || '',
    unreadChatCount: Number(unreadChatCount) || 0,
    unreadMatchCount: Number(unreadMatchCount) || 0,
    statusLabel: matchStatusLabel(status, left),
  };
}
