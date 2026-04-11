import { useState, useCallback, useRef } from 'react';
import { theme, btn, inputStyle, heading, tag } from '../lib/platformTheme';
import {
  BANER_VENUES,
  halbookingSlotsUrl,
  halbookingOpenUrl,
  halbookingOpenVenueUrl,
  bookliSlotsUrl,
  copenhagenDateYmd,
  copenhagenAddDaysYmd,
} from '../lib/banerVenues';
import { filterPastSlotsIfToday } from '../lib/banerPastSlots';
import { MapPin, Building2, Sun, ExternalLink, RefreshCw, Clock, LogIn } from 'lucide-react';

/**
 * @typedef {{ time: string, status: string, ruleHint?: string }} SlotRow
 * @typedef {{ name: string, slots: SlotRow[], available: string[], id?: string, shortName?: string, headerName?: string }} CourtRow
 */

/** @typedef {{ courts: CourtRow[], dateLabel: string, fetchedAt: string, openBookingPath?: string, date?: string }} VenueLoadState */

export function BanerTab() {
  const detailRefs = useRef(/** @type {Record<string, HTMLDetailsElement | null>} */ ({}));

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

  /** Accordion: kun ét `<details>` åbent ad gangen. */
  const onDetailsToggle = (v, e) => {
    const el = e.currentTarget;
    if (!el.open) return;

    Object.values(detailRefs.current).forEach((node) => {
      if (node && node !== el) node.open = false;
    });

    if (v.kind === 'halbooking') {
      const today = copenhagenDateYmd();
      const d = halbookingDateByVenue[v.id] || today;
      if (!halbookingDateByVenue[v.id]) {
        setHalbookingDateByVenue((m) => ({ ...m, [v.id]: today }));
      }
      loadHalbookingVenue(v.id, d);
    } else if (v.kind === 'bookli') {
      const today = copenhagenDateYmd();
      const d = bookliDateByVenue[v.id] || today;
      if (!bookliDateByVenue[v.id]) {
        setBookliDateByVenue((m) => ({ ...m, [v.id]: today }));
      }
      loadBookliVenue(v.id, d);
    }
    /* kind === 'link': ingen auto-hent */
  };

  /**
   * @param {SlotRow} s
   * @param {import('../lib/banerVenues').BanerVenue} v
   * @param {CourtRow} c
   */
  const renderSlot = (s, v, c) => {
    if (s.status === 'free' && v.kind === 'bookli') {
      return (
        <a
          key={s.time}
          href={v.bookingUrl}
          target="_blank"
          rel="noopener noreferrer"
          title="Åbner Bookli — log ind og vælg bane og tid"
          style={{
            background: 'rgba(34, 197, 94, 0.15)',
            color: '#15803d',
            border: '1px solid rgba(34, 197, 94, 0.45)',
            padding: '10px 14px',
            borderRadius: '6px',
            fontSize: '12px',
            fontWeight: 600,
            textDecoration: 'none',
          }}
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
          style={{
            background: 'rgba(34, 197, 94, 0.15)',
            color: '#15803d',
            border: '1px solid rgba(34, 197, 94, 0.45)',
            padding: '10px 14px',
            borderRadius: '6px',
            fontSize: '12px',
            fontWeight: 600,
            textDecoration: 'none',
          }}
        >
          {s.time} · Ledig
        </a>
      );
    }
    if (s.status === 'booked') {
      return (
        <span
          key={s.time}
          style={{
            background: 'rgba(239, 68, 68, 0.12)',
            color: '#b91c1c',
            border: '1px solid rgba(239, 68, 68, 0.35)',
            padding: '10px 14px',
            borderRadius: '6px',
            fontSize: '12px',
            fontWeight: 600,
          }}
        >
          {s.time} · Optaget
        </span>
      );
    }
    if (s.status === 'blocked_rule') {
      return (
        <span
          key={s.time}
          title={s.ruleHint || 'Kan ikke bookes (klubbens regel)'}
          style={{
            background: 'rgba(245, 158, 11, 0.18)',
            color: '#b45309',
            border: '1px solid rgba(245, 158, 11, 0.5)',
            padding: '10px 14px',
            borderRadius: '6px',
            fontSize: '12px',
            fontWeight: 600,
            cursor: 'help',
          }}
        >
          {s.time} · Ikke bookbar
        </span>
      );
    }
    return (
      <span
        key={s.time}
        style={{
          background: theme.border + '55',
          color: theme.textLight,
          border: '1px solid ' + theme.border,
          padding: '10px 14px',
          borderRadius: '6px',
          fontSize: '12px',
        }}
      >
        {s.time}
      </span>
    );
  };

  return (
    <div>
      <h2 style={{ ...heading('clamp(20px,4.5vw,24px)'), marginBottom: '12px' }}>Ledige padelbaner</h2>
      <p style={{ fontSize: '13px', color: theme.textMid, lineHeight: 1.5, marginBottom: '20px' }}>
        Åbn ét sted ad gangen. <strong>Halbooking</strong>: grøn = direkte til booking, gul = regel (tooltip).{' '}
        <strong>PadelPadel (Bookli)</strong>: oversigt hentes som på padelpadel.dk — grøn åbner Bookli til login og booking
        (mødelokaler vises ikke). <strong>Eksterne links</strong>: åbner centrets egen booking — ledige tider vises dér.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {BANER_VENUES.map((v) => {
          const loaded = byVenue[v.id];
          const loading = !!loadingVenue[v.id];
          const err = errorVenue[v.id];
          const openHref =
            v.kind === 'halbooking'
              ? loaded?.openBookingPath || halbookingOpenVenueUrl(v.id)
              : v.kind === 'bookli' || v.kind === 'link'
                ? v.bookingUrl
                : halbookingOpenVenueUrl(v.id);
          const bookliDate = bookliDateByVenue[v.id] || copenhagenDateYmd();
          const halbookingDate = halbookingDateByVenue[v.id] || copenhagenDateYmd();
          const todayYmd = copenhagenDateYmd();

          return (
            <details
              key={v.id}
              ref={(node) => {
                detailRefs.current[v.id] = node;
              }}
              style={{
                background: theme.surface,
                borderRadius: theme.radius,
                boxShadow: theme.shadow,
                border: '1px solid ' + theme.border,
                overflow: 'hidden',
              }}
              onToggle={(e) => onDetailsToggle(v, e)}
            >
              <summary
                style={{
                  cursor: 'pointer',
                  listStyle: 'none',
                  padding: '14px 16px',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '12px',
                  userSelect: 'none',
                }}
                className="pm-baner-summary"
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '15px', fontWeight: 700 }}>{v.title}</div>
                  <div
                    style={{
                      fontSize: '12px',
                      color: theme.textLight,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      marginTop: '4px',
                    }}
                  >
                    <MapPin size={11} /> {v.address}
                  </div>
                  <div style={{ fontSize: '11px', color: theme.textLight, marginTop: '4px' }}>{v.region}</div>
                </div>
                <span style={v.indoor ? tag(theme.blueBg, theme.blue) : tag(theme.warmBg, theme.warm)}>
                  {v.indoor ? (
                    <>
                      <Building2 size={10} /> Indoor
                    </>
                  ) : (
                    <>
                      <Sun size={10} /> Outdoor
                    </>
                  )}
                </span>
              </summary>

              <div style={{ padding: '0 16px 16px', borderTop: '1px solid ' + theme.border }}>
                {v.kind === 'link' ? (
                  <>
                    <p style={{ fontSize: '13px', color: theme.textMid, lineHeight: 1.55, marginTop: '12px' }}>
                      {v.note ||
                        'Dette sted har ikke integreret tidsvisning i PadelMakker. Brug centrets booking for at se ledige tider.'}
                    </p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '14px' }}>
                      <a
                        href={v.bookingUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          ...btn(true),
                          textDecoration: 'none',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '8px',
                          fontSize: '13px',
                        }}
                      >
                        <ExternalLink size={16} />
                        Åbn booking
                      </a>
                    </div>
                  </>
                ) : v.kind === 'bookli' ? (
                  <>
                    <p style={{ fontSize: '12px', color: theme.textMid, lineHeight: 1.5, marginTop: '12px' }}>
                      Data hentes via Booklis offentlige kalender (samme som nederst på padelpadel.dk). 30 min. pr. felt —
                      book efter login.
                    </p>
                    <div
                      style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: '10px',
                        alignItems: 'center',
                        marginTop: '12px',
                        marginBottom: '10px',
                      }}
                    >
                      <label style={{ fontSize: '12px', color: theme.textMid, display: 'flex', alignItems: 'center', gap: '8px' }}>
                        Dato
                        <input
                          type="date"
                          value={bookliDate}
                          onChange={(e) => setBookliDateByVenue((m) => ({ ...m, [v.id]: e.target.value }))}
                          style={{ ...inputStyle, width: 'auto', padding: '8px 10px', fontSize: '13px' }}
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() => loadBookliVenue(v.id, bookliDate)}
                        disabled={loading}
                        style={{
                          ...btn(false),
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '8px',
                          fontSize: '13px',
                          opacity: loading ? 0.65 : 1,
                        }}
                      >
                        <RefreshCw size={15} className={loading ? 'pm-baner-refresh-spin' : undefined} />
                        Hent tider
                      </button>
                      <a
                        href={v.bookingUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          ...btn(true),
                          textDecoration: 'none',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '8px',
                          fontSize: '13px',
                        }}
                      >
                        <LogIn size={16} />
                        Book (Bookli)
                      </a>
                      <a
                        href={v.infoUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          ...btn(false),
                          textDecoration: 'none',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '8px',
                          fontSize: '13px',
                        }}
                      >
                        <ExternalLink size={16} />
                        Om centret
                      </a>
                    </div>
                    {loaded?.dateLabel && (
                      <p style={{ fontSize: '12px', color: theme.textLight, marginBottom: '8px' }}>
                        <Clock size={12} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
                        {loaded.dateLabel}
                      </p>
                    )}
                    {loaded?.fetchedAt && (
                      <p style={{ fontSize: '11px', color: theme.textLight, marginBottom: '12px' }}>
                        Senest hentet: {new Date(loaded.fetchedAt).toLocaleString('da-DK')}
                      </p>
                    )}
                    {loaded?.scheduleDate && loaded.scheduleDate === copenhagenDateYmd() && (
                      <p style={{ fontSize: '11px', color: theme.textLight, marginBottom: '10px', fontStyle: 'italic' }}>
                        Tider før nu på valgt dag vises ikke (PadelPadel/Bookli) — mindre rod i listen.
                      </p>
                    )}
                    {loading && !loaded?.courts?.length && (
                      <div style={{ textAlign: 'center', padding: '20px', color: theme.textLight, fontSize: '13px' }}>
                        Henter tider…
                      </div>
                    )}
                    {err && (
                      <div
                        style={{
                          ...inputStyle,
                          borderColor: theme.warm,
                          background: theme.warmBg,
                          padding: '12px',
                          fontSize: '13px',
                          marginBottom: '8px',
                        }}
                      >
                        {err}
                      </div>
                    )}
                    {loaded && loaded.courts.length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {loaded.courts.map((c) => (
                          <div
                            key={c.id || c.headerName || c.name}
                            style={{
                              background: theme.bg,
                              borderRadius: '8px',
                              padding: '12px',
                              border: '1px solid ' + theme.border,
                            }}
                          >
                            <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: '8px' }}>
                              {c.headerName || c.name}
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                              {c.slots.map((s) => renderSlot(s, v, c))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    {loaded?.dateLabel && (
                      <p
                        style={{
                          fontSize: '14px',
                          fontWeight: 700,
                          color: theme.text,
                          marginTop: '12px',
                          marginBottom: '8px',
                          lineHeight: 1.35,
                        }}
                      >
                        {v.title} — {loaded.dateLabel}
                      </p>
                    )}
                    <div
                      style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: '8px',
                        alignItems: 'center',
                        marginBottom: '12px',
                      }}
                      className="pm-baner-date-nav"
                    >
                      <button
                        type="button"
                        disabled={loading}
                        onClick={() => {
                          const next = copenhagenAddDaysYmd(halbookingDate, -7);
                          setHalbookingDateByVenue((m) => ({ ...m, [v.id]: next }));
                          loadHalbookingVenue(v.id, next);
                        }}
                        style={{ ...btn(false), fontSize: '12px', padding: '8px 10px', opacity: loading ? 0.65 : 1 }}
                        title="Én uge tilbage"
                      >
                        ≪ 1 uge
                      </button>
                      <button
                        type="button"
                        disabled={loading}
                        onClick={() => {
                          const next = copenhagenAddDaysYmd(halbookingDate, -1);
                          setHalbookingDateByVenue((m) => ({ ...m, [v.id]: next }));
                          loadHalbookingVenue(v.id, next);
                        }}
                        style={{ ...btn(false), fontSize: '12px', padding: '8px 10px', opacity: loading ? 0.65 : 1 }}
                        title="Én dag tilbage"
                      >
                        ‹ 1 dag
                      </button>
                      <button
                        type="button"
                        disabled={loading}
                        onClick={() => {
                          setHalbookingDateByVenue((m) => ({ ...m, [v.id]: todayYmd }));
                          loadHalbookingVenue(v.id, todayYmd);
                        }}
                        style={{ ...btn(halbookingDate === todayYmd), fontSize: '12px', padding: '8px 12px', opacity: loading ? 0.65 : 1 }}
                      >
                        I dag
                      </button>
                      <button
                        type="button"
                        disabled={loading}
                        onClick={() => {
                          const next = copenhagenAddDaysYmd(halbookingDate, 1);
                          setHalbookingDateByVenue((m) => ({ ...m, [v.id]: next }));
                          loadHalbookingVenue(v.id, next);
                        }}
                        style={{ ...btn(false), fontSize: '12px', padding: '8px 10px', opacity: loading ? 0.65 : 1 }}
                        title="Én dag frem"
                      >
                        1 dag ›
                      </button>
                      <button
                        type="button"
                        disabled={loading}
                        onClick={() => {
                          const next = copenhagenAddDaysYmd(halbookingDate, 7);
                          setHalbookingDateByVenue((m) => ({ ...m, [v.id]: next }));
                          loadHalbookingVenue(v.id, next);
                        }}
                        style={{ ...btn(false), fontSize: '12px', padding: '8px 10px', opacity: loading ? 0.65 : 1 }}
                        title="Én uge frem"
                      >
                        1 uge ≫
                      </button>
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: '10px',
                        alignItems: 'center',
                        marginBottom: '10px',
                      }}
                    >
                      <label style={{ fontSize: '12px', color: theme.textMid, display: 'flex', alignItems: 'center', gap: '8px' }}>
                        Dato
                        <input
                          type="date"
                          value={halbookingDate}
                          onChange={(e) => {
                            const val = e.target.value;
                            setHalbookingDateByVenue((m) => ({ ...m, [v.id]: val }));
                            loadHalbookingVenue(v.id, val);
                          }}
                          style={{ ...inputStyle, width: 'auto', padding: '8px 10px', fontSize: '13px' }}
                        />
                      </label>
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: '8px',
                        alignItems: 'center',
                        marginBottom: '10px',
                      }}
                    >
                      <a
                        href={openHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          ...btn(true),
                          textDecoration: 'none',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '8px',
                          fontSize: '13px',
                        }}
                      >
                        <ExternalLink size={16} />
                        Åbn booking
                      </a>
                      <button
                        type="button"
                        onClick={() => loadHalbookingVenue(v.id, halbookingDate)}
                        disabled={loading}
                        style={{
                          ...btn(false),
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '8px',
                          fontSize: '13px',
                          opacity: loading ? 0.65 : 1,
                        }}
                      >
                        <RefreshCw size={15} className={loading ? 'pm-baner-refresh-spin' : undefined} />
                        Opdater tider
                      </button>
                    </div>

                    {loaded?.fetchedAt && (
                      <p style={{ fontSize: '11px', color: theme.textLight, marginBottom: '12px' }}>
                        Senest hentet: {new Date(loaded.fetchedAt).toLocaleString('da-DK')}
                      </p>
                    )}
                    {loaded?.scheduleDate && loaded.scheduleDate === copenhagenDateYmd() && (
                      <p style={{ fontSize: '11px', color: theme.textLight, marginBottom: '10px', fontStyle: 'italic' }}>
                        Tider der allerede er passeret i dag vises ikke — mindre rod i listen.
                      </p>
                    )}

                    {loading && !loaded?.courts?.length && (
                      <div style={{ textAlign: 'center', padding: '20px', color: theme.textLight, fontSize: '13px' }}>
                        Henter tider…
                      </div>
                    )}

                    {err && (
                      <div
                        style={{
                          ...inputStyle,
                          borderColor: theme.warm,
                          background: theme.warmBg,
                          padding: '12px',
                          fontSize: '13px',
                          marginBottom: '8px',
                        }}
                      >
                        {err}
                      </div>
                    )}

                    {loaded && loaded.courts.length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {loaded.courts.map((c) => (
                          <div
                            key={c.name}
                            style={{
                              background: theme.bg,
                              borderRadius: '8px',
                              padding: '12px',
                              border: '1px solid ' + theme.border,
                            }}
                          >
                            <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: '8px' }}>{c.name}</div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                              {c.slots.map((s) => renderSlot(s, v, c))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            </details>
          );
        })}
      </div>

      <style>{`
        .pm-baner-summary::-webkit-details-marker { display: none; }
        @keyframes pm-baner-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .pm-baner-refresh-spin {
          animation: pm-baner-spin 0.8s linear infinite;
        }
      `}</style>
    </div>
  );
}
