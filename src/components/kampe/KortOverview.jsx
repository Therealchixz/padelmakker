/**
 * Toppen af Kort-siden (H-designet): et kort med en naal pr. aaben kamp (klokkeslaet paa
 * naalen) og et ark under kortet med den valgte kamp som stort kort og de naeste som
 * korte raekker. Hele listen med faner og filtre staar under arket som foer.
 *
 * Kampe kobles til et sted via banens navn (samme navne som i bane-oversigten). Kampe
 * uden en kendt bane kan ikke staa paa kortet, men er stadig med i arket og listen.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { BANER_VENUES } from '../../lib/banerVenues';
import { normalizeVenueName } from '../../lib/homeNearbyMap';
import { haversineKm, parseGeoCoords, formatApproxKm } from '../../lib/geoDistance';
import '../../styles/home.css';
import '../../styles/kort-overview.css';

function initials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return ((parts[0][0] || '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

const VENUE_BY_NAME = (() => {
  const map = new Map();
  for (const v of BANER_VENUES) {
    const coords = parseGeoCoords(v.latitude, v.longitude);
    const key = normalizeVenueName(v.title || '');
    if (coords && key && !map.has(key)) map.set(key, coords);
  }
  return map;
})();

function leftLabel(n) {
  if (n <= 0) return 'Fuld';
  return n === 1 ? '1 ledig' : `${n} ledige`;
}

export default function KortOverview({ me, matches, onOpen, onShowList }) {
  const myCoords = useMemo(() => parseGeoCoords(me?.latitude, me?.longitude), [me?.latitude, me?.longitude]);
  // Sted og afstand pr. kamp; naermeste foerst, kampe uden kendt bane til sidst.
  const items = useMemo(() => {
    const out = (matches || []).map((m) => {
      const coords = VENUE_BY_NAME.get(normalizeVenueName(m.court || '')) || null;
      const km = coords && myCoords ? haversineKm(myCoords.latitude, myCoords.longitude, coords.latitude, coords.longitude) : null;
      return { ...m, coords, km };
    });
    return out.sort((a, b) => (a.km ?? Infinity) - (b.km ?? Infinity));
  }, [matches, myCoords]);
  const pins = useMemo(() => items.filter((m) => m.coords), [items]);
  const [selectedId, setSelectedId] = useState(null);
  const selected = items.find((m) => String(m.id) === String(selectedId)) || items[0] || null;
  const rest = items.filter((m) => m !== selected).slice(0, 3);

  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);
  const leafletRef = useRef(null);
  const [ready, setReady] = useState(0);
  const lat = myCoords?.latitude;
  const lng = myCoords?.longitude;
  const pinsKey = pins.map((p) => `${p.id}:${p.left}`).join('|');

  useEffect(() => {
    if (lat == null || lng == null || !containerRef.current) return undefined;
    let cancelled = false;
    let ro = null;
    (async () => {
      const L = (await import('leaflet')).default;
      await import('leaflet/dist/leaflet.css');
      if (cancelled || !containerRef.current) return;
      leafletRef.current = L;
      const map = L.map(containerRef.current, {
        center: [lat, lng],
        zoom: 12,
        scrollWheelZoom: false,
        zoomControl: false,
        attributionControl: true,
      });
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 17,
      }).addTo(map);
      L.marker([lat, lng], {
        icon: L.divIcon({ className: 'pm-home-map-me', iconSize: [16, 16] }),
        interactive: false,
        keyboard: false,
        zIndexOffset: -100,
      }).addTo(map);
      layerRef.current = L.layerGroup().addTo(map);
      mapRef.current = map;
      if (typeof ResizeObserver !== 'undefined') {
        ro = new ResizeObserver(() => {
          if (cancelled) return;
          map.invalidateSize({ pan: false });
          setReady((n) => n + 1);
        });
        ro.observe(containerRef.current);
      }
      requestAnimationFrame(() => {
        if (cancelled) return;
        map.invalidateSize({ pan: false });
        setReady((n) => n + 1);
      });
    })();
    return () => {
      cancelled = true;
      ro?.disconnect();
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [lat, lng]);

  // En naal pr. kamp. Flere kampe paa samme sted forskydes lidt, saa alle kan trykkes.
  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!L || !map || !layer) return;
    layer.clearLayers();
    const seen = new Map();
    for (const m of pins) {
      const key = `${m.coords.latitude},${m.coords.longitude}`;
      const n = seen.get(key) || 0;
      seen.set(key, n + 1);
      const active = selected && String(selected.id) === String(m.id);
      const label = active ? `${m.time} · ${leftLabel(m.left)}` : m.time;
      const w = active ? 118 : 58;
      const icon = L.divIcon({
        className: `pm-kort-pin${active ? ' is-active' : ''}`,
        html: `<span class="pm-kort-pin-head">${escapeHtml(label)}</span><span class="pm-kort-pin-stem"></span>`,
        iconSize: [w, 40],
        iconAnchor: [w / 2, 40],
      });
      L.marker([m.coords.latitude + n * 0.0012, m.coords.longitude + n * 0.002], {
        icon,
        title: `${m.court} kl. ${m.time}, ${leftLabel(m.left)}`,
        keyboard: false,
        zIndexOffset: active ? 1000 : 0,
      })
        .on('click', () => setSelectedId(m.id))
        .addTo(layer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pinsKey, selected?.id, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || lat == null || lng == null) return;
    const near = pins.filter((p) => (p.km ?? Infinity) <= 40).slice(0, 6);
    const points = [[lat, lng], ...near.map((p) => [p.coords.latitude, p.coords.longitude])];
    if (points.length > 1) map.fitBounds(points, { paddingTopLeft: [50, 50], paddingBottomRight: [50, 60], maxZoom: 14, animate: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pinsKey, ready, lat, lng]);

  if (!selected) return null;
  const hasMap = lat != null && lng != null;
  const count = items.length;
  const meta = [
    selected.km != null ? formatApproxKm(selected.km) : null,
    selected.durationLabel,
    selected.levelLabel ? `Niveau ${selected.levelLabel}` : null,
  ].filter(Boolean).join(' · ');
  const empties = Math.max(0, Math.min(4, selected.left));

  return (
    <div className="pm-kort-over">
      {hasMap ? (
        <div className="pm-kort-over-map">
          <div ref={containerRef} className="pm-kort-over-stage" role="application" aria-label="Kort over åbne kampe" />
        </div>
      ) : null}
      <section className={hasMap ? 'pm-kort-sheet' : 'pm-kort-sheet pm-kort-sheet--flat'} aria-labelledby="pm-kort-sheet-title">
        <div className="pm-kort-sheet-head">
          <h2 id="pm-kort-sheet-title">{count === 1 ? '1 åben kamp' : `${count} åbne kampe`}{hasMap ? ' nær dig' : ''}</h2>
          <button type="button" className="pm-kort-sheet-link" onClick={onShowList}>Vis liste</button>
        </div>

        <div className="pm-kort-card">
          <button type="button" className="pm-kort-card-top" onClick={() => onOpen(selected.id)}>
            <span className="pm-kort-card-time">
              <b>{selected.time}</b>
              <small>{selected.dayLabel}</small>
            </span>
            <span className="pm-kort-card-copy">
              <span className="pm-kort-card-venue">{selected.court || 'Bane ikke valgt endnu'}</span>
              {meta ? <span className="pm-kort-card-meta">{meta}</span> : null}
            </span>
          </button>
          <div className="pm-kort-card-bottom">
            <span className="pm-kort-faces" aria-label={`${selected.players.length} tilmeldt, ${leftLabel(selected.left)}`}>
              {selected.players.slice(0, 4).map((name, i) => (
                <span key={`${name}-${i}`} className="pm-kort-face">{initials(name)}</span>
              ))}
              {Array.from({ length: empties }, (_, i) => (
                <span key={`tom-${i}`} className="pm-kort-face pm-kort-face--empty" />
              ))}
            </span>
            <span className="pm-kort-card-left">{leftLabel(selected.left)}</span>
            <button type="button" className="pm-kort-card-cta" onClick={() => onOpen(selected.id)}>
              {selected.joined ? 'Åbn kampen' : selected.left > 0 ? 'Tag en plads' : 'Se kampen'}
            </button>
          </div>
        </div>

        {rest.length > 0 ? (
          <div className="pm-kort-rows">
            {rest.map((m) => (
              <button key={m.id} type="button" className="pm-kort-row" onClick={() => (m.coords && hasMap ? setSelectedId(m.id) : onOpen(m.id))}>
                <span className="pm-kort-row-time">
                  <b>{m.time}</b>
                  <small>{m.dayLabel}</small>
                </span>
                <span className="pm-kort-row-venue">{m.court || 'Bane ikke valgt endnu'}</span>
                <span className="pm-kort-row-left">{leftLabel(m.left)}</span>
              </button>
            ))}
          </div>
        ) : null}
      </section>
    </div>
  );
}
