import { CalendarDays, Clock, MapPin, Trophy } from 'lucide-react';
import { shortLigaDate, getLigaBadge } from '../lib/ligaDisplayUtils';

function badgeToneClass(tone) {
  if (tone === 'live') return 'pm-kampe-v2-badge--live';
  if (tone === 'open') return 'pm-kampe-v2-badge--open';
  if (tone === 'full') return 'pm-kampe-v2-badge--full';
  if (tone === 'closed') return 'pm-kampe-v2-badge--closed';
  return 'pm-kampe-v2-badge--neutral';
}

function shortDateLabel(dateVal) {
  return shortLigaDate(dateVal);
}

function teamInitials(name) {
  return String(name || '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() || '')
    .join('') || '?';
}

function hashStr(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

const TEAM_COLORS = ['#16377E', '#059669', '#D97706', '#7C3AED', '#DC2626', '#0891B2'];

function teamColor(teamId) {
  return TEAM_COLORS[hashStr(String(teamId || 'x')) % TEAM_COLORS.length];
}

function MiniStandings({ rows, myTeamId, limit = 3 }) {
  const visible = rows.slice(0, limit);
  return (
    <div className="pm-liga-v2-mini-standings">
      {visible.map((row, index) => {
        const isMine = row.id === myTeamId;
        return (
          <div key={row.id} className={`pm-liga-v2-mini-row${isMine ? ' pm-liga-v2-mini-row--mine' : ''}`}>
            <span className={`pm-liga-v2-mini-rank${index === 0 ? ' pm-liga-v2-mini-rank--first' : ''}`}>{index + 1}</span>
            <span className="pm-liga-v2-mini-name">
              {row.name}
              {isMine ? <span className="pm-liga-v2-mini-you"> · dig</span> : null}
            </span>
            <span className="pm-liga-v2-mini-wl">{row.wins}-{row.losses}</span>
            <span className="pm-liga-v2-mini-pts">{row.points}</span>
          </div>
        );
      })}
    </div>
  );
}

export function LigaListCard({
  league,
  regionLabel = '',
  teams = [],
  regTeams = [],
  standings = [],
  myTeam = null,
  myTeamRank = null,
  nextMatchLabel = null,
  onClick,
}) {
  const isRegistration = league.status === 'registration';
  const isActive = league.status === 'active';
  const isCompleted = league.status === 'completed';
  const maxTeams = league.max_teams || regTeams.length || teams.length;
  const filled = isRegistration ? regTeams.length : teams.length;
  const fillPct = maxTeams > 0 ? Math.min(100, Math.round((filled / maxTeams) * 100)) : 0;
  const totalRounds = league.total_rounds || (maxTeams > 0 ? Math.max(1, maxTeams - 1) : null);

  const { label: badgeLabel, tone: badgeTone } = getLigaBadge(league, {
    regTeamCount: filled,
    maxTeams,
    totalRounds,
  });

  const headerClass = isCompleted
    ? 'pm-liga-v2-list-top pm-liga-v2-list-top--done'
    : 'pm-liga-v2-list-top';

  const previewTeams = isRegistration ? regTeams.slice(0, 4) : [];
  const isFull = Boolean(maxTeams && filled >= maxTeams);
  const myStanding = myTeamRank != null && standings[myTeamRank - 1]
    ? standings[myTeamRank - 1]
    : myTeam && standings.find((t) => t.id === myTeam.id);

  return (
    <button
      type="button"
      id={`pm-liga-${league.id}`}
      className="pm-liga-v2-list-card"
      onClick={onClick}
      aria-label={`Åbn liga: ${league.name}`}
      style={{ scrollMarginTop: '88px' }}
    >
      <div className={headerClass}>
        <div className="pm-liga-v2-list-icon" aria-hidden="true">
          <Trophy size={18} strokeWidth={2} />
        </div>
        <div className="pm-liga-v2-list-top-main">
          <div className="pm-liga-v2-list-type">Liga · Swiss</div>
          <div className="pm-liga-v2-list-title">{league.name}</div>
          <div className="pm-liga-v2-list-meta">
            {isRegistration ? (
              <>
                <CalendarDays size={13} strokeWidth={2} aria-hidden />
                <span>Start {shortDateLabel(league.start_date)}</span>
              </>
            ) : (
              <>
                <MapPin size={11} strokeWidth={2.5} aria-hidden />
                <span>
                  {regionLabel || 'Danmark'}
                  {' · '}
                  {filled} hold
                </span>
              </>
            )}
          </div>
        </div>
        <span className={`pm-kampe-v2-badge pm-liga-v2-list-badge ${badgeToneClass(badgeTone)}`}>
          {badgeTone === 'live' ? <span className="pm-live-dot" aria-hidden /> : null}
          {badgeLabel}
        </span>
      </div>

      <div className="pm-liga-v2-list-body">
        {isRegistration ? (
          <>
            <div className="pm-americano-v2-list-venue">
              <MapPin size={12} aria-hidden />
              {regionLabel || 'Danmark'} · {maxTeams} hold max
            </div>

            <div className="pm-americano-v2-list-progress-row">
              <div
                className={`pm-americano-v2-list-progress${isFull ? ' pm-americano-v2-list-progress--full' : ''}`}
                role="progressbar"
                aria-valuenow={filled}
                aria-valuemin={0}
                aria-valuemax={maxTeams}
                aria-label={`${filled} af ${maxTeams} hold tilmeldt`}
              >
                <div
                  className="pm-americano-v2-list-progress-fill"
                  style={{ width: `${isFull ? 100 : fillPct}%` }}
                />
              </div>
              <span className={`pm-americano-v2-list-progress-count${isFull ? ' pm-americano-v2-list-progress-count--full' : ''}`}>
                {filled}/{maxTeams}
              </span>
            </div>

            <div className="pm-americano-v2-list-footer">
              <div className="pm-americano-v2-list-meta">
                {totalRounds ? (
                  <span className="pm-americano-v2-list-meta-pill">
                    <Clock size={11} aria-hidden />
                    {totalRounds} runder
                  </span>
                ) : null}
                <span className="pm-americano-v2-list-meta-pill">
                  Frist {shortDateLabel(league.end_date)}
                </span>
                <span className="pm-americano-v2-list-meta-pill">2 spillere pr. hold</span>
              </div>

              {previewTeams.length > 0 ? (
                <div className="pm-liga-v2-list-team-preview">
                  <div className="pm-liga-v2-list-team-badges" aria-hidden>
                    {previewTeams.map((t) => (
                      <span
                        key={t.id}
                        className="pm-liga-v2-list-team-badge"
                        style={{ background: `${teamColor(t.id)}22`, color: teamColor(t.id) }}
                      >
                        {teamInitials(t.name)}
                      </span>
                    ))}
                  </div>
                  <span className="pm-liga-v2-list-team-names">
                    {previewTeams.slice(0, 2).map((t) => t.name).join(', ')}
                    {filled > 2 ? ` +${filled - 2} hold` : ''}
                  </span>
                </div>
              ) : null}
            </div>
          </>
        ) : (
          <>
            {myStanding ? (
              <div className={`pm-liga-v2-my-banner${myTeamRank === 1 ? ' pm-liga-v2-my-banner--first' : ''}`}>
                <div className="pm-liga-v2-my-rank">{myTeamRank ?? '—'}</div>
                <div className="pm-liga-v2-my-main">
                  <div className="pm-liga-v2-my-label">{isCompleted ? 'Din slutplacering' : 'Din placering'}</div>
                  <div className="pm-liga-v2-my-name">
                    {myStanding.name}
                    {isCompleted && myTeamRank === 1 ? ' 🏆' : ''}
                  </div>
                </div>
                <div className="pm-liga-v2-my-points">
                  <div className="pm-liga-v2-my-points-val">{myStanding.points}</div>
                  <div className="pm-liga-v2-my-points-lbl">POINT</div>
                </div>
              </div>
            ) : null}
            {standings.length > 0 ? (
              <MiniStandings rows={standings} myTeamId={myTeam?.id} />
            ) : null}
            {isActive && nextMatchLabel ? (
              <div className="pm-liga-v2-next-match">
                <Clock size={14} strokeWidth={2.5} aria-hidden />
                <span>{nextMatchLabel}</span>
              </div>
            ) : null}
          </>
        )}
      </div>
    </button>
  );
}
