import { X, CalendarDays, MapPin, ArrowUpRight, TrendingUp, TrendingDown, Trophy, Share2, RotateCcw } from 'lucide-react';
import { formatMatchDateHeadlineDa, matchTimeLabel } from '../../lib/matchDisplayUtils';
import { getKampeDetailStatusBadge } from '../../lib/kampeListCardStatus';
import { resolveMatchDirectionsQuery } from '../../lib/kampeListFilterCore';
import { banerMapsDirectionsUrl } from '../../lib/banerMapLinks';
import { btn, theme } from '../../lib/platformTheme';
import { useBottomSheetDragToClose } from '../../lib/useBottomSheetDragToClose';
import { MatchResultStrip } from '../MatchResultStrip';
import { MatchCourtView } from './MatchCourtView';
import { AvatarCircle } from '../AvatarCircle';
import { formatPlaytomicLevel } from '../../lib/padelLevelUtils';
import '../../styles/kampdetalje.css';

function computeMatchSets(mr) {
  let setsWon1 = 0, setsWon2 = 0;
  const setScoreStrings = [];
  for (let i = 1; i <= 3; i++) {
    const g1 = mr[`set${i}_team1`];
    const g2 = mr[`set${i}_team2`];
    if (g1 == null || g2 == null) break;
    const n1 = Number(g1), n2 = Number(g2);
    if (n1 + n2 === 0) break;
    setScoreStrings.push(`${n1}-${n2}`);
    if (n1 > n2) setsWon1++;
    else if (n2 > n1) setsWon2++;
  }
  return { setsWon1, setsWon2, setScoreStrings };
}

