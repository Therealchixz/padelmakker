import { useEffect, useMemo, useRef, useState } from 'react';
import { BANER_VENUES } from '../lib/banerVenues';
import { parseGeoCoords } from '../lib/geoDistance';
import { buildNearbyVenues, formatNearbyKm } from '../lib/homeNearbyMap';

/**
 * Kort paa Hjem (redesign v4): padelcentre i naerheden og hvor der er aabne kampe.
 * Indlaeses foerst, naar Hjem viser det (Leaflet og bane-listen er store).
 * Vises kun, naar spilleren har valgt by med placering i sin profil.
 */
export default function HomeNearbyMap({ user, openMatches = [], onSeeMatches, onFindCourt }) {
  const me = useMemo(() => parseGeoCoords(user?.latitude, user?.longitude), [user?.latitude, user?.longitude]);
  const venues = useMemo(() => buildNearbyVenues(BANER_VENUES, me, openMatches), [me, openMatches]);
  const withMatches = useMemo(() => venues.filter((v) => v.matchCount > 0), [venues]);
  const [mode, setMode] = useState(() => (withMatches.length > 0 ? 'kampe' : 'baner'));
  const shown = useMemo(
    () => (mode === 'kampe' && withMatches.length > 0 ? withMatches : venues),
    [mode, withMatches, venues],
  );
  const shownKey = shown.map((v) => v.id).join('|');
  const [selectedId, setSelectedId] = useState(null);
  const selected = shown.find((v) => v.id === selectedId) || shown[0] || null;

  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);
  const leafletRef = useRef(null);
  const [mapReady, setMapReady] = useState(0);

  // Opret kortet een gang.
  useEffect(() => {
    if (!me || !containerRef.current) return undefined;
    let cancelled = false;
    (async () => {
      const L = (await import('leaflet')).default;
      await import('leaflet/dist/leaflet.css');
      if (cancelled || !containerRef.current) return;
      leafletRef.current = L;
      const map = L.map(containerRef.current, {
        center: [me.latitude, me.longitude],
        zoom: 12,
        scrollWheelZoom: false,
        zoomControl: false,
        attributionControl: true,
      });
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 18,
      }).addTo(map);
      L.marker([me.latitude, me.longitude], {
        icon: L.divIcon({ className: 'pm-home-map-me', iconSize: [16, 16] }),
        interactive: false,
        keyboard: false,
      }).addTo(map);
      layerRef.current = L.layerGroup().addTo(map);
      mapRef.current = map;
      requestAnimationFrame(() => map.invalidateSize());
      setMapReady((n) => n + 1);
    })();
    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [me]);


  // Tegn pinde for de viste centre.
  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!L || !map || !layer) return;
    layer.clearLayers();
    for (const v of shown) {
      const active = selected?.id === v.id;
      const label = v.matchCount > 0 ? String(v.matchCount) : '';
      const icon = L.divIcon({
        className: `pm-home-map-pin${v.matchCount > 0 ? ' has-matches' : ''}${active ? ' is-active' : ''}`,
        html: `<span>${label}</span>`,
        iconSize: label ? [34, 30] : [16, 16],
        iconAnchor: label ? [17, 30] : [8, 8],
      });
      L.marker([v.latitude, v.longitude], { icon, title: v.title, keyboard: false })
        .on('click', () => setSelectedId(v.id))
        .addTo(layer);
    }
  }, [shown, selected?.id, mapReady]);

  // Zoom kun ud til centrene, naar listen skifter (ikke naar man vaelger et center).
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !me) return;
    const points = [[me.latitude, me.longitude], ...shown.map((v) => [v.latitude, v.longitude])];
    if (points.length > 1) map.fitBounds(points, { padding: [28, 28], maxZoom: 13 });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- shownKey daekker shown; kun ved nyt udvalg
  }, [shownKey, mapReady, me]);

  if (!me || venues.length === 0) return null;

  return (
    <section className="pm-home-section pm-home-map" aria-labelledby="pm-home-map-title">
      <div className="pm-home-section-head">
        <h2 id="pm-home-map-title" className="pm-home-h">I nærheden</h2>
        <div className="pm-home-map-modes" role="tablist" aria-label="Vis på kortet">
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'kampe'}
            disabled={withMatches.length === 0}
            onClick={() => { setMode('kampe'); setSelectedId(null); }}
          >
            Kampe
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'baner'}
            onClick={() => { setMode('baner'); setSelectedId(null); }}
          >
            Baner
          </button>
        </div>
      </div>
      <div className="pm-home-map-frame">
        <div ref={containerRef} className="pm-home-map-canvas" role="img" aria-label="Kort over padelcentre i nærheden" />
      </div>
      {/* Listen under kortet er den tilgaengelige udgave: alt paa kortet kan ogsaa vaelges her. */}
      <ul className="pm-home-map-list">
        {shown.slice(0, 4).map((v) => (
          <li key={v.id}>
            <button
              type="button"
              className={'pm-home-map-row' + (selected?.id === v.id ? ' is-active' : '')}
              aria-pressed={selected?.id === v.id}
              onClick={() => setSelectedId(v.id)}
            >
              <span className="pm-home-map-row-name">{v.title}</span>
              <span className="pm-home-map-row-meta">
                {formatNearbyKm(v.km)}
                {v.matchCount > 0 ? ` · ${v.matchCount === 1 ? '1 åben kamp' : `${v.matchCount} åbne kampe`}` : ''}
              </span>
            </button>
          </li>
        ))}
      </ul>
      {selected ? (
        <div className="pm-home-map-action">
          {selected.matchCount > 0 ? (
            <button type="button" className="pm-home-map-cta" onClick={() => onSeeMatches?.(selected)}>
              Se kampe i {selected.title}
            </button>
          ) : (
            <button type="button" className="pm-home-map-cta pm-home-map-cta--ink" onClick={() => onFindCourt?.(selected)}>
              Find ledig tid i {selected.title}
            </button>
          )}
        </div>
      ) : null}
    </section>
  );
}
