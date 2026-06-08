import { MapPin } from 'lucide-react';
import { banerMapsDirectionsUrl } from '../../lib/banerMapLinks';

/**
 * Lokationslinje under Kampe — åbner rutevejledning i kort-app når query findes.
 */
export function KampeVenueLocationLine({
  label,
  directionsQuery,
  className = '',
  stopPropagation = false,
  iconSize = 12,
}) {
  const text = String(label || '').trim();
  const canNavigate = Boolean(String(directionsQuery || '').trim());
  const classNames = ['pm-kampe-venue-location', className, canNavigate ? 'pm-kampe-venue-location--link' : '']
    .filter(Boolean)
    .join(' ');

  const content = (
    <>
      <MapPin size={iconSize} aria-hidden />
      {text}
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