function CompletedMatchDetail({ matchResult, teamStats, winnerTeam, myTeam, profilesById, currentUserId }) {
  if (!matchResult?.confirmed) return null;

  const { setsWon1, setsWon2, setScoreStrings } = computeMatchSets(matchResult);
  const hasSetScore = setsWon1 + setsWon2 > 0;

  const t1Players = teamStats?.t1 || [];
  const t2Players = teamStats?.t2 || [];
  const eloChangeByUid = teamStats?.playerEloChangeByUserId || {};
  const eloByUid = teamStats?.playerEloByUserId || {};
  const hasEloData = Object.keys(eloChangeByUid).length > 0;

  const teamAvgChange = (players) => {
    const changes = players.map((p) => eloChangeByUid[String(p.user_id)]).filter((n) => n != null);
    if (!changes.length) return null;
    return Math.round(changes.reduce((a, b) => a + b, 0) / changes.length);
  };

  const t1AvgChange = teamAvgChange(t1Players);
  const t2AvgChange = teamAvgChange(t2Players);
  const winnerAvgChange = winnerTeam === 1 ? t1AvgChange : winnerTeam === 2 ? t2AvgChange : null;
  const loserAvgChange = winnerTeam === 1 ? t2AvgChange : winnerTeam === 2 ? t1AvgChange : null;

  const firstName = (p) => {
    const uid = String(p.user_id);
    if (uid === String(currentUserId)) return 'Dig';
    return (profilesById?.[uid]?.name || p.user_name || '?').split(' ')[0];
  };

  const teamLabel = (players, teamNum) => {
    const names = players.map((p) => firstName(p));
    if (!names.length) return `Hold ${teamNum}`;
    return names.join(' & ');
  };

  const isWinnerTeam = (n) => winnerTeam === n;
  const showElo = hasEloData && winnerTeam != null;

  const handleShare = () => {
    const scoreText = hasSetScore ? `${setsWon1}–${setsWon2} (${setScoreStrings.join(', ')})` : (winnerTeam ? `Hold ${winnerTeam} vandt` : 'Afsluttet');
    const text = `Padel-resultat: ${teamLabel(t1Players, 1)} vs ${teamLabel(t2Players, 2)} — ${scoreText}`;
    if (navigator.share) {
      navigator.share({ text }).catch(() => {});
    } else {
      navigator.clipboard?.writeText(text).catch(() => {});
    }
  };

  return (
    <>
      <div className="pm-kd-result-card pm-kd-card" style={{ margin: '8px 0 0' }}>
        <div className="pm-kd-result-badge">
          <span className="pm-kd-tag pm-kd-tag--amber">
            <Trophy size={11} />
            AFSLUTTET
          </span>
        </div>
        <div className="pm-kd-vs-row" style={{ marginTop: 6 }}>
          <div className="pm-kd-vs-score">
            <div className="pm-kd-avstack">
              {t1Players.map((p, i) => (
                <AvatarCircle
                  key={p.user_id}
                  avatar={profilesById?.[String(p.user_id)]?.avatar}
                  size={27}
                  emojiSize="12px"
                  style={{ border: '2px solid #fff', marginLeft: i > 0 ? -9 : 0, background: theme.accentBg }}
                />
              ))}
            </div>
            <b>{teamLabel(t1Players, 1)}</b>
            {isWinnerTeam(1) && (
              <span className="pm-kd-tag pm-kd-tag--amber" style={{ marginTop: 6, display: 'inline-block', fontSize: 9, letterSpacing: '0.6px' }}>
                VINDERE
              </span>
            )}
          </div>
          <div className="pm-kd-set-score">
            {hasSetScore ? (
              <>
                <div className="pm-kd-set-score-big">
                  {setsWon1} <span className="pm-kd-set-score-sep">–</span> {setsWon2}
                </div>
                {setScoreStrings.length > 0 && (
                  <div className="pm-kd-set-score-detail">{setScoreStrings.join(', ')}</div>
                )}
              </>
            ) : (
              <div className="pm-kd-set-score-big" style={{ fontSize: 22 }}>
                {winnerTeam === 1 ? '1' : winnerTeam === 2 ? '0' : '—'}
                {' '}<span className="pm-kd-set-score-sep">–</span>{' '}
                {winnerTeam === 2 ? '1' : winnerTeam === 1 ? '0' : '—'}
              </div>
            )}
          </div>
          <div className="pm-kd-vs-score">
            <div className="pm-kd-avstack" style={{ justifyContent: 'center' }}>
              {t2Players.map((p, i) => (
                <AvatarCircle
                  key={p.user_id}
                  avatar={profilesById?.[String(p.user_id)]?.avatar}
                  size={27}
                  emojiSize="12px"
                  style={{ border: '2px solid #fff', marginLeft: i > 0 ? -9 : 0, background: theme.blueBg }}
                />
              ))}
            </div>
            <b>{teamLabel(t2Players, 2)}</b>
            {isWinnerTeam(2) && (
              <span className="pm-kd-tag pm-kd-tag--amber" style={{ marginTop: 6, display: 'inline-block', fontSize: 9, letterSpacing: '0.6px' }}>
                VINDERE
              </span>
            )}
          </div>
        </div>
      </div>

      {showElo && (
        <>
          <div className="pm-kd-section-h"><h3>Elo-ændringer</h3></div>
          {winnerAvgChange != null && (
            <div className="pm-kd-card pm-kd-elo-card" style={{ marginBottom: 10 }}>
              <div className="pm-kd-feed-ic pm-kd-feed-ic--up"><TrendingUp size={16} /></div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: '13.5px' }}>Vindere</div>
                <div style={{ fontSize: '11.5px', color: theme.textMid, marginTop: 1 }}>Hold-gennemsnit</div>
              </div>
              <span style={{ fontSize: 18, fontWeight: 700, color: theme.green }}>
                {winnerAvgChange >= 0 ? '+' : ''}{winnerAvgChange}
              </span>
            </div>
          )}
          {loserAvgChange != null && (
            <div className="pm-kd-card pm-kd-elo-card" style={{ marginBottom: 0 }}>
              <div className="pm-kd-feed-ic pm-kd-feed-ic--down"><TrendingDown size={16} /></div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: '13.5px' }}>Modstandere</div>
                <div style={{ fontSize: '11.5px', color: theme.textMid, marginTop: 1 }}>Hold-gennemsnit</div>
              </div>
              <span style={{ fontSize: 18, fontWeight: 700, color: theme.red }}>
                {loserAvgChange >= 0 ? '+' : ''}{loserAvgChange}
              </span>
            </div>
          )}
        </>
      )}

      {(t1Players.length + t2Players.length > 0) && (
        <>
          <div className="pm-kd-section-h"><h3>Deltagere</h3></div>
          <div className="pm-kd-card" style={{ padding: '6px 16px' }}>
            {[...t1Players.map((p) => ({ p, teamNum: 1 })), ...t2Players.map((p) => ({ p, teamNum: 2 }))].map(({ p, teamNum }) => {
              const uid = String(p.user_id);
              const prof = profilesById?.[uid] || {};
              const elo = eloByUid[uid];
              const change = eloChangeByUid[uid];
              const won = winnerTeam === teamNum;
              const changeColor = change != null ? (change >= 0 ? theme.green : theme.red) : theme.navy;
              return (
                <div key={p.user_id} className="pm-kd-elo-row">
                  <AvatarCircle
                    avatar={prof.avatar}
                    size={36}
                    emojiSize="16px"
                    style={{ background: teamNum === 1 ? theme.accentBg : theme.blueBg, flexShrink: 0 }}
                  />
                  <div className="pm-kd-elo-pname">
                    {firstName(p)}
                    {prof.level != null && <span>Niveau {formatPlaytomicLevel(prof.level)}</span>}
                  </div>
                  {elo != null && (
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div className="pm-kd-eyebrow">Ny Elo</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: won ? theme.navy : theme.navy }}>
                        {elo}
                        {change != null && (
                          <small style={{ fontSize: '10.5px', color: changeColor, marginLeft: 3 }}>
                            ({change >= 0 ? '+' : ''}{change})
                          </small>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      <div style={{ display: 'flex', gap: 10, padding: '16px 0 8px' }}>
        <button className="pm-kd-btn-ghost" style={{ flex: 1, padding: 12 }} onClick={handleShare} type="button">
          <Share2 size={16} />
          Del resultat
        </button>
        <button className="pm-kd-btn-navy" style={{ flex: 1, padding: 12 }} type="button" disabled>
          <RotateCcw size={16} />
          Book revanche
        </button>
      </div>
      <div style={{ textAlign: 'center', fontSize: '11.5px', fontWeight: 600, color: theme.red, paddingBottom: 18 }}>
        Rapportér fejl i resultatet
      </div>
    </>
  );
}

function badgeToneClass(tone) {
  if (tone === 'live') return 'pm-kampe-v2-badge--live';
  if (tone === 'open') return 'pm-kampe-v2-badge--open';
  if (tone === 'full') return 'pm-kampe-v2-badge--full';
  if (tone === 'closed') return 'pm-kampe-v2-badge--closed';
  if (tone === 'green') return 'pm-kampe-v2-badge--green';
  if (tone === 'danger') return 'pm-kampe-v2-badge--danger';
  return 'pm-kampe-v2-badge--neutral';
}

export function KampeMatchDetailSheet({
  open,
  onClose,
  match,
  profilesById = {},
  matchPrefs,
  statusLabel,
  status,
  isClosed = false,
  left = 0,
  isFull = false,
  teamStats,
  winnerTeam,
  matchResult = null,
  myEloChange = null,
  myTeam = null,
  description,
  primaryAction,
  joinRequestsPanel = null,
  managePanel = null,
  unreadCount = 0,
  joined = false,
  matchId = null,
  busyId = null,
  isCreator = false,
  isAdmin = false,
  currentUserId = null,
  onSwitchTeam,
  onSwitchPlayerTeam,
  onKickPlayer,
  onProfileClick,
}) {
  const { sheetRef, dragZoneProps, sheetStyle, sheetClassName } = useBottomSheetDragToClose({
    onClose,
    enabled: open,
  });

  if (!open || !match) return null;

  const venue =
    matchPrefs?.booked === false && !String(match.court_name || '').trim()
      ? 'Bane ikke booket endnu'
      : (match.court_name || 'Padelbane');
  const directionsQuery = resolveMatchDirectionsQuery(match, profilesById);
  const statusBadge = getKampeDetailStatusBadge({
    status,
    isClosed,
    left,
    isFull,
    statusLabel,
    winnerTeam,
    joined,
    myTeam,
  });

  return (
    <>
      <button
        type="button"
        className="pm-kampe-v2-sheet-backdrop"
        aria-label="Luk kampdetaljer"
        onClick={onClose}
      />
      <div
        ref={sheetRef}
        className={`pm-kampe-v2-sheet pm-kampe-v2-detail-sheet${sheetClassName ? ` ${sheetClassName}` : ''}`}
        style={sheetStyle}
        role="dialog"
        aria-modal="true"
        aria-label="Kampdetaljer"
      >
        <div {...dragZoneProps} aria-label="Træk her for at lukke">
          <div className="pm-kampe-v2-sheet-handle" aria-hidden />
          <div className="pm-kampe-v2-detail-head">
            <div className="pm-kampe-v2-detail-head-toolbar">
              <div className="pm-kampe-v2-detail-type">2v2-kamp</div>
              <div className="pm-kampe-v2-detail-head-right">
                <span className={`pm-kampe-v2-badge ${badgeToneClass(statusBadge.tone)}`}>
                  {statusBadge.tone === 'live' ? <span className="pm-live-dot" /> : null}
                  {statusBadge.label}
                </span>
                <button
                  type="button"
                  className="pm-kampe-v2-detail-close"
                  onClick={onClose}
                  onPointerDown={(event) => event.stopPropagation()}
                  aria-label="Luk"
                >
                  <X size={18} />
                </button>
              </div>
            </div>
            <div className="pm-kampe-v2-detail-head-main">
              <h2 className="pm-kampe-v2-detail-venue">{venue}</h2>
              {(matchPrefs?.min != null && matchPrefs?.max != null) ||
              matchPrefs?.booked != null ||
              unreadCount > 0 ? (
                <div className="pm-kampe-v2-detail-badges-inline">
                  {matchPrefs?.min != null && matchPrefs?.max != null ? (
                    <span className="pm-kampe-v2-badge pm-kampe-v2-badge--blue pm-kampe-v2-detail-meta-badge">
                      ELO {matchPrefs.min}–{matchPrefs.max}
                    </span>
                  ) : null}
                  {matchPrefs?.booked != null ? (
                    <span
                      className={`pm-kampe-v2-badge pm-kampe-v2-detail-meta-badge ${matchPrefs.booked ? 'pm-kampe-v2-badge--green' : 'pm-kampe-v2-badge--warm'}`}
                    >
                      {matchPrefs.booked ? 'Bane booket' : 'Bane ikke booket'}
                    </span>
                  ) : null}
                  {unreadCount > 0 ? (
                    <span className="pm-kampe-v2-badge pm-kampe-v2-badge--warm pm-kampe-v2-detail-meta-badge">
                      {unreadCount} ulæst
                    </span>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <div className="pm-kampe-v2-detail-scroll">

        {/* Court hero visual */}
        <div className="pm-kd-hero" aria-hidden="true">
          <div className="pm-kd-hero-court" />
          <div className="pm-kd-hero-badges">
            <span className="pm-kd-chip pm-kd-chip--navy">2V2</span>
            {matchPrefs?.min != null && matchPrefs?.max != null ? (
              <span className="pm-kd-chip pm-kd-chip--light">ELO {matchPrefs.min}–{matchPrefs.max}</span>
            ) : null}
            {statusBadge.tone === 'live' ? (
              <span className="pm-kd-chip pm-kd-chip--live">LIVE</span>
            ) : null}
          </div>
        </div>

        <div className="pm-kd-card pm-kd-price-card" style={{ marginBottom: 4 }}>
          <div className="pm-kd-info-row" style={{ marginTop: 0 }}>
            <div className="pm-kd-info-ic"><CalendarDays size={18} aria-hidden /></div>
            <div>
              <b>{formatMatchDateHeadlineDa(match.date)}</b>
              <span className="pm-kd-info-sub">{matchTimeLabel(match)}</span>
            </div>
          </div>
          <div className="pm-kd-info-row">
            <div className="pm-kd-info-ic"><MapPin size={18} aria-hidden /></div>
            <div>
              <b>{venue}</b>
              {directionsQuery ? (
                <a
                  className="pm-kd-maplink"
                  href={banerMapsDirectionsUrl(directionsQuery)}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(event) => event.stopPropagation()}
                >
                  Vis på kort <ArrowUpRight size={11} aria-hidden />
                </a>
              ) : null}
            </div>
          </div>
        </div>

        {description ? (
          <>
            <div className="pm-kd-section-h"><h3>Om kampen</h3></div>
            <p className="pm-kd-about">{description}</p>
          </>
        ) : null}

        {status === 'completed' && matchResult?.confirmed ? (
          <CompletedMatchDetail
            matchResult={matchResult}
            teamStats={teamStats}
            winnerTeam={winnerTeam}
            myTeam={myTeam}
            profilesById={profilesById}
            currentUserId={currentUserId}
          />
        ) : (
          <>
            <MatchCourtView
              teamStats={teamStats}
              status={status}
              winnerTeam={winnerTeam}
              profilesById={profilesById}
              readOnly={status === 'completed'}
              joined={joined}
              myTeam={myTeam}
              matchId={matchId}
              busyId={busyId}
              isCreator={isCreator}
              isAdmin={isAdmin}
              currentUserId={currentUserId}
              onSwitchTeam={onSwitchTeam}
              onSwitchPlayerTeam={onSwitchPlayerTeam}
              onKickPlayer={onKickPlayer}
              onProfileClick={onProfileClick}
            />
            {status === 'completed' && matchResult ? (
              <MatchResultStrip
                matchResult={matchResult}
                myTeam={myTeam === 1 ? 'team1' : myTeam === 2 ? 'team2' : null}
                eloChange={myEloChange}
              />
            ) : null}
          </>
        )}

        {joinRequestsPanel}

        {primaryAction ? (
          <button
            type="button"
            className="pm-kampe-v2-detail-primary"
            style={btn(primaryAction.variant !== 'secondary', { size: 'md', fontWeight: 600 })}
            onClick={primaryAction.onClick}
            disabled={primaryAction.disabled}
          >
            {primaryAction.label}
          </button>
        ) : null}

        {managePanel ? (
          <div className="pm-kampe-v2-detail-manage">{managePanel}</div>
        ) : null}
        </div>
      </div>
    </>
  );
}
