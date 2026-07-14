import { canConfirmPadelMatchResult } from './resolvePadelMatchResult.js';

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
  adminCanAct = false,
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
  const pendingRequests = requestRows.filter((request) => request.status === 'pending');
  const pendingJoinAttention = isCreator && pendingRequests.length > 0 ? pendingRequests.length : 0;
  const unreadMatchCountNum = Number(unreadMatchCount) || 0;
  // Et resultat er indberettet og afventer netop DIN bekræftelse (modstanderholdet)
  const needsResultConfirm = Boolean(
    matchResult
    && !matchResult.confirmed
    && isPlayerInMatch
    && String(matchResult.submitted_by) !== currentUserKey
    && canConfirmPadelMatchResult({
      result: matchResult,
      players,
      confirmedBy: currentUserId,
      isAdmin: false,
    }).ok,
  );
  // Du har selv indberettet et resultat og venter på modstanderens bekræftelse (ingen handling fra dig)
  const waitingForOpponentConfirm = Boolean(
    matchResult
    && !matchResult.confirmed
    && isPlayerInMatch
    && String(matchResult.submitted_by) === currentUserKey,
  );
  // Neutral statuslinje (grå) — ikke en "kræver handling"-markering
  const statusNote = waitingForOpponentConfirm ? 'Venter på modstander' : null;
  // Tydelig grund til at kortet kræver handling (vises på kortet)
  const attentionReason = needsResultConfirm
    ? 'Bekræft resultat'
    : pendingJoinAttention > 0
      ? `${pendingJoinAttention} tilmeldingsanmodning${pendingJoinAttention > 1 ? 'er' : ''}`
      : unreadMatchCountNum > 0
        ? 'Nyt siden sidst'
        : null;
  const hasCreatorTools = Boolean(
    isCreator && (
      (status === 'open' || status === 'full') ||
      (status === 'in_progress' && isPlayerInMatch && !matchResult) ||
      (matchResult && !matchResult.confirmed && isPlayerInMatch) ||
      (status !== 'completed' && status !== 'in_progress')
    ),
  );
  const hasAdminTools = Boolean(
    adminCanAct && isAdmin && !isCreator && (
      (status === 'open' || status === 'full') ||
      (status === 'in_progress' && !isPlayerInMatch && !matchResult) ||
      (matchResult && !matchResult.confirmed && !isPlayerInMatch) ||
      (status !== 'completed' && status !== 'in_progress')
    ),
  );
  const needsAdminPinUnlock = Boolean(
    isAdmin && !adminCanAct && !isCreator && (
      (status === 'open' || status === 'full') ||
      (status === 'in_progress' && !matchResult) ||
      (matchResult && !matchResult.confirmed) ||
      (status !== 'completed' && status !== 'in_progress')
    ),
  );
  const hasAdminActions = hasCreatorTools || hasAdminTools || needsAdminPinUnlock;

  const canUseMatchChat = Boolean(joined || (isAdmin && adminCanAct));
  const needsAdminPinForMatchChat = Boolean(isAdmin && !joined && !adminCanAct);

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
    pendingRequests,
    attentionCount: Math.max(unreadMatchCountNum, pendingJoinAttention, needsResultConfirm ? 1 : 0),
    needsResultConfirm,
    waitingForOpponentConfirm,
    statusNote,
    attentionReason,
    hasAdminActions,
    adminActionsOpen: Boolean(adminActionsOpen),
    canUseMatchChat,
    canWriteMatchChat: Boolean(joined),
    needsAdminPinForMatchChat,
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
