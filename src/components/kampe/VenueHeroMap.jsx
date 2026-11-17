/**
 * Lille kort i toppen af kampdetaljen (H-designet): banens sted med navnet paa en
 * lime naal, og "ca. X km fra dig", naar vi kender spillerens omraade.
 *
 * Stedet findes via banens navn (samme navne som i bane-oversigten). Kender vi ikke
 * banen, returnerer `venueCoordsByName` null, og toppen viser banen set oppefra i stedet.
 */
import { useEffect, useRef } from 'react';
import { BANER_VENUES } from '../../lib/banerVenues';
import { normalizeVenueName } from '../../lib/homeNearbyMap';
import { haversineKm, parseGeoCoords, formatApproxKm } from '../../lib/geoDistance';
import '../../styles/home.css';

const VENUE_BY_NAME = (() => {
  const map = new Map();
  for (const v of BANER_VENUES) {
    const coords = parseGeoCoords(v.latitude, v.longitude);
    const key = normalizeVenueName(v.title || '');
    if (coords && key && !map.has(key)) map.set(key, coords);
  }
  return map;
})();

export function venueCoordsByName(name) {
  const key = normalizeVenueName(name || '');
  return (key && VENUE_BY_NAME.get(key)) || null;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/**
 * @param {{ venue: string, coords: { latitude: number, longitude: number }, me?: { latitude?: unknown, longitude?: unknown } | null }} props
 */
export function VenueHeroMap({ venue, coords, me = null }) {
  const containerRef = useRef(null);
  const myCoords = parseGeoCoords(me?.latitude, me?.longitude);
  const km = myCoords ? haversineKm(myCoords.latitude, myCoords.longitude, coords.latitude, coords.longitude) : null;
  const kmLabel = km != null ? formatApproxKm(km) : null;
  const { latitude, longitude } = coords;

  useEffect(() => {
    if (!containerRef.current) return undefined;
    let cancelled = false;
    let map = null;
    let ro = null;
    (async () => {
      const L = (await import('leaflet')).default;
      await import('leaflet/dist/leaflet.css');
      if (cancelled || !containerRef.current) return;
      // Kortet er et billede af stedet, ikke noget man skal trække rundt i
      // (det ville tage fat i siden, når man ruller). "Vis på kort" åbner det rigtige kort.
      map = L.map(containerRef.current, {
        center: [latitude, longitude],
        zoom: 14,
        zoomControl: false,
        attributionControl: true,
        dragging: false,
        scrollWheelZoom: false,
        doubleClickZoom: false,
        touchZoom: false,
        boxZoom: false,
        keyboard: false,
      });
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 17,
      }).addTo(map);
      const label = String(venue || '').trim();
      const w = Math.min(240, Math.max(72, label.length * 8.6 + 30));
      L.marker([latitude, longitude], {
        icon: L.divIcon({
          className: 'pm-kd-map-pin',
          html: `<span class="pm-kd-map-pin-head">${escapeHtml(label)}</span><span class="pm-kd-map-pin-stem"></span><span class="pm-kd-map-pin-dot"></span>`,
          iconSize: [w, 56],
          iconAnchor: [w / 2, 56],
        }),
        interactive: false,
        keyboard: false,
      }).addTo(map);
      // Naalen staar i den nederste del, saa navnet ikke ligger under maerkerne i toppen.
      const place = () => {
        if (cancelled || !map) return;
        map.invalidateSize({ pan: false });
        const h = containerRef.current?.clientHeight || 0;
        const target = map.project([latitude, longitude], 14).subtract([0, h * 0.2]);
        map.setView(map.unproject(target, 14), 14, { animate: false });
      };
      if (typeof ResizeObserver !== 'undefined') {
        ro = new ResizeObserver(place);
        ro.observe(containerRef.current);
      }
      requestAnimationFrame(place);
    })();
    return () => {
      cancelled = true;
      ro?.disconnect();
      map?.remove();
    };
  }, [latitude, longitude, venue]);

  return (
    <>
      <div
        ref={containerRef}
        className="pm-kd-hero-map"
        role="img"
        aria-label={kmLabel ? `Kort: ${venue}, ca. ${kmLabel} fra dig` : `Kort: ${venue}`}
      />
      {kmLabel ? <span className="pm-kd-hero-km">Ca. {kmLabel} fra dig</span> : null}
    </>
  );
}
