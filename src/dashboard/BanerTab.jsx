import { useState, useCallback, useMemo, useEffect } from 'react';
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

/** @typedef {{ courts: CourtRow[], dateLabel: string, fetchedAt: string, openBookingPath?: string, date?: string }} VenueLoadState */

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
  /** Memberlink (kun link-venues): valgt dato til booking-link */
  const [linkDateByVenue, setLinkDateByVenue] = useState(/** @type {Record<string, string>} */ ({}));
  const [showBookingHelp, setShowBookingHelp] = useState(false);
  /** Kun render centre når region-fold er åben (performance ved 200+ centre). */
  const [expandedRegions, setExpandedRegions] = useState(() => new Set());

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

  const loadHalbookingVenue = useCallback(async (venueId, dateYmd) => {
    setLoadingVenue((m) => ({ ...m, [venueId]: true }));
    setErrorVenue((m) => ({ ...m, [venueId]: null }));
    try {
      const r = await fetch(halbookingSlotsUrl(venueId, dateYmd), { credentials: 'omit' });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j.error || `Fejl ${r.status}`);
      }
      const data = await r.json();
      const today = copenhagenDateYmd();
      const courtsRaw = data.courts || [];
      const courts = filterPastSlotsIfToday(courtsRaw, data.scheduleDate || null, today);
      const sched = data.scheduleDate || dateYmd || null;
      if (sched) {
        setHalbookingDateByVenue((m) => ({ ...m, [venueId]: sched }));
      }
      setByVenue((m) => ({
        ...m,
        [venueId]: {
          courts,
          dateLabel: data.dateLabel || '',
          scheduleDate: data.scheduleDate || null,
          fetchedAt: data.fetchedAt || '',
          openBookingPath: data.openBookingPath || halbookingOpenVenueUrl(venueId),
        },
      }));
    } catch (e) {
      console.error(e);
      setErrorVenue((m) => ({ ...m, [venueId]: e.message || 'Kunne ikke hente tider' }));
      setByVenue((m) => ({ ...m, [venueId]: null }));
    } finally {
      setLoadingVenue((m) => ({ ...m, [venueId]: false }));
    }
  }, []);

  const loadBookliVenue = useCallback(async (venueId, dateYmd) => {
    setLoadingVenue((m) => ({ ...m, [venueId]: true }));
    setErrorVenue((m) => ({ ...m, [venueId]: null }));
    try {
      const r = await fetch(bookliSlotsUrl(venueId, dateYmd), { credentials: 'omit' });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j.error || `Fejl ${r.status}`);
      }
      const data = await r.json();
      const today = copenhagenDateYmd();
      const scheduleDate = data.date || dateYmd;
      const courtsRaw = data.courts || [];
      const courts = filterPastSlotsIfToday(courtsRaw, scheduleDate, today);
      setByVenue((m) => ({
        ...m,
        [venueId]: {
          courts,
          dateLabel: data.dateLabel || '',
          scheduleDate,
          fetchedAt: data.fetchedAt || '',
          date: scheduleDate,
        },
      }));
    } catch (e) {
      console.error(e);
      setErrorVenue((m) => ({ ...m, [venueId]: e.message || 'Kunne ikke hente tider' }));
      setByVenue((m) => ({ ...m, [venueId]: null }));
    } finally {
      setLoadingVenue((m) => ({ ...m, [venueId]: false }));
    }
  }, []);

  const loadMatchiVenue = useCallback(async (venueId, dateYmd) => {
    setLoadingVenue((m) => ({ ...m, [venueId]: true }));
    setErrorVenue((m) => ({ ...m, [venueId]: null }));
    try {
      const r = await fetch(matchiSlotsUrl(venueId, dateYmd), { credentials: 'omit' });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j.error || `Fejl ${r.status}`);
      }
      const data = await r.json();
      const today = copenhagenDateYmd();
      const scheduleDate = data.scheduleDate || data.date || dateYmd;
      const courtsRaw = data.courts || [];
      const courts = filterPastSlotsIfToday(courtsRaw, scheduleDate, today);
      setByVenue((m) => ({
        ...m,
        [venueId]: {
          courts,
          dateLabel: data.dateLabel || '',
          scheduleDate,
          fetchedAt: data.fetchedAt || '',
          date: scheduleDate,
        },
      }));
    } catch (e) {
      console.error(e);
      setErrorVenue((m) => ({ ...m, [venueId]: e.message || 'Kunne ikke hente tider' }));
      setByVenue((m) => ({ ...m, [venueId]: null }));
    } finally {
      setLoadingVenue((m) => ({ ...m, [venueId]: false }));
    }
  }, []);

  const openVenue = useCallback((v) => {
    setExpandedVenueId((prev) => {
      const opening = prev !== v.id;
      if (!opening) return null;
      const today = copenhagenDateYmd();
      if (v.kind === 'halbooking') {
        const d = halbookingDateByVenue[v.id] || today;
        if (!halbookingDateByVenue[v.id]) setHalbookingDateByVenue((m) => ({ ...m, [v.id]: today }));
        loadHalbookingVenue(v.id, d);
      } else if (v.kind === 'bookli') {
        const d = bookliDateByVenue[v.id] || today;
        if (!bookliDateByVenue[v.id]) setBookliDateByVenue((m) => ({ ...m, [v.id]: today }));
        loadBookliVenue(v.id, d);
      } else if (v.kind === 'matchi') {
        const d = matchiDateByVenue[v.id] || today;
        if (!matchiDateByVenue[v.id]) setMatchiDateByVenue((m) => ({ ...m, [v.id]: today }));
        loadMatchiVenue(v.id, d);
      } else if (v.kind === 'link') {
        if (!linkDateByVenue[v.id]) setLinkDateByVenue((m) => ({ ...m, [v.id]: today }));
      }
      return v.id;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [halbookingDateByVenue, bookliDateByVenue, matchiDateByVenue, linkDateByVenue, loadHalbookingVenue, loadBookliVenue, loadMatchiVenue]);

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
    if (s.status === 'free') {
      return (
        <a
          key={s.time}
          href={halbookingOpenUrl(v.id, c.name, s.time)}
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
          className="pm-baner-slot-wrap"
          style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}
        >
          <span
            title={hint}
            aria-label={`${s.time} · Ikke bookbar. ${hint}`}
            className={banerSlotClass('blocked_rule')}
          >
            {s.time} · Ikke bookbar
          </span>
          <span style={{ fontSize: 11, lineHeight: 1.3, color: theme.textMid }}>{hint}</span>
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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'max(12px, calc(env(safe-area-inset-top) + 8px)) 0 8px' }}>
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
              PadelMakker giver overblik over centre med åben online-booking (Halbooking, MATCHi, Bookli eller direkte booking-link), hvor vi kan hente eller linke til ledige tider. Selve bookingen foregår altid hos centret. Mangler du et center, tryk på dit navn øverst til højre og vælg &quot;Rapportér fejl&quot;.
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
          const openHref =
            v.kind === 'halbooking'
              ? loaded?.openBookingPath || halbookingOpenVenueUrl(v.id)
              : v.kind === 'bookli' || v.kind === 'link' || v.kind === 'matchi'
                ? v.bookingUrl
                : halbookingOpenVenueUrl(v.id);
          const bookliDate = bookliDateByVenue[v.id] || copenhagenDateYmd();
          const halbookingDate = halbookingDateByVenue[v.id] || copenhagenDateYmd();
          const matchiDate = matchiDateByVenue[v.id] || copenhagenDateYmd();
          const linkDate = linkDateByVenue[v.id] || copenhagenDateYmd();
          const todayYmd = copenhagenDateYmd();

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
              <div style={{ display: 'flex', gap: 8, padding: '0 16px 14px', borderTop: '1px solid var(--pm-border, #E2E8F0)', paddingTop: 12 }}>
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
                        onClick={() => loadMatchiVenue(v.id, matchiDate)}
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
                        onClick={() => loadBookliVenue(v.id, bookliDate)}
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
                        onClick={() => loadHalbookingVenue(v.id, halbookingDate)}
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
