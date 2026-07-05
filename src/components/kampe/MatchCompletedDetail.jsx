import { TrendingDown, TrendingUp } from 'lucide-react';
import { AvatarCircle } from '../AvatarCircle';
import { formatMatchResultScore } from '../../lib/matchResultScore';

function teamFirstNames(players, currentUserId) {
  if (!players?.length) return '—';
  return players
    .map((p) => {
      if (currentUserId && String(p.user_id) === String(currentUserId)) return 'Dig';
      return (p.user_name || '?').split(' ')[0];
    })
    .join(' & ');
}

function countSetsWon(matchResult) {
  let t1 = 0;
  let t2 = 0;
  for (let i = 1; i <= 3; i += 1) {
    const g1 = Number(matchResult[`set${i}_team1`]);
    const g2 = Number(matchResult[`set${i}_team2`]);
    if (!Number.isFinite(g1) || !Number.isFinite(g2) || (g1 === 0 && g2 === 0)) continue;
    if (g1 > g2) t1 += 1;
    else if (g2 > g1) t2 += 1;
  }
  return { t1, t2 };
}

function teamAvgEloChange(players, changesById) {
  const values = (players || [])
    .map((p) => changesById?.[String(p.user_id)])
    .filter((c) => c != null);
  if (!values.length) return null;
  return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
}

function TeamAvatars({ players, profilesById }) {
  return (
    <div className="pm-kd-avstack">
      {players.slice(0, 2).map((p) => {
        const prof = profilesById[String(p.user_id)];
        return (
          <AvatarCircle
            key={p.user_id}
            avatar={prof?.avatar || p.user_emoji || '🎾'}
            size={34}
            emojiSize="14px"
          />
        );
      })}
    </div>
  );
}

function EloTeamCard({ label, sublabel, delta, tone }) {
  const isUp = tone === 'up';
  return (
    <div className="pm-kd-card pm-kd-elo-card">
      <div className={`pm-kd-feed-ic ${isUp ? 'pm-kd-feed-ic--up' : 'pm-kd-feed-ic--down'}`}>
        {isUp ? <TrendingUp size={16} aria-hidden /> : <TrendingDown size={16} aria-hidden />}
      </div>
      <div className="pm-kd-elo-card-copy">
        <div className="pm-kd-elo-card-title">{label}</div>
        <div className="pm-kd-elo-card-sub">{sublabel}</div>
      </div>
      {delta != null ? (
        <span className={`pm-kd-elo-card-delta ${isUp ? 'pm-kd-elo-card-delta--up' : 'pm-kd-elo-card-delta--down'}`}>
          {delta >= 0 ? '+' : ''}
          {delta}
        </span>
      ) : null}
    </div>
  );
}

export function MatchCompletedDetail({
  matchResult,
  teamStats,
  winnerTeam,
  currentUserId = null,
  profilesById = {},
}) {
  if (!matchResult?.confirmed || !winnerTeam) return null;

  const t1 = teamStats?.t1 || [];
  const t2 = teamStats?.t2 || [];
  const changes = teamStats?.playerEloChangeByUserId || {};
  const sets = countSetsWon(matchResult);
  const scoreDetail = formatMatchResultScore(matchResult);
  const t1AvgChange = teamAvgEloChange(t1, changes);
  const t2AvgChange = teamAvgEloChange(t2, changes);
  const winnerIsT1 = winnerTeam === 1;
  const winnerAvgChange = winnerIsT1 ? t1AvgChange : t2AvgChange;
  const loserAvgChange = winnerIsT1 ? t2AvgChange : t1AvgChange;

  return (
    <>
      <div className="pm-kd-card pm-kd-result-card">
        <span className="pm-kd-tag pm-kd-tag--amber pm-kd-result-badge">Afsluttet</span>
        <div className="pm-kd-vs-row">
          <div className="pm-kd-vs-score">
            <TeamAvatars players={t1} profilesById={profilesById} />
            <b>{teamFirstNames(t1, currentUserId)}</b>
            {winnerIsT1 ? (
              <span className="pm-kd-tag pm-kd-tag--amber pm-kd-winner-tag">Vindere</span>
            ) : null}
          </div>
          <div className="pm-kd-set-score">
            <div className="pm-kd-set-score-big">
              {sets.t1}
              <span className="pm-kd-set-score-sep"> – </span>
              {sets.t2}
            </div>
            <div className="pm-kd-set-score-detail">{scoreDetail}</div>
          </div>
          <div className="pm-kd-vs-score">
            <TeamAvatars players={t2} profilesById={profilesById} />
            <b>{teamFirstNames(t2, currentUserId)}</b>
            {!winnerIsT1 ? (
              <span className="pm-kd-tag pm-kd-tag--amber pm-kd-winner-tag">Vindere</span>
            ) : null}
          </div>
        </div>
      </div>

      {(winnerAvgChange != null || loserAvgChange != null) ? (
        <>
          <div className="pm-kd-section-h">
            <h3>Elo-ændringer</h3>
          </div>
          {winnerAvgChange != null ? (
            <EloTeamCard
              label="Vindere"
              sublabel="Hold-gennemsnit"
              delta={winnerAvgChange}
              tone="up"
            />
          ) : null}
          {loserAvgChange != null ? (
            <EloTeamCard
              label="Modstandere"
              sublabel="Hold-gennemsnit"
              delta={loserAvgChange}
              tone="down"
            />
          ) : null}
        </>
      ) : null}
    </>
  );
}
