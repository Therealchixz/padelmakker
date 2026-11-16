/**
 * Kort over foreslaaede makkere (H-designet, Find makker).
 *
 * Privatliv: appen gemmer kun en placering paa by/postnummer-niveau (ikke en adresse),
 * og det er den samme by og afstand, der allerede staar paa makker-kortene. Naalene
 * spredes desuden i en lille ring om byens midte, saa flere spillere i samme by ikke
 * ligger oven i hinanden. En naal viser altsaa "cirka her i byen", aldrig hvor nogen bor.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import '../styles/makker-map.css';

function initials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return ((parts[0][0] || '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/** Spred naale med samme by-placering i en ring (ca. 350-700 m), fast pr. spiller. */
function spread(players) {
  const groups = new Map();
  for (const p of players) {
    const key = `${Number(p.latitude).toFixed(3)},${Number(p.longitude).toFixed(3)}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(p);
  }
  const out = [];
  for (const list of groups.values()) {
    list.forEach((p, i) => {
      const angle = (i / Math.max(list.length, 3)) * Math.PI * 2 + 0.6;
      const r = 0.004 + (i % 2) * 0.002; // grader breddegrad, ca. 450-670 m
      out.push({
        ...p,
        lat: Number(p.latitude) + Math.sin(angle) * r,
        lng: Number(p.longitude) + (Math.cos(angle) * r) / Math.cos((Number(p.latitude) * Math.PI) / 180),
      });
    });
  }
  return out;
}

export default function MakkerMap({ me, players, selectedId = null, onSelect }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);
  const leafletRef = useRef(null);
  const [ready, setReady] = useState(0);
  const pins = useMemo(() => spread((players || []).filter((p) => p.latitude != null && p.longitude != null)), [players]);
  const pinsKey = pins.map((p) => p.id).join('|');
  const meLat = me?.latitude;
  const meLng = me?.longitude;

  useEffect(() => {
    if (meLat == null || meLng == null || !containerRef.current) return undefined;
    let cancelled = false;
    let ro = null;
    (async () => {
      const L = (await import('leaflet')).default;
      await import('leaflet/dist/leaflet.css');
      if (cancelled || !containerRef.current) return;
      leafletRef.current = L;
      const map = L.map(containerRef.current, {
        center: [meLat, meLng],
        zoom: 12,
        scrollWheelZoom: false,
        zoomControl: false,
        attributionControl: true,
      });
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 15,
      }).addTo(map);
      L.marker([meLat, meLng], {
        icon: L.divIcon({ className: 'pm-home-map-me', iconSize: [16, 16] }),
        interactive: false,
        keyboard: false,
        zIndexOffset: -100,
      }).addTo(map);
      layerRef.current = L.layerGroup().addTo(map);
      mapRef.current = map;
      if (typeof ResizeObserver !== 'undefined') {
        ro = new ResizeObserver(() => {
          map.invalidateSize({ pan: false });
          setReady((n) => n + 1);
        });
        ro.observe(containerRef.current);
      }
      requestAnimationFrame(() => {
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
  }, [meLat, meLng]);

  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!L || !map || !layer) return;
    layer.clearLayers();
    for (const p of pins) {
      const active = String(selectedId) === String(p.id);
      const icon = L.divIcon({
        className: `pm-makker-pin${active ? ' is-active' : ''}`,
        html: `<span class="pm-makker-pin-init">${escapeHtml(initials(p.name))}</span>${p.level ? `<span class="pm-makker-pin-lvl">${escapeHtml(p.level)}</span>` : ''}`,
        iconSize: [44, 44],
        iconAnchor: [22, 22],
      });
      L.marker([p.lat, p.lng], {
        icon,
        title: p.level ? `${p.name}, niveau ${p.level}` : p.name,
        keyboard: false,
        zIndexOffset: active ? 1000 : 0,
      })
        .on('click', () => onSelect?.(p.id))
        .addTo(layer);
    }
    // onSelect er stabil nok til formaalet; naalene tegnes om, naar udvalget eller valget skifter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pinsKey, selectedId, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || meLat == null || meLng == null) return;
    const points = [[meLat, meLng], ...pins.filter((p) => Math.abs(p.lat - meLat) < 0.6 && Math.abs(p.lng - meLng) < 1).map((p) => [p.lat, p.lng])];
    if (points.length > 1) map.fitBounds(points, { paddingTopLeft: [36, 36], paddingBottomRight: [36, 56], maxZoom: 13 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pinsKey, ready, meLat, meLng]);

  return (
    <div className="pm-makker-map">
      <div ref={containerRef} className="pm-makker-map-stage" role="application" aria-label="Kort over foreslåede makkere" />
      <p className="pm-makker-map-note">Nålene viser cirka hvor i byen, ikke en adresse.</p>
    </div>
  );
}
