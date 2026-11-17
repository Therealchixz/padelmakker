/**
 * Fælles top på detaljesiden for 2v2-kampe og Americano/Mexicano
 * (ejeren 25. sep. 2026: "2v2 og americano kamp kortet er lidt forskellige").
 *
 * Et kort over stedet med banens navn på en nål (H-designet) og mærker
 * (type · niveau · ledige pladser). Kender vi ikke stedet, vises banen set oppefra
 * med spillernes profilbilleder i stedet. Derunder et kort, hvor dag og tidsrum er
 * overskriften (H-designet: "hvornår" er det, man kigger efter først), og
 * banens navn, "Vis på kort" og små mærker (booket/pris/ulæst) står under.
 */
import { ArrowUpRight } from 'lucide-react';
import { banerMapsDirectionsUrl } from '../../lib/banerMapLinks';
import { PadelCourtTopView } from './PadelCourtTopView';
import { VenueHeroMap, venueCoordsByName } from './VenueHeroMap';

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
 *   me?: { latitude?: unknown, longitude?: unknown } | null,
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
  me = null,
}) {
  const isLive = status?.tone === 'live';
  const venueCoords = venueCoordsByName(venue);
  const visibleTags = tags.filter((t) => t && t.label);
  return (
    <>
      <div className={`pm-kd-hero ${venueCoords ? 'pm-kd-hero--map' : 'pm-kd-hero--court'}`}>
        {venueCoords ? (
          <VenueHeroMap venue={venue} coords={venueCoords} me={me} />
        ) : (
          <PadelCourtTopView className="pm-kd-hero-court" courts={courts} players={players} />
        )}
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
          <h2 className="pm-kd-title">
            {dateHeadline}
            {timeLabel ? <span className="pm-kd-title-time">{timeLabel}</span> : null}
          </h2>
          <p className="pm-kd-venue">{venue}</p>
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
      </div>
    </>
  );
}
