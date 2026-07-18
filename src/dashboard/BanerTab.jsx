import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { theme, btn, inputStyle, heading, tag } from '../lib/platformTheme';
import { BANER_REGION_SUBTITLE } from '../lib/banerRegions';
import {
  groupBanerVenuesByRegion,
  filterGroupedBanerVenuesBySearch,
  halbookingSlotsUrl,
  halbookingOpenUrl,
  halbookingOpenVenueUrl,
  bookliSlotsUrl,
  matchiSlotsUrl,
  matchiFacilityDeepUrl,
  playtomicSlotsUrl,
  playtomicClubDeepUrl,
  memberlinkBookingUrlWithDate,
  copenhagenDateYmd,
  copenhagenAddDaysYmd,
} from '../lib/banerVenues';
import { filterPastSlotsIfToday } from '../lib/banerPastSlots';
import { BanerVenueLocation } from '../components/BanerVenueLocation';
import { MapPin, ExternalLink, RefreshCw, Clock, LogIn, Info, ChevronDown, Search, X } from 'lucide-react';

/**
 * @typedef {{ time: string, status: string, ruleHint?: string }} SlotRow
 * @typedef {{ name: string, slots: SlotRow[], available: string[], id?: string, shortName?: string, headerName?: string }} CourtRow
 */

/** @typedef {{ courts: CourtRow[], dateLabel: string, fetchedAt: string, openBookingPath?: string, date?: string, scheduleDate?: string }} VenueLoadState */

const BANER_CACHE_TTL_MS = 60_000;

function banerSlotClass(status) {
  if (status === 'free') return 'pm-baner-slot pm-baner-slot--free';
  if (status === 'booked') return 'pm-baner-slot pm-baner-slot--booked';
  if (status === 'blocked_rule') return 'pm-baner-slot pm-baner-slot--blocked';
  return 'pm-baner-slot pm-baner-slot--neutral';
}

function DateNavigator({ dateYmd, todayYmd, loading = false, onChangeDate }) {
  const navButtonStyle = (primary = false) => ({
    ...btn(primary, { size: 'sm' }),
    minHeight: '44px',
    opacity: loading ? 0.65 : 1,
    cursor: loading ? 'not-allowed' : 'pointer',
  });

  const changeByDays = (days) => {
    onChangeDate(copenhagenAddDaysYmd(dateYmd, days));
  };

  return (
    <div className="pm-baner-date-nav">
      <button type="button" disabled={loading} onClick={() => changeByDays(-7)} style={navButtonStyle(false)} title="En uge tilbage">
        {'<< 1 uge'}
      </button>
      <button type="button" disabled={loading} onClick={() => changeByDays(-1)} style={navButtonStyle(false)} title="En dag tilbage">
        {'< 1 dag'}
      </button>
      <button type="button" disabled={loading} onClick={() => onChangeDate(todayYmd)} style={navButtonStyle(dateYmd === todayYmd)}>
        I dag
      </button>
      <button type="button" disabled={loading} onClick={() => changeByDays(1)} style={navButtonStyle(false)} title="En dag frem">
        {'1 dag >'}
      </button>
      <button type="button" disabled={loading} onClick={() => changeByDays(7)} style={navButtonStyle(false)} title="En uge frem">
        {'1 uge >>'}
      </button>
    </div>
  );
}

