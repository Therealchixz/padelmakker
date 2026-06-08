import { MapPin, Navigation } from 'lucide-react';
import { btn } from '../lib/platformTheme';
import {
  banerMapsDirectionsUrl,
  banerMapsSearchUrl,
  venueHasMapCoords,
} from '../lib/banerMapLinks';
import { BanerVenueMap } from './BanerVenueMap';

/**
 * Kort + links til ekstern kort-app for et banecenter.
 * @param {{ title: string, address: string, latitude?: number, longitude?: number }} props
 */
export function BanerVenueLocation({ title, address, latitude, longitude }) {
  const addr = String(address || '').trim();
  if (!addr) return null;

  const hasCoords = venueHasMapCoords({ latitude, longitude });

  return (
    <section className="pm-baner-venue-location" aria-label="Placering">
      {hasCoords ? (
        <BanerVenueMap latitude={latitude} longitude={longitude} title={title} />
      ) : null}
      <div className="pm-baner-venue-location__actions">
        <a
          href={banerMapsSearchUrl(addr)}
          target="_blank"
          rel="noopener noreferrer"
          className="pm-baner-venue-location__link"
          style={{ ...btn(false), fontSize: '12px' }}
        >
          <MapPin size={14} aria-hidden />
          Vis på kort
        </a>
        <a
          href={banerMapsDirectionsUrl(addr)}
          target="_blank"
          rel="noopener noreferrer"
          className="pm-baner-venue-location__link"
          style={{ ...btn(true), fontSize: '12px' }}
        >
          <Navigation size={14} aria-hidden />
          Rutevejledning
        </a>
      </div>
    </section>
  );
}
