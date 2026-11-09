import { useEffect, useMemo, useRef, useState } from 'react';
import { BANER_VENUES } from '../lib/banerVenues';
import { parseGeoCoords } from '../lib/geoDistance';
import { buildDemoMatches, buildNearbyVenues, formatNearbyKm, nearbyVenueMeta } from '../lib/homeNearbyMap';

/**
 * Kort paa Hjem (redesign v4, som prototypen): pinde med antal aabne kampe (ler) eller
 * centre (groen), valgt pind i blaek, og en bjaelke under kortet med det valgte center.
 * Indlaeses foerst, naar Hjem viser det (Leaflet og bane-listen er store).
 * Vises kun, naar spilleren har valgt by med placering i sin profil.
 *
 * Centre uden praecis placering (kun byens midte) faar ingen pind, saa kortet aldrig
 * viser et center det forkerte sted. De staar stadig i listen med "ca." foran afstanden.
 * Under "Baner" har alle landets centre med praecis placering en pind (ses, naar man zoomer ud);
 * kortet starter zoomet ind paa de naermeste, og listen viser kun de naermeste.
 * Under "Kampe" vises kun steder med aabne kampe (hele landet), og listen viser de naermeste.
 */
export default function HomeNearbyMap({ user, openMatches = [], onSeeMatches, onCreateMatch, onFindCourt }) {
  const me = useMemo(() => parseGeoCoords(user?.latitude, user?.longitude), [user?.latitude, user?.longitude]);
  // Eksempel-visning (kun for den, der aabner Hjem med ?demo=kampe; slaas fra med ?demo=off).
  // Kampene findes kun i browseren og maerkes "Eksempel".
  const [demo] = useState(() => {
    try {
      const q = new URLSearchParams(window.location.search).get('demo');
      if (q === 'kampe') window.sessionStorage.setItem('pmDemoKampe', '1');
      if (q === 'off') window.sessionStorage.removeItem('pmDemoKampe');
      return window.sessionStorage.getItem('pmDemoKampe') === '1';
    } catch {
      return false;
    }
  });
  const demoMatches = useMemo(
    () => (demo && me ? buildDemoMatches(buildNearbyVenues(BANER_VENUES, me, [], { maxKm: Infinity, limit: Infinity })) : []),
    [demo, me],
  );
  const venues = useMemo(() => buildNearbyVenues(BANER_VENUES, me, openMatches), [me, openMatches]);
  // Forsidens kampliste er kun de 5 nyeste. Kortet henter alle kommende aabne kampe selv
  // (falder tilbage til forsidens liste, hvis det fejler).
  const [allOpenMatches, setAllOpenMatches] = useState(null);
  useEffect(() => {
    if (!me) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const { supabase } = await import('../lib/supabase');
        const today = new Date().toISOString().slice(0, 10);
        const { data, error } = await supabase
          .from('matches')
          .select('id, date, time, court_name')
          .eq('status', 'open')
          .gte('date', today)
          .order('date', { ascending: true })
          .limit(300);
        if (error) throw error;
        if (!cancelled) {
          setAllOpenMatches((data || []).map((m) => ({ matchId: m.id, court: m.court_name || '', date: m.date, time: m.time })));
        }
      } catch {
        /* behold forsidens liste */
      }
    })();
    return () => { cancelled = true; };
  }, [me]);
  // Begge lister samlet (efter kamp-id), saa kortet aldrig viser faerre kampe end forsiden.
  const matchSource = useMemo(() => {
    const byId = new Map();
    for (const m of [...(openMatches || []), ...(allOpenMatches || []), ...demoMatches]) {
      const id = String(m?.matchId ?? '');
      if (id && !byId.has(id)) byId.set(id, m);
    }
    return [...byId.values()];
  }, [openMatches, allOpenMatches, demoMatches]);
  // Alle steder i landet med aabne kampe, naermeste foerst.
  const matchVenues = useMemo(
    () => buildNearbyVenues(BANER_VENUES, me, matchSource, { maxKm: Infinity, limit: Infinity })
      .filter((v) => v.matchCount > 0)
      .sort((a, b) => a.km - b.km),
    [me, matchSource],
  );
  // Kampe uden en kendt bane kan ikke vises paa kortet; de taelles, saa man kan se dem under Kampe.
  const unplacedMatches = useMemo(() => {
    const placed = matchVenues.reduce((n, v) => n + v.matchCount, 0);
    return Math.max(0, (matchSource || []).length - placed);
  }, [matchVenues, matchSource]);
  const [mode, setMode] = useState(() => (demo || venues.some((v) => v.matchCount > 0) ? 'kampe' : 'baner'));
  // Kampe: kun steder med aabne kampe. Baner: centrene i naerheden.
  const shown = mode === 'kampe' ? matchVenues : venues;
  const pinned = useMemo(() => shown.filter((v) => !v.approx), [shown]);
  // Alle centre i landet med praecis placering, saa man ser dem, naar man zoomer ud eller flytter kortet.
  // Listen under kortet og den foerste udsnit viser stadig kun de naermeste.
  const everywhere = useMemo(
    () => buildNearbyVenues(BANER_VENUES, me, matchSource, { maxKm: Infinity, limit: Infinity }).filter((v) => !v.approx),
    [me, matchSource],
  );
  const mapPins = mode === 'kampe' ? pinned : everywhere;
  // Kortet zoomer til de 4 naermeste (ellers trykker et sted langt vaek alle de naere sammen).
  // Kun steder inden for 30 km; er der ingen, saa det naermeste (resten ses ved at zoome ud).
  const framed = useMemo(() => {
    const byKm = pinned.slice().sort((a, b) => a.km - b.km);
    const near = byKm.filter((v) => v.km <= 30).slice(0, 4);
    return near.length ? near : byKm.slice(0, 1);
  }, [pinned]);
  const pinnedKey = `${mode}:${framed.map((v) => v.id).join('|')}`;
  const [selectedId, setSelectedId] = useState(null);
  const selected = shown.find((v) => v.id === selectedId)
    || mapPins.find((v) => v.id === selectedId)
    || pinned[0] || shown[0] || null;
  const placeName = String(user?.city || user?.area || '').trim();

  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);
  const leafletRef = useRef(null);
  const markersRef = useRef(new Map());
  const [mapReady, setMapReady] = useState(0);

  // Opret kortet een gang.
  useEffect(() => {
    if (!me || !containerRef.current) return undefined;
    let cancelled = false;
    let ro = null;
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
        zIndexOffset: -100,
      }).addTo(map);
      layerRef.current = L.layerGroup().addTo(map);
      mapRef.current = map;
      // Zoomet langt ud: mindre pinde, saa landets centre ikke klumper sammen.
      const markFar = () => containerRef.current?.classList.toggle('is-far', map.getZoom() < 10);
      map.on('zoomend', markFar);
      markFar();
      // Kortet kan blive vist, foer det har sin endelige stoerrelse (lazy load, skrifttyper).
      // Uden dette regner fitBounds med en forkert stoerrelse, og centrene havner uden for billedet.
      if (typeof ResizeObserver !== 'undefined') {
        ro = new ResizeObserver(() => {
          map.invalidateSize({ pan: false });
          setMapReady((n) => n + 1);
        });
        ro.observe(containerRef.current);
      }
      requestAnimationFrame(() => {
        map.invalidateSize({ pan: false });
        setMapReady((n) => n + 1);
      });
    })();
    return () => {
      cancelled = true;
      ro?.disconnect();
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      markersRef.current = new Map();
    };
  }, [me]);

  // Tegn pinde for de centre, der har en praecis placering.
  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!L || !map || !layer) return;
    layer.clearLayers();
    markersRef.current = new Map();
    for (const v of mapPins) {
      const active = selected?.id === v.id;
      const label = mode === 'kampe' && v.matchCount > 0 ? String(v.matchCount) : '';
      const tone = active ? 'is-active' : mode === 'kampe' ? 'is-kampe' : 'is-baner';
      const icon = L.divIcon({
        className: `pm-home-map-pin ${tone}${label ? '' : ' is-dot'}`,
        html: `<span class="pm-home-map-pin-head">${label}</span><span class="pm-home-map-pin-stem"></span>`,
        iconSize: label ? [34, 38] : [20, 28],
        iconAnchor: label ? [17, 38] : [10, 28],
      });
      const marker = L.marker([v.latitude, v.longitude], {
        icon,
        title: v.title,
        keyboard: false,
        zIndexOffset: active ? 1000 : 0,
      })
        .on('click', () => setSelectedId(v.id))
        .addTo(layer);
      markersRef.current.set(v.id, marker);
    }
  }, [mapPins, selected?.id, mode, mapReady]);

  // Zoom ud, saa man selv og alle viste centre er med (kun naar udvalget skifter).
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !me) return;
    const points = [[me.latitude, me.longitude], ...framed.map((v) => [v.latitude, v.longitude])];
    if (points.length > 1) map.fitBounds(points, { paddingTopLeft: [40, 96], paddingBottomRight: [40, 40], maxZoom: 14 });
    else map.setView([me.latitude, me.longitude], 13);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- pinnedKey daekker framed; kun ved nyt udvalg
  }, [pinnedKey, mapReady, me]);

  // Valgt center uden for billedet: flyt kortet, saa pinden kan ses.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selected || selected.approx) return;
    map.panInside([selected.latitude, selected.longitude], { padding: [40, 60] });
  }, [selected]);

  if (!me || venues.length === 0) return null;

  const selectMode = (next) => { setMode(next); setSelectedId(null); };
  const cta = !selected
    ? null
    : mode === 'kampe'
      ? (selected.matchCount > 0
        ? { label: 'Se kampe', run: () => onSeeMatches?.(selected) }
        : { label: 'Opret kamp', run: () => onCreateMatch?.(selected) })
      : { label: 'Find tid', run: () => onFindCourt?.(selected) };

  return (
    <section className="pm-home-section pm-home-map" aria-labelledby="pm-home-map-title">
      <div className="pm-home-section-head">
        <h2 id="pm-home-map-title" className="pm-home-h">I nærheden</h2>
      </div>
      <div className="pm-home-map-card">
        <div className="pm-home-map-stage">
          <div ref={containerRef} className="pm-home-map-canvas" role="img" aria-label="Kort over padelcentre i nærheden" />
          <div className="pm-home-map-modes" role="tablist" aria-label="Vis på kortet">
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'kampe'}
              onClick={() => selectMode('kampe')}
            >
              Kampe
            </button>
            <button type="button" role="tab" aria-selected={mode === 'baner'} onClick={() => selectMode('baner')}>
              Baner
            </button>
          </div>
          {placeName ? <div className="pm-home-map-place" aria-hidden="true">Kort · {placeName}</div> : null}
          {demo && mode === 'kampe' ? <div className="pm-home-map-demo">Eksempel</div> : null}
        </div>
        {selected ? (
          <div className="pm-home-map-sel" aria-live="polite">
            <div className="pm-home-map-sel-text">
              <div className="pm-home-map-sel-name">{selected.title}</div>
              <div className="pm-home-map-sel-meta">{nearbyVenueMeta(selected, mode)}</div>
            </div>
            {cta ? (
              <button type="button" className="pm-home-map-sel-cta" onClick={cta.run}>{cta.label}</button>
            ) : null}
          </div>
        ) : mode === 'kampe' ? (
          <div className="pm-home-map-sel" aria-live="polite">
            <div className="pm-home-map-sel-text">
              <div className="pm-home-map-sel-name">Ingen åbne kampe lige nu</div>
              <div className="pm-home-map-sel-meta">Opret en, så kan andre melde sig på</div>
            </div>
            <button type="button" className="pm-home-map-sel-cta" onClick={() => onCreateMatch?.(null)}>Opret kamp</button>
          </div>
        ) : null}
      </div>
      {/* Listen er den tilgaengelige udgave af kortet: alt paa kortet kan ogsaa vaelges her. */}
      <ul className="pm-home-map-list">
        {shown.slice(0, 5).map((v) => (
          <li key={v.id}>
            <button
              type="button"
              className={'pm-home-map-row' + (selected?.id === v.id ? ' is-active' : '')}
              aria-pressed={selected?.id === v.id}
              onClick={() => setSelectedId(v.id)}
            >
              <span className="pm-home-map-row-name">{v.title}</span>
              <span className="pm-home-map-row-meta">
                {mode === 'kampe' && v.matchCount > 0 ? `${v.matchCount} ${v.matchCount === 1 ? 'åben' : 'åbne'} · ` : ''}
                {formatNearbyKm(v.km, v.approx)}
              </span>
            </button>
          </li>
        ))}
        {mode === 'kampe' && unplacedMatches > 0 ? (
          <li>
            <button type="button" className="pm-home-map-row" onClick={() => onSeeMatches?.(null)}>
              <span className="pm-home-map-row-name">
                {unplacedMatches} {unplacedMatches === 1 ? 'kamp' : 'kampe'} uden kendt bane
              </span>
              <span className="pm-home-map-row-meta">Se under Kampe</span>
            </button>
          </li>
        ) : null}
      </ul>
    </section>
  );
}