export function BanerTab() {
  const venueGroups = useMemo(() => groupBanerVenuesByRegion(), []);
  const [expandedVenueId, setExpandedVenueId] = useState(/** @type {string | null} */ (null));
  const [venueSearch, setVenueSearch] = useState('');
  const filteredVenueGroups = useMemo(
    () => filterGroupedBanerVenuesBySearch(venueGroups, venueSearch),
    [venueGroups, venueSearch]
  );
  const totalVenueCount = useMemo(
    () => venueGroups.reduce((n, g) => n + g.venues.length, 0),
    [venueGroups]
  );
  const filteredVenueCount = useMemo(
    () => filteredVenueGroups.reduce((n, g) => n + g.venues.length, 0),
    [filteredVenueGroups]
  );

  /** @type {[Record<string, VenueLoadState | null>, function]} */
  const [byVenue, setByVenue] = useState({});
  /** @type {[Record<string, boolean>, function]} */
  const [loadingVenue, setLoadingVenue] = useState({});
  /** @type {[Record<string, string | null>, function]} */
  const [errorVenue, setErrorVenue] = useState({});
  /** Bookli: valgt dato pr. venue (YYYY-MM-DD) */
  const [bookliDateByVenue, setBookliDateByVenue] = useState(/** @type {Record<string, string>} */ ({}));
  /** Halbooking: valgt dato pr. venue (YYYY-MM-DD) */
  const [halbookingDateByVenue, setHalbookingDateByVenue] = useState(/** @type {Record<string, string>} */ ({}));
  /** Matchi: valgt dato pr. venue */
  const [matchiDateByVenue, setMatchiDateByVenue] = useState(/** @type {Record<string, string>} */ ({}));
  /** Playtomic: valgt dato pr. venue */
  const [playtomicDateByVenue, setPlaytomicDateByVenue] = useState(/** @type {Record<string, string>} */ ({}));
  /** Memberlink (kun link-venues): valgt dato til booking-link */
  const [linkDateByVenue, setLinkDateByVenue] = useState(/** @type {Record<string, string>} */ ({}));
  const [showBookingHelp, setShowBookingHelp] = useState(false);
  /** Kun render centre når region-fold er åben (performance ved 200+ centre). */
  const [expandedRegions, setExpandedRegions] = useState(() => new Set());
  /** @type {React.MutableRefObject<Record<string, AbortController>>} */
  const abortByVenueRef = useRef({});
  const byVenueRef = useRef(byVenue);
  byVenueRef.current = byVenue;

  useEffect(() => () => {
    Object.values(abortByVenueRef.current).forEach((ac) => {
      try { ac.abort(); } catch { /* ignore */ }
    });
    abortByVenueRef.current = {};
  }, []);

  const venueHasFreshCache = useCallback((venueId, dateYmd) => {
    const loaded = byVenueRef.current[venueId];
    if (!loaded?.fetchedAt) return false;
    const loadedDate = loaded.scheduleDate || loaded.date;
    if (dateYmd && loadedDate && loadedDate !== dateYmd) return false;
    const ts = Date.parse(loaded.fetchedAt);
    if (!Number.isFinite(ts)) return false;
    return Date.now() - ts < BANER_CACHE_TTL_MS;
  }, []);

  /**
   * @param {string} venueId
   * @param {string} url
   * @param {(data: any, dateYmd: string) => VenueLoadState} mapPayload
   * @param {{ dateYmd: string, force?: boolean }} opts
   */
  const fetchVenueSlots = useCallback(async (venueId, url, mapPayload, opts) => {
    const dateYmd = opts.dateYmd;
    const force = Boolean(opts.force);
    if (!force && venueHasFreshCache(venueId, dateYmd)) return;

    abortByVenueRef.current[venueId]?.abort();
    const ac = new AbortController();
    abortByVenueRef.current[venueId] = ac;

    setLoadingVenue((m) => ({ ...m, [venueId]: true }));
    setErrorVenue((m) => ({ ...m, [venueId]: null }));
    try {
      const r = await fetch(url, { credentials: 'omit', signal: ac.signal });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j.error || `Fejl ${r.status}`);
      }
      const data = await r.json();
      if (ac.signal.aborted) return;
      setByVenue((m) => ({
        ...m,
        [venueId]: mapPayload(data, dateYmd),
      }));
    } catch (e) {
      if (e?.name === 'AbortError') return;
      console.error(e);
      setErrorVenue((m) => ({ ...m, [venueId]: e.message || 'Kunne ikke hente tider' }));
      setByVenue((m) => ({ ...m, [venueId]: null }));
    } finally {
      if (abortByVenueRef.current[venueId] === ac) {
        setLoadingVenue((m) => ({ ...m, [venueId]: false }));
      }
    }
  }, [venueHasFreshCache]);

  useEffect(() => {
    const q = venueSearch.trim();
    if (!q) {
      setExpandedRegions(new Set());
      setExpandedVenueId(null);
      return;
    }
    setExpandedRegions(new Set(filteredVenueGroups.map((g) => g.region)));
  }, [venueSearch, filteredVenueGroups]);

  const closeVenuesInRegion = useCallback((venues) => {
    setExpandedVenueId((prev) => {
      if (prev && venues.some((v) => v.id === prev)) return null;
      return prev;
    });
  }, []);

  const onRegionToggle = useCallback((region, venues, e) => {
    const open = e.currentTarget.open;
    setExpandedRegions((prev) => {
      const next = new Set(prev);
      if (open) next.add(region);
      else next.delete(region);
      return next;
    });
    if (!open) closeVenuesInRegion(venues);
  }, [closeVenuesInRegion]);

  const loadHalbookingVenue = useCallback(async (venueId, dateYmd, opts = {}) => {
    await fetchVenueSlots(
      venueId,
      halbookingSlotsUrl(venueId, dateYmd),
      (data, reqDate) => {
        const today = copenhagenDateYmd();
        const courtsRaw = data.courts || [];
        const courts = filterPastSlotsIfToday(courtsRaw, data.scheduleDate || null, today);
        const sched = data.scheduleDate || reqDate || null;
        if (sched) {
          setHalbookingDateByVenue((m) => ({ ...m, [venueId]: sched }));
        }
        return {
          courts,
          dateLabel: data.dateLabel || '',
          scheduleDate: data.scheduleDate || null,
          fetchedAt: data.fetchedAt || new Date().toISOString(),
          openBookingPath:
            data.openBookingPath || halbookingOpenVenueUrl(venueId, sched || undefined),
        };
      },
      { dateYmd, force: Boolean(opts.force) },
    );
  }, [fetchVenueSlots]);

  const loadBookliVenue = useCallback(async (venueId, dateYmd, opts = {}) => {
    await fetchVenueSlots(
      venueId,
      bookliSlotsUrl(venueId, dateYmd),
      (data, reqDate) => {
        const today = copenhagenDateYmd();
        const scheduleDate = data.date || reqDate;
        const courtsRaw = data.courts || [];
        const courts = filterPastSlotsIfToday(courtsRaw, scheduleDate, today);
        return {
          courts,
          dateLabel: data.dateLabel || '',
          scheduleDate,
          fetchedAt: data.fetchedAt || new Date().toISOString(),
          date: scheduleDate,
        };
      },
      { dateYmd, force: Boolean(opts.force) },
    );
  }, [fetchVenueSlots]);

  const loadMatchiVenue = useCallback(async (venueId, dateYmd, opts = {}) => {
    await fetchVenueSlots(
      venueId,
      matchiSlotsUrl(venueId, dateYmd),
      (data, reqDate) => {
        const today = copenhagenDateYmd();
        const scheduleDate = data.scheduleDate || data.date || reqDate;
        const courtsRaw = data.courts || [];
        const courts = filterPastSlotsIfToday(courtsRaw, scheduleDate, today);
        return {
          courts,
          dateLabel: data.dateLabel || '',
          scheduleDate,
          fetchedAt: data.fetchedAt || new Date().toISOString(),
          date: scheduleDate,
        };
      },
      { dateYmd, force: Boolean(opts.force) },
    );
  }, [fetchVenueSlots]);

  const loadPlaytomicVenue = useCallback(async (venueId, dateYmd, opts = {}) => {
    await fetchVenueSlots(
      venueId,
      playtomicSlotsUrl(venueId, dateYmd),
      (data, reqDate) => {
        const today = copenhagenDateYmd();
        const scheduleDate = data.scheduleDate || data.date || reqDate;
        const courtsRaw = data.courts || [];
        const courts = filterPastSlotsIfToday(courtsRaw, scheduleDate, today);
        return {
          courts,
          dateLabel: data.dateLabel || '',
          scheduleDate,
          fetchedAt: data.fetchedAt || new Date().toISOString(),
          date: scheduleDate,
        };
      },
      { dateYmd, force: Boolean(opts.force) },
    );
  }, [fetchVenueSlots]);

  const openVenue = useCallback((v) => {
    setExpandedVenueId((prev) => {
      const opening = prev !== v.id;
      if (!opening) return null;
      const today = copenhagenDateYmd();
      if (v.kind === 'halbooking') {
        const d = halbookingDateByVenue[v.id] || today;
        if (!halbookingDateByVenue[v.id]) setHalbookingDateByVenue((m) => ({ ...m, [v.id]: today }));
        void loadHalbookingVenue(v.id, d, { force: false });
      } else if (v.kind === 'bookli') {
        const d = bookliDateByVenue[v.id] || today;
        if (!bookliDateByVenue[v.id]) setBookliDateByVenue((m) => ({ ...m, [v.id]: today }));
        void loadBookliVenue(v.id, d, { force: false });
      } else if (v.kind === 'matchi') {
        const d = matchiDateByVenue[v.id] || today;
        if (!matchiDateByVenue[v.id]) setMatchiDateByVenue((m) => ({ ...m, [v.id]: today }));
        void loadMatchiVenue(v.id, d, { force: false });
      } else if (v.kind === 'playtomic') {
        const d = playtomicDateByVenue[v.id] || today;
        if (!playtomicDateByVenue[v.id]) setPlaytomicDateByVenue((m) => ({ ...m, [v.id]: today }));
        void loadPlaytomicVenue(v.id, d, { force: false });
      } else if (v.kind === 'link') {
        if (!linkDateByVenue[v.id]) setLinkDateByVenue((m) => ({ ...m, [v.id]: today }));
      }
      return v.id;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [halbookingDateByVenue, bookliDateByVenue, matchiDateByVenue, playtomicDateByVenue, linkDateByVenue, loadHalbookingVenue, loadBookliVenue, loadMatchiVenue, loadPlaytomicVenue]);

  /** Unikke "gul tid"-forklaringer — vises én gang under banens slots i stedet for pr. chip. */
  const renderBlockedRuleNotes = (slots) => {
    const hints = [...new Set(
      (slots || [])
        .filter((s) => s.status === 'blocked_rule')
        .map((s) => s.ruleHint || 'Kan ikke bookes (klubbens regel)'),
    )];
    if (hints.length === 0) return null;
    return (
      <div style={{ marginTop: 4, display: 'flex', flexDirection: 'column', gap: 2 }}>
        {hints.map((hint) => (
          <span key={hint} style={{ fontSize: 11, lineHeight: 1.3, color: theme.textMid }}>
            Gul tid: {hint}
          </span>
        ))}
      </div>
    );
  };

  /**
   * @param {SlotRow} s
   * @param {import('../lib/banerVenues').BanerVenue} v
   * @param {CourtRow} c
   */
  const renderSlot = (s, v, c) => {
    if (s.status === 'free' && v.kind === 'matchi') {
      const d = matchiDateByVenue[v.id] || copenhagenDateYmd();
      return (
        <a
          key={s.time}
          href={matchiFacilityDeepUrl(v, d)}
          target="_blank"
          rel="noopener noreferrer"
          title="Åbner MATCHi med valgt dato — vælg bane og book der"
          className={banerSlotClass('free')}
        >
          {s.time} · Ledig
        </a>
      );
    }
    if (s.status === 'free' && v.kind === 'bookli') {
      return (
        <a
          key={s.time}
          href={v.bookingUrl}
          target="_blank"
          rel="noopener noreferrer"
          title="Åbner Bookli — log ind og vælg bane og tid"
          className={banerSlotClass('free')}
        >
          {s.time} · Ledig
        </a>
      );
    }
    if (s.status === 'free' && v.kind === 'playtomic') {
      const d = playtomicDateByVenue[v.id] || copenhagenDateYmd();
      return (
        <a
          key={s.time}
          href={playtomicClubDeepUrl(v, d)}
          target="_blank"
          rel="noopener noreferrer"
          title="Åbner Playtomic med valgt dato — vælg bane og book der"
          className={banerSlotClass('free')}
        >
          {s.time} · Ledig
        </a>
      );
    }
    if (s.status === 'free') {
      const d =
        halbookingDateByVenue[v.id] || byVenue[v.id]?.scheduleDate || copenhagenDateYmd();
      return (
        <a
          key={s.time}
          href={halbookingOpenUrl(v.id, c.name, s.time, d)}
          target="_blank"
          rel="noopener noreferrer"
          title="Book på Halbooking"
          className={banerSlotClass('free')}
        >
          {s.time} · Ledig
        </a>
      );
    }
    if (s.status === 'booked') {
      return (
        <span
          key={s.time}
          className={banerSlotClass('booked')}
        >
          {s.time} · Optaget
        </span>
      );
    }
    if (s.status === 'blocked_rule') {
      const hint = s.ruleHint || 'Kan ikke bookes (klubbens regel)';
      return (
        <span
          key={s.time}
          title={hint}
          aria-label={`${s.time} · Ikke bookbar. ${hint}`}
          className={banerSlotClass('blocked_rule')}
        >
          {s.time} · Ikke bookbar
        </span>
      );
    }
    return (
      <span
        key={s.time}
        className={banerSlotClass('neutral')}
      >
        {s.time}
      </span>
    );
  };

  return (
    <div className="pm-baner-page">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0 8px' }}>
        <h2 style={{ fontSize: 19, fontWeight: 600, letterSpacing: '-0.3px', color: theme.text, margin: 0 }}>Baner</h2>
      </div>

      <div className="pm-baner-search-row">
        <div className="pm-baner-search-wrap">
          <Search size={16} className="pm-baner-search-icon" aria-hidden />
          <input
            type="text"
            inputMode="search"
            value={venueSearch}
            onChange={(e) => setVenueSearch(e.target.value)}
            placeholder="Søg center, by eller region…"
            className="pm-baner-search-input"
            aria-label="Søg padelcentre"
            autoComplete="off"
            enterKeyHint="search"
          />
          {venueSearch.trim() ? (
            <button
              type="button"
              className="pm-baner-search-clear"
              onClick={() => setVenueSearch('')}
              aria-label="Ryd søgning"
            >
              <X size={16} />
            </button>
          ) : null}
        </div>
        <p className="pm-baner-search-meta" aria-live="polite">
          {venueSearch.trim()
            ? `${filteredVenueCount} af ${totalVenueCount} centre`
            : `${filteredVenueGroups.length} regioner · ${totalVenueCount} centre`}
        </p>
      </div>

      <div className="pm-help-box" style={{ marginBottom: '20px' }}>
        <button
          type="button"
          onClick={() => setShowBookingHelp((v) => !v)}
          className="pm-help-box-toggle"
          aria-expanded={showBookingHelp}
        >
          <span className="pm-help-box-title" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
            <Info size={15} />
            Sådan fungerer banebooking
          </span>
          <span className="pm-help-box-chevron">
            <ChevronDown
              size={16}
              style={{ transform: showBookingHelp ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease' }}
            />
          </span>
        </button>
        {showBookingHelp && (
          <div className="pm-help-box-content" style={{ marginTop: '8px' }}>
            <p className="pm-help-box-copy" style={{ margin: 0 }}>
              Vælg først din region, derefter et center og en dato. Når PadelMakker kan hente tiderne, viser vi dem i listen.
            </p>
            <ul className="pm-help-box-copy" style={{ margin: '10px 0', paddingLeft: '18px' }}>
              <li><strong>Grøn tid:</strong> tiden ser ledig ud. Tryk på tiden eller &quot;Åbn booking&quot; for at booke hos centret.</li>
              <li><strong>Gul tid:</strong> der er en regel eller note til tiden. Læs beskeden før du går videre.</li>
              <li><strong>Ingen tider i listen:</strong> nogle centre viser kun tider på deres egen booking-side. Brug knappen &quot;Åbn booking&quot;.</li>
            </ul>
            <p className="pm-help-box-copy" style={{ margin: '10px 0 0' }}>
              PadelMakker giver overblik over centre med åben online-booking (Halbooking, MATCHi, Bookli, Playtomic eller direkte booking-link), hvor vi kan hente eller linke til ledige tider. Selve bookingen foregår altid hos centret. Mangler du et center, tryk på dit navn øverst til højre og vælg &quot;Rapportér fejl&quot;.
            </p>
          </div>
        )}
      </div>

      {filteredVenueGroups.length === 0 && venueSearch.trim() ? (
        <div className="pm-baner-search-empty pm-ui-card">
          <p style={{ margin: 0, color: theme.textMid, fontSize: '14px' }}>
            Ingen centre matcher «{venueSearch.trim()}». Prøv bynavn, klubnavn eller region (fx Aalborg, MATCHi, Sjælland).
          </p>
          <button type="button" onClick={() => setVenueSearch('')} style={{ ...btn(false), marginTop: '12px', fontSize: '13px' }}>
            Vis alle centre
          </button>
        </div>
      ) : null}

      {filteredVenueGroups.map(({ region, venues }) => (
        <details
          key={region}
          className="pm-baner-region pm-baner-region-fold pm-ui-card"
          open={expandedRegions.has(region)}
          onToggle={(e) => onRegionToggle(region, venues, e)}
        >
          <summary className="pm-baner-region-summary" aria-labelledby={`pm-baner-region-${region}`}>
            <div className="pm-baner-region-summary-text">
              <h3 id={`pm-baner-region-${region}`} className="pm-baner-region-title">
                {region}
                {BANER_REGION_SUBTITLE[region] ? (
                  <span className="pm-baner-region-sub"> ({BANER_REGION_SUBTITLE[region]})</span>
                ) : null}
              </h3>
              <span className="pm-baner-region-count">
                {venues.length} {venues.length === 1 ? 'center' : 'centre'}
              </span>
            </div>
            <ChevronDown size={18} className="pm-baner-region-chevron" aria-hidden />
          </summary>
          {expandedRegions.has(region) ? (
          <div className="pm-baner-region-body">
          <div className="pm-baner-venue-list">
            {venues.map((v) => {
          const loaded = byVenue[v.id];
          const loading = !!loadingVenue[v.id];
          const err = errorVenue[v.id];
          const bookliDate = bookliDateByVenue[v.id] || copenhagenDateYmd();
          const halbookingDate =
            halbookingDateByVenue[v.id] || loaded?.scheduleDate || copenhagenDateYmd();
          const matchiDate = matchiDateByVenue[v.id] || copenhagenDateYmd();
          const playtomicDate = playtomicDateByVenue[v.id] || copenhagenDateYmd();
          const linkDate = linkDateByVenue[v.id] || copenhagenDateYmd();
          const todayYmd = copenhagenDateYmd();
          const openHref =
            v.kind === 'halbooking'
              ? halbookingOpenVenueUrl(v.id, halbookingDate)
              : v.kind === 'playtomic'
                ? playtomicClubDeepUrl(v, playtomicDate)
                : v.kind === 'bookli' || v.kind === 'link' || v.kind === 'matchi'
                  ? v.bookingUrl
                  : halbookingOpenVenueUrl(v.id, halbookingDate);

          const isExpanded = expandedVenueId === v.id;
          return (
            <div
              key={v.id}
              className="pm-baner-venue pm-ui-card"
              style={{ marginBottom: 12 }}
            >
              {/* Card header */}
              <div style={{ padding: '14px 16px 12px' }}>
                <div style={{ fontWeight: 600, fontSize: 14, color: theme.text }}>{v.title}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: theme.textLight, marginTop: 3 }}>
                  <MapPin size={11} />{v.address}
                </div>
                <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                  <span style={{ ...tag('var(--pm-surface-muted)', 'var(--pm-navy)'), border: '1px solid var(--pm-americano-tie-border)' }}>
                    {v.indoor ? 'Indendørs' : 'Udendørs'}
                  </span>
                </div>
              </div>
              {/* CTA buttons row */}
              <div style={{ display: 'flex', gap: 8, padding: '0 16px 14px', borderTop: '1px solid var(--pm-border)', paddingTop: 12 }}>
                <button
                  type="button"
                  onClick={() => openVenue(v)}
                  style={{ flex: 1, ...btn(false), fontSize: 13, padding: '9px 0', fontFamily: 'inherit' }}
                >
                  {isExpanded ? 'Luk' : 'Se center'}
                </button>
                <a
                  href={openHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ flex: 1, ...btn(true), fontSize: 13, padding: '9px 0', textAlign: 'center', textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, fontFamily: 'inherit' }}
                  onClick={(e) => e.stopPropagation()}
                >
                  Book bane
                </a>
              </div>

              {isExpanded ? <div className="pm-baner-venue-body">
                <BanerVenueLocation
                  title={v.title}
                  address={v.address}
                  latitude={v.latitude}
                  longitude={v.longitude}
                />
                {v.kind === 'link' ? (
                  <>
                    <p className="pm-baner-section-title">
                      {v.title} — {linkDate}
                    </p>
                    <DateNavigator
                      dateYmd={linkDate}
                      todayYmd={todayYmd}
                      onChangeDate={(next) => {
                        setLinkDateByVenue((m) => ({ ...m, [v.id]: next }));
                      }}
                    />
                    <div className="pm-baner-toolbar pm-baner-toolbar--spaced">
                      <label className="pm-baner-date-label">
                        Dato
                        <input
                          type="date"
                          value={linkDate}
                          onChange={(e) => setLinkDateByVenue((m) => ({ ...m, [v.id]: e.target.value }))}
                          style={inputStyle}
                        />
                      </label>
                    </div>
                    <p className="pm-baner-note pm-baner-note--body">
                      {v.note ||
                        'Åbn booking-linket: ledige tider vises på centrets side (PadelMakker henter dem ikke ind i listen her).'}
                    </p>
                    <div className="pm-baner-toolbar pm-baner-toolbar--actions">
                      <a
                        href={memberlinkBookingUrlWithDate(v.bookingUrl, linkDate)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="pm-baner-btn-link"
                        style={{ ...btn(true), fontSize: '13px' }}
                      >
                        <ExternalLink size={16} />
                        Åbn booking
                      </a>
                    </div>
                  </>
                ) : v.kind === 'matchi' ? (
                  <>
                    <p className="pm-baner-note">
                      {v.note ||
                        'Oversigt hentes fra MATCHi (offentlig kalender). 30 min. pr. felt — grøn åbner MATCHi med valgt dato.'}
                    </p>
                    <p className="pm-baner-section-title">
                      {loaded?.dateLabel ? `${v.title} — ${loaded.dateLabel}` : `${v.title} — ${matchiDate}`}
                    </p>
                    <DateNavigator
                      dateYmd={matchiDate}
                      todayYmd={todayYmd}
                      loading={loading}
                      onChangeDate={(next) => {
                        setMatchiDateByVenue((m) => ({ ...m, [v.id]: next }));
                        loadMatchiVenue(v.id, next);
                      }}
                    />
                    <div className="pm-baner-toolbar">
                      <label className="pm-baner-date-label">
                        Dato
                        <input
                          type="date"
                          value={matchiDate}
                          onChange={(e) => {
                            const val = e.target.value;
                            setMatchiDateByVenue((m) => ({ ...m, [v.id]: val }));
                            loadMatchiVenue(v.id, val);
                          }}
                          style={inputStyle}
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() => loadMatchiVenue(v.id, matchiDate, { force: true })}
                        disabled={loading}
                        className="pm-baner-btn-icon"
                        style={{ ...btn(false), fontSize: '13px', opacity: loading ? 0.65 : 1 }}
                      >
                        <RefreshCw size={15} className={loading ? 'pm-baner-refresh-spin' : undefined} />
                        Opdater tider
                      </button>
                      <a
                        href={matchiFacilityDeepUrl(v, matchiDate)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="pm-baner-btn-link"
                        style={{ ...btn(true), fontSize: '13px' }}
                      >
                        <ExternalLink size={16} />
                        Åbn MATCHi
                      </a>
                    </div>
                    {loaded?.dateLabel && (
                      <p className="pm-baner-meta">
                        <Clock size={12} className="pm-baner-meta-icon" />
                        {loaded.dateLabel}
                      </p>
                    )}
                    {loaded?.fetchedAt && (
                      <p className="pm-baner-meta pm-baner-meta--fetched">
                        Senest hentet: {new Date(loaded.fetchedAt).toLocaleString('da-DK')}
                      </p>
                    )}
                    {loaded?.scheduleDate && loaded.scheduleDate === copenhagenDateYmd() && (
                      <p className="pm-baner-meta pm-baner-meta--hint">
                        Tider før nu på valgt dag vises ikke — mindre rod i listen.
                      </p>
                    )}
                    {loading && !loaded?.courts?.length && (
                      <div className="pm-baner-status">Henter tider…</div>
                    )}
                    {err && (
                      <div className="pm-baner-error">{err}</div>
                    )}
                    {loaded && loaded.courts.length > 0 && (
                      <div className="pm-baner-courts">
                        {loaded.courts.map((c) => (
                          <div key={c.id || c.headerName || c.name} className="pm-baner-court">
                            <div className="pm-baner-court-name">{c.headerName || c.name}</div>
                            <div className="pm-baner-slots">
                              {c.slots.map((s) => renderSlot(s, v, c))}
                            </div>
                            {renderBlockedRuleNotes(c.slots)}
                          </div>
                        ))}
                      </div>
                    )}
                    {loaded && loaded.courts.length === 0 && !loading && !err && (
                      <div className="pm-baner-status">Ingen ledige tider</div>
                    )}
                  </>
                ) : v.kind === 'playtomic' ? (
                  <>
                    <p className="pm-baner-note">
                      {v.note ||
                        'Ledige tider fra Playtomic. Kun ledige starttider vises — grøn åbner Playtomic med valgt dato.'}
                    </p>
                    <p className="pm-baner-section-title">
                      {loaded?.dateLabel ? `${v.title} — ${loaded.dateLabel}` : `${v.title} — ${playtomicDate}`}
                    </p>
                    <DateNavigator
                      dateYmd={playtomicDate}
                      todayYmd={todayYmd}
                      loading={loading}
                      onChangeDate={(next) => {
                        setPlaytomicDateByVenue((m) => ({ ...m, [v.id]: next }));
                        loadPlaytomicVenue(v.id, next);
                      }}
                    />
                    <div className="pm-baner-toolbar">
                      <label className="pm-baner-date-label">
                        Dato
                        <input
                          type="date"
                          value={playtomicDate}
                          onChange={(e) => {
                            const val = e.target.value;
                            setPlaytomicDateByVenue((m) => ({ ...m, [v.id]: val }));
                            loadPlaytomicVenue(v.id, val);
                          }}
                          style={inputStyle}
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() => loadPlaytomicVenue(v.id, playtomicDate, { force: true })}
                        disabled={loading}
                        className="pm-baner-btn-icon"
                        style={{ ...btn(false), fontSize: '13px', opacity: loading ? 0.65 : 1 }}
                      >
                        <RefreshCw size={15} className={loading ? 'pm-baner-refresh-spin' : undefined} />
                        Opdater tider
                      </button>
                      <a
                        href={playtomicClubDeepUrl(v, playtomicDate)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="pm-baner-btn-link"
                        style={{ ...btn(true), fontSize: '13px' }}
                      >
                        <ExternalLink size={16} />
                        Åbn Playtomic
                      </a>
                    </div>
                    {loaded?.dateLabel && (
                      <p className="pm-baner-meta">
                        <Clock size={12} className="pm-baner-meta-icon" />
                        {loaded.dateLabel}
                      </p>
                    )}
                    {loaded?.fetchedAt && (
                      <p className="pm-baner-meta pm-baner-meta--fetched">
                        Senest hentet: {new Date(loaded.fetchedAt).toLocaleString('da-DK')}
                      </p>
                    )}
                    {loaded?.scheduleDate && loaded.scheduleDate === copenhagenDateYmd() && (
                      <p className="pm-baner-meta pm-baner-meta--hint">
                        Tider før nu på valgt dag vises ikke — mindre rod i listen.
                      </p>
                    )}
                    {loading && !loaded?.courts?.length && (
                      <div className="pm-baner-status">Henter tider…</div>
                    )}
                    {err && (
                      <div className="pm-baner-error">{err}</div>
                    )}
                    {loaded && loaded.courts.length > 0 && (
                      <div className="pm-baner-courts">
                        {loaded.courts.map((c) => (
                          <div key={c.id || c.headerName || c.name} className="pm-baner-court">
                            <div className="pm-baner-court-name">{c.headerName || c.name}</div>
                            <div className="pm-baner-slots">
                              {c.slots.map((s) => renderSlot(s, v, c))}
                            </div>
                            {renderBlockedRuleNotes(c.slots)}
                          </div>
                        ))}
                      </div>
                    )}
                    {loaded && loaded.courts.length === 0 && !loading && !err && (
                      <div className="pm-baner-status">Ingen ledige tider</div>
                    )}
                  </>
                ) : v.kind === 'bookli' ? (
                  <>
                    <p className="pm-baner-note">
                      Data hentes via Booklis offentlige kalender (samme som nederst på padelpadel.dk). 30 min. pr. felt —
                      book efter login.
                    </p>
                    <p className="pm-baner-section-title">
                      {loaded?.dateLabel ? `${v.title} — ${loaded.dateLabel}` : `${v.title} — ${bookliDate}`}
                    </p>
                    <DateNavigator
                      dateYmd={bookliDate}
                      todayYmd={todayYmd}
                      loading={loading}
                      onChangeDate={(next) => {
                        setBookliDateByVenue((m) => ({ ...m, [v.id]: next }));
                        loadBookliVenue(v.id, next);
                      }}
                    />
                    <div className="pm-baner-toolbar">
                      <label className="pm-baner-date-label">
                        Dato
                        <input
                          type="date"
                          value={bookliDate}
                          onChange={(e) => {
                            const val = e.target.value;
                            setBookliDateByVenue((m) => ({ ...m, [v.id]: val }));
                            loadBookliVenue(v.id, val);
                          }}
                          style={inputStyle}
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() => loadBookliVenue(v.id, bookliDate, { force: true })}
                        disabled={loading}
                        className="pm-baner-btn-icon"
                        style={{ ...btn(false), fontSize: '13px', opacity: loading ? 0.65 : 1 }}
                      >
                        <RefreshCw size={15} className={loading ? 'pm-baner-refresh-spin' : undefined} />
                        Opdater tider
                      </button>
                      <a
                        href={v.bookingUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="pm-baner-btn-link"
                        style={{ ...btn(true), fontSize: '13px' }}
                      >
                        <LogIn size={16} />
                        Book (Bookli)
                      </a>
                      <a
                        href={v.infoUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="pm-baner-btn-link"
                        style={{ ...btn(false), fontSize: '13px' }}
                      >
                        <ExternalLink size={16} />
                        Om centret
                      </a>
                    </div>
                    {loaded?.dateLabel && (
                      <p className="pm-baner-meta">
                        <Clock size={12} className="pm-baner-meta-icon" />
                        {loaded.dateLabel}
                      </p>
                    )}
                    {loaded?.fetchedAt && (
                      <p className="pm-baner-meta pm-baner-meta--fetched">
                        Senest hentet: {new Date(loaded.fetchedAt).toLocaleString('da-DK')}
                      </p>
                    )}
                    {loaded?.scheduleDate && loaded.scheduleDate === copenhagenDateYmd() && (
                      <p className="pm-baner-meta pm-baner-meta--hint">
                        Tider før nu på valgt dag vises ikke (PadelPadel/Bookli) — mindre rod i listen.
                      </p>
                    )}
                    {loading && !loaded?.courts?.length && (
                      <div className="pm-baner-status">Henter tider…</div>
                    )}
                    {err && (
                      <div className="pm-baner-error">{err}</div>
                    )}
                    {loaded && loaded.courts.length > 0 && (
                      <div className="pm-baner-courts">
                        {loaded.courts.map((c) => (
                          <div key={c.id || c.headerName || c.name} className="pm-baner-court">
                            <div className="pm-baner-court-name">{c.headerName || c.name}</div>
                            <div className="pm-baner-slots">
                              {c.slots.map((s) => renderSlot(s, v, c))}
                            </div>
                            {renderBlockedRuleNotes(c.slots)}
                          </div>
                        ))}
                      </div>
                    )}
                    {loaded && loaded.courts.length === 0 && !loading && !err && (
                      <div className="pm-baner-status">Ingen ledige tider</div>
                    )}
                  </>
                ) : (
                  <>
                    {loaded?.dateLabel && (
                      <p className="pm-baner-section-title">
                        {v.title} — {loaded.dateLabel}
                      </p>
                    )}
                    <DateNavigator
                      dateYmd={halbookingDate}
                      todayYmd={todayYmd}
                      loading={loading}
                      onChangeDate={(next) => {
                        setHalbookingDateByVenue((m) => ({ ...m, [v.id]: next }));
                        loadHalbookingVenue(v.id, next);
                      }}
                    />
                    <div className="pm-baner-toolbar">
                      <label className="pm-baner-date-label">
                        Dato
                        <input
                          type="date"
                          value={halbookingDate}
                          onChange={(e) => {
                            const val = e.target.value;
                            setHalbookingDateByVenue((m) => ({ ...m, [v.id]: val }));
                            loadHalbookingVenue(v.id, val);
                          }}
                          style={inputStyle}
                        />
                      </label>
                    </div>
                    <div className="pm-baner-toolbar pm-baner-toolbar--actions">
                      <a
                        href={openHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="pm-baner-btn-link"
                        style={{ ...btn(true), fontSize: '13px' }}
                      >
                        <ExternalLink size={16} />
                        Åbn booking
                      </a>
                      <button
                        type="button"
                        onClick={() => loadHalbookingVenue(v.id, halbookingDate, { force: true })}
                        disabled={loading}
                        className="pm-baner-btn-icon"
                        style={{ ...btn(false), fontSize: '13px', opacity: loading ? 0.65 : 1 }}
                      >
                        <RefreshCw size={15} className={loading ? 'pm-baner-refresh-spin' : undefined} />
                        Opdater tider
                      </button>
                    </div>

                    {loaded?.fetchedAt && (
                      <p className="pm-baner-meta pm-baner-meta--fetched">
                        Senest hentet: {new Date(loaded.fetchedAt).toLocaleString('da-DK')}
                      </p>
                    )}
                    {loaded?.scheduleDate && loaded.scheduleDate === copenhagenDateYmd() && (
                      <p className="pm-baner-meta pm-baner-meta--hint">
                        Tider der allerede er passeret i dag vises ikke — mindre rod i listen.
                      </p>
                    )}

                    {loading && !loaded?.courts?.length && (
                      <div className="pm-baner-status">Henter tider…</div>
                    )}

                    {err && (
                      <div className="pm-baner-error">{err}</div>
                    )}

                    {loaded && loaded.courts.length > 0 && (
                      <div className="pm-baner-courts">
                        {loaded.courts.map((c) => (
                          <div key={c.name} className="pm-baner-court">
                            <div className="pm-baner-court-name">{c.name}</div>
                            <div className="pm-baner-slots">
                              {c.slots.map((s) => renderSlot(s, v, c))}
                            </div>
                            {renderBlockedRuleNotes(c.slots)}
                          </div>
                        ))}
                      </div>
                    )}
                    {loaded && loaded.courts.length === 0 && !loading && !err && (
                      <div className="pm-baner-status">Ingen ledige tider</div>
                    )}
                  </>
                )}
              </div>
            : null}
            </div>
          );
            })}
          </div>
          </div>
          ) : null}
        </details>
      ))}
    </div>
  );
}
