/**
 * Fælles top på detaljesiden for 2v2-kampe og Americano/Mexicano
 * (ejeren 25. sep. 2026: "2v2 og americano kamp kortet er lidt forskellige").
 *
 * Banen set oppefra med spillernes profilbilleder på deres pladser og mærker
 * (type · niveau · ledige pladser). Derunder et kort med banens navn,
 * "Vis på kort", små mærker (booket/pris/ulæst) og dato + tidsrum.
 */
import { ArrowUpRight, CalendarDays } from 'lucide-react';
import { banerMapsDirectionsUrl } from '../../lib/banerMapLinks';
import { PadelCourtTopView } from './PadelCourtTopView';

/**
 * @param {{
 *   typeLabel: string,
 *   levelLabel?: string | null,
 *   status?: { label: string, tone?: string } | null,
 *   venue: string,
 *   directionsQuery?: string | null,
 *   tags?: { label: string, tone?: 'green' | 'amber' | 'navy' | 'red' }[],
 *   dateHeadline: string,
 *   timeLabel?: string | null,
 *   courts?: number,
 *   players?: ({ name?: string, avatar?: string | null } | null)[] | null,
 * }} props
 */
export function EventDetailHero({
  typeLabel,
  levelLabel = null,
  status = null,
  venue,
  directionsQuery = null,
  tags = [],
  dateHeadline,
  timeLabel = null,
  courts = 1,
  players = null,
}) {
  const isLive = status?.tone === 'live';
  const visibleTags = tags.filter((t) => t && t.label);
  return (
    <>
      <div className="pm-kd-hero pm-kd-hero--court">
        <PadelCourtTopView className="pm-kd-hero-court" courts={courts} players={players} />
        <div className="pm-kd-hero-badges">
          <span className="pm-kd-chip pm-kd-chip--navy">{typeLabel}</span>
          {levelLabel ? <span className="pm-kd-chip pm-kd-chip--amber">{levelLabel}</span> : null}
          {status?.label ? (
            <span className={`pm-kd-chip ${isLive ? 'pm-kd-chip--live' : 'pm-kd-chip--light pm-kd-hero-status'}`}>
              {isLive ? <span className="pm-live-dot" /> : null}
              {status.label}
            </span>
          ) : null}
        </div>
      </div>

      <div className="pm-kd-card pm-kd-price-card">
        <div className="pm-kd-title-block">
          <h2 className="pm-kd-title">{venue}</h2>
          {directionsQuery ? (
            <a
              className="pm-kd-maplink pm-kd-maplink--under-title"
              href={banerMapsDirectionsUrl(directionsQuery)}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(event) => event.stopPropagation()}
            >
              Vis på kort <ArrowUpRight size={11} aria-hidden />
            </a>
          ) : null}
        </div>
        {visibleTags.length > 0 ? (
          <div className="pm-kd-price-meta">
            {visibleTags.map((t) => (
              <span key={t.label} className={`pm-kd-tag pm-kd-tag--${t.tone || 'navy'}`}>{t.label}</span>
            ))}
          </div>
        ) : null}
        <div className="pm-kd-info-row">
          <div className="pm-kd-info-ic"><CalendarDays size={18} aria-hidden /></div>
          <div>
            <b>{dateHeadline}</b>
            {timeLabel ? <span className="pm-kd-info-sub">{timeLabel}</span> : null}
          </div>
        </div>
      </div>
    </>
  );
}
