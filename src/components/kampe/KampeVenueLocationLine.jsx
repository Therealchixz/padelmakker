import { MapPin, Navigation } from 'lucide-react';
import { banerMapsDirectionsUrl } from '../../lib/banerMapLinks';

/**
 * Lokationslinje i kampdetaljer — åbner rutevejledning i kort-app når query findes.
 * Bruges kun i detail sheets (ikke på listekort).
 */
export function KampeVenueLocationLine({
  label,
  directionsQuery,
  className = '',
  stopPropagation = false,
  iconSize = 12,
  prominent = false,
  variant = 'default',
}) {
  const text = String(label || '').trim();
  const canNavigate = Boolean(String(directionsQuery || '').trim());
  const isTitle = variant === 'title';
  const showProminent = canNavigate && (prominent || isTitle);
  const resolvedIconSize = isTitle ? 14 : iconSize;
  const classNames = [
    'pm-kampe-venue-location',
    className,
    canNavigate ? 'pm-kampe-venue-location--link' : '',
    showProminent ? 'pm-kampe-venue-location--prominent' : '',
    isTitle ? 'pm-kampe-venue-location--title' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const content = (
    <>
      {!isTitle ? <MapPin size={resolvedIconSize} aria-hidden /> : null}
      <span className="pm-kampe-venue-location__label">{text}</span>
      {showProminent ? (
        <Navigation size={resolvedIconSize} className="pm-kampe-venue-location__nav-icon" aria-hidden />
      ) : null}
    </>
  );

  if (!canNavigate) {
    return <div className={classNames}>{content}</div>;
  }

  return (
    <a
      href={banerMapsDirectionsUrl(directionsQuery)}
      target="_blank"
      rel="noopener noreferrer"
      className={classNames}
      aria-label={`Rutevejledning til ${text}`}
      title="Åbn rutevejledning"
      onClick={stopPropagation ? (event) => event.stopPropagation() : undefined}
    >
      {content}
    </a>
  );
}
