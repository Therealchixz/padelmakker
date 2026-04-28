export function getMatchStatus(match) {
  return (match?.status ?? 'open').toString().toLowerCase();
}

export function buildMatchSearchIndex(matches = [], matchPlayers = {}) {
  const index = {};
  for (const match of matches) {
    const players = matchPlayers[match.id] || [];
    const playerNames = players.map((player) => (player.user_name || '').toLowerCase()).join(' ');
    const courtName = (match.court_name || '').toLowerCase();
    const description = (match.description || '').toLowerCase();
    const range = (match.level_range || '').toLowerCase();
    index[String(match.id)] = `${playerNames} ${courtName} ${description} ${range}`;
  }
  return index;
}

function matchesSearch(match, searchIndex, searchQuery) {
  const query = searchQuery.trim().toLowerCase();
  if (!query) return true;
  return (searchIndex[String(match.id)] || '').includes(query);
}

export function buildKampeMatchLists({
  matches = [],
  matchPlayers = {},
  matchResults = {},
  joinedMatchIds = new Set(),
  isMine = false,
  currentUserId,
  searchQuery = '',
  completedSortMs = () => 0,
} = {}) {
  const currentUserKey = String(currentUserId);
  const joinedIds = joinedMatchIds instanceof Set ? joinedMatchIds : new Set(joinedMatchIds || []);
  const searchIndex = buildMatchSearchIndex(matches, matchPlayers);

  const openMatches = matches
    .filter((match) => {
      const status = getMatchStatus(match);
      if (status !== 'open' && status !== 'full') return false;
      if ((matchPlayers[match.id] || []).length === 0) return false;
      if (isMine && String(match.creator_id) !== currentUserKey) return false;
      if (!matchesSearch(match, searchIndex, searchQuery)) return false;
      return true;
    })
    .sort((a, b) => {
      const aJoined = joinedIds.has(String(a.id)) ? 1 : 0;
      const bJoined = joinedIds.has(String(b.id)) ? 1 : 0;
      if (bJoined !== aJoined) return bJoined - aJoined;
      return new Date(b.created_at || 0) - new Date(a.created_at || 0);
    });

  const activeMatches = matches.filter((match) => {
    if (getMatchStatus(match) !== 'in_progress') return false;
    if (isMine && !joinedIds.has(String(match.id))) return false;
    if (!matchesSearch(match, searchIndex, searchQuery)) return false;
    return true;
  });

  const completedMatches = matches
    .filter((match) => {
      if (getMatchStatus(match) !== 'completed') return false;
      if (isMine && !joinedIds.has(String(match.id))) return false;
      if (!matchesSearch(match, searchIndex, searchQuery)) return false;
      return true;
    })
    .sort((a, b) => completedSortMs(b, matchResults) - completedSortMs(a, matchResults));

  return {
    openMatches,
    activeMatches,
    completedMatches,
  };
}
