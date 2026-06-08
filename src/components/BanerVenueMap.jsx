import { useEffect, useRef } from 'react';

/**
 * Lille OSM-kort med én markør — lazy-loader Leaflet når komponenten mountes.
 */
export function BanerVenueMap({ latitude, longitude, title }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);

  useEffect(() => {
    const lat = Number(latitude);
    const lng = Number(longitude);
    if (!containerRef.current || !Number.isFinite(lat) || !Number.isFinite(lng)) return undefined;

    let cancelled = false;

    (async () => {
      const L = (await import('leaflet')).default;
      await import('leaflet/dist/leaflet.css');
      if (cancelled || !containerRef.current) return;

      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }

      const map = L.map(containerRef.current, {
        center: [lat, lng],
        zoom: 15,
        scrollWheelZoom: false,
        attributionControl: true,
        zoomControl: true,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

      L.circleMarker([lat, lng], {
        radius: 9,
        color: '#1d4ed8',
        fillColor: '#2563eb',
        fillOpacity: 0.92,
        weight: 2,
      }).addTo(map);

      mapRef.current = map;
      requestAnimationFrame(() => map.invalidateSize());
    })();

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [latitude, longitude]);

  return (
    <div
      ref={containerRef}
      className="pm-baner-venue-map"
      role="img"
      aria-label={title ? `Kort over ${title}` : 'Kort over centret'}
    />
  );
}
