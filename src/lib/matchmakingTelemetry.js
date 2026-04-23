const EXPOSURE_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const EXPOSURE_MIN_GAP_MS = 3 * 60 * 60 * 1000;
const INVITE_WINDOW_MS = 120 * 24 * 60 * 60 * 1000;

function storageKey(userId) {
  if (userId == null || String(userId).trim() === '') return null;
  return `pm_matchmaking_metrics_${String(userId)}`;
}

function emptyStore() {
  return { exposures: {}, invites: {} };
}

function readStore(userId) {
  const key = storageKey(userId);
  if (!key) return emptyStore();
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return emptyStore();
    const parsed = JSON.parse(raw);
    return {
      exposures: typeof parsed?.exposures === 'object' && parsed.exposures ? parsed.exposures : {},
      invites: typeof parsed?.invites === 'object' && parsed.invites ? parsed.invites : {},
    };
  } catch {
    return emptyStore();
  }
}

function saveStore(userId, store) {
  const key = storageKey(userId);
  if (!key) return;
  try {
    localStorage.setItem(key, JSON.stringify(store));
  } catch {
    /* quota */
  }
}

function pruneStore(store, now = Date.now()) {
  const next = emptyStore();

  Object.entries(store?.exposures || {}).forEach(([candidateId, timestamps]) => {
    const arr = Array.isArray(timestamps)
      ? timestamps
          .map((t) => Number(t))
          .filter((t) => Number.isFinite(t) && now - t <= EXPOSURE_WINDOW_MS)
      : [];
    if (arr.length > 0) next.exposures[String(candidateId)] = arr.slice(-40);
  });

  Object.entries(store?.invites || {}).forEach(([key, record]) => {
    const sentAtMs = new Date(record?.sentAt || 0).getTime();
    if (!Number.isFinite(sentAtMs) || now - sentAtMs > INVITE_WINDOW_MS) return;
    next.invites[key] = {
      candidateId: String(record?.candidateId || ''),
      matchId: record?.matchId != null ? String(record.matchId) : null,
      sentAt: new Date(sentAtMs).toISOString(),
      acceptedAt: record?.acceptedAt || null,
    };
  });

  return next;
}

export function getMatchmakingSignalMaps(userId) {
  const now = Date.now();
  const store = pruneStore(readStore(userId), now);
  saveStore(userId, store);

  const exposureCountByUserId = {};
  Object.entries(store.exposures).forEach(([candidateId, timestamps]) => {
    exposureCountByUserId[candidateId] = Array.isArray(timestamps) ? timestamps.length : 0;
  });

  const inviteStatsByUserId = {};
  Object.values(store.invites).forEach((record) => {
    const candidateId = String(record?.candidateId || '');
    if (!candidateId) return;
    if (!inviteStatsByUserId[candidateId]) {
      inviteStatsByUserId[candidateId] = { sent: 0, accepted: 0, acceptanceRate: 0.5 };
    }
    inviteStatsByUserId[candidateId].sent += 1;
    if (record?.acceptedAt) inviteStatsByUserId[candidateId].accepted += 1;
  });

  Object.values(inviteStatsByUserId).forEach((stats) => {
    stats.acceptanceRate = stats.sent > 0 ? stats.accepted / stats.sent : 0.5;
  });

  return { exposureCountByUserId, inviteStatsByUserId };
}

export function recordSuggestionExposure(userId, candidateIds) {
  if (!Array.isArray(candidateIds) || candidateIds.length === 0) return false;
  const now = Date.now();
  const store = pruneStore(readStore(userId), now);
  let changed = false;

  candidateIds.forEach((candidateIdRaw) => {
    const candidateId = String(candidateIdRaw || '').trim();
    if (!candidateId) return;
    const current = Array.isArray(store.exposures[candidateId]) ? store.exposures[candidateId] : [];
    const lastTs = current.length > 0 ? Number(current[current.length - 1]) : 0;
    if (Number.isFinite(lastTs) && now - lastTs < EXPOSURE_MIN_GAP_MS) return;
    store.exposures[candidateId] = [...current, now].slice(-40);
    changed = true;
  });

  if (!changed) return false;
  saveStore(userId, store);
  return true;
}

export function recordInviteSent(userId, { candidateId, matchId }) {
  const candidate = String(candidateId || '').trim();
  const match = matchId != null ? String(matchId).trim() : '';
  if (!candidate || !match) return false;

  const nowIso = new Date().toISOString();
  const key = `${match}:${candidate}`;
  const now = Date.now();
  const store = pruneStore(readStore(userId), now);
  const existing = store.invites[key];
  const nextSentAt = existing?.sentAt || nowIso;
  const nextAcceptedAt = existing?.acceptedAt || null;
  const didChange =
    !existing ||
    existing.sentAt !== nextSentAt ||
    existing.acceptedAt !== nextAcceptedAt;

  store.invites[key] = {
    candidateId: candidate,
    matchId: match,
    sentAt: nextSentAt,
    acceptedAt: nextAcceptedAt,
  };
  if (!didChange) return false;
  saveStore(userId, store);
  return true;
}

export function getPendingInviteChecks(userId) {
  const now = Date.now();
  const store = pruneStore(readStore(userId), now);
  saveStore(userId, store);

  return Object.values(store.invites)
    .filter((r) => r?.matchId && r?.candidateId && !r?.acceptedAt)
    .map((r) => ({ matchId: String(r.matchId), candidateId: String(r.candidateId) }));
}

export function markInvitesAccepted(userId, pairs) {
  if (!Array.isArray(pairs) || pairs.length === 0) return false;
  const now = Date.now();
  const store = pruneStore(readStore(userId), now);
  const acceptedAtIso = new Date(now).toISOString();
  let changed = false;

  pairs.forEach((pair) => {
    const match = String(pair?.matchId || '').trim();
    const candidate = String(pair?.candidateId || '').trim();
    if (!match || !candidate) return;
    const key = `${match}:${candidate}`;
    const existing = store.invites[key];
    if (!existing) return;
    if (existing.acceptedAt) return;
    store.invites[key] = { ...existing, acceptedAt: acceptedAtIso };
    changed = true;
  });

  if (!changed) return false;
  saveStore(userId, store);
  return true;
}
