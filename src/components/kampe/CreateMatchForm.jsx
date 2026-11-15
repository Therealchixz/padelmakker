/**
 * Opret 2v2-kamp som "kampkort" (H-designet, etape 2).
 *
 * Een skaerm i stedet for to trin: oeverst staar hele tiden, hvad man er ved at
 * oprette (dag, tid, sted, niveau). Nedenunder en raekke pr. valg, som folder ud
 * paa stedet. Alt er udfyldt paa forhaand, saa man kan oprette med eet tryk.
 *
 * Al tilstand bor stadig i KampeTab; denne fil er ren visning. createMatch
 * tjekker selv felterne og saetter padelCreateFieldError, hvis noget mangler.
 */
import { useEffect, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { inputStyle, labelStyle } from '../../lib/platformTheme';
import { DateInputField } from '../DateInputField';
import { PillTabs } from '../PillTabs';
import { LevelRangeSlider } from '../LevelRangeSlider';
import { VenueRegionPicker } from '../VenueRegionPicker';
import { fieldValidationErrorStyle, fieldValidationMessage } from '../../lib/formValidationScroll';
import { TIME_OPTIONS } from '../../lib/timeSlotOptions';
import { isMatchVenueTbd, isMatchVenueCustom, cleanCustomCourtName, CUSTOM_COURT_NAME_MAX, MATCH_VENUE_TBD, courtNameFromVenueSelection } from '../../lib/matchVenueOptions';
import { timeToMinutes } from '../../lib/matchDisplayUtils';
import { eloToLevel, levelToElo, formatPlaytomicLevelRange } from '../../lib/padelLevelUtils';
import '../../styles/opret-h.css';

const DURATIONS = [
  { value: '60', label: '1 time' },
  { value: '90', label: '1½ time' },
  { value: '120', label: '2 timer' },
  { value: '150', label: '2½ timer' },
  { value: '180', label: '3 timer' },
];
/** De mest brugte starttider som knapper; resten ligger i "Andet tidspunkt". */
const QUICK_TIMES = TIME_OPTIONS.filter((t) => {
  const m = timeToMinutes(t);
  return m >= 16 * 60 && m <= 21 * 60 + 30;
});

function isoDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** I dag + de naeste seks dage som knapper. */
function nextDays() {
  const out = [];
  const base = new Date();
  for (let i = 0; i < 7; i++) {
    const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + i);
    out.push({
      iso: isoDate(d),
      top: i === 0 ? 'I dag' : d.toLocaleDateString('da-DK', { weekday: 'short' }).replace('.', '').replace(/^./, (c) => c.toUpperCase()),
      num: d.getDate(),
    });
  }
  return out;
}

function dayWord(iso, todayIso) {
  if (!iso) return '';
  if (iso === todayIso) return 'I dag';
  const d = new Date(`${iso}T12:00:00`);
  const diff = Math.round((d - new Date(`${todayIso}T12:00:00`)) / 86400000);
  if (diff === 1) return 'I morgen';
  const weekday = d.toLocaleDateString('da-DK', { weekday: 'long' });
  const cap = weekday.charAt(0).toUpperCase() + weekday.slice(1);
  return diff > 1 && diff < 7 ? cap : `${cap} ${d.toLocaleDateString('da-DK', { day: 'numeric', month: 'short' })}`;
}

function Row({ id, label, value, sub, open, onToggle, error, rowRef, wide, children }) {
  return (
    <div ref={rowRef} className="pm-opret-row-wrap">
      <button
        type="button"
        className={wide ? "pm-opret-row pm-opret-row--wide" : "pm-opret-row"}
        aria-expanded={open}
        aria-controls={`pm-opret-panel-${id}`}
        onClick={onToggle}
      >
        <span className="pm-opret-row-label">{label}</span>
        <span className="pm-opret-row-value">
          {value}
          {sub ? <span className="pm-opret-row-sub"> · {sub}</span> : null}
        </span>
        <ChevronDown size={18} aria-hidden className="pm-opret-row-chev" data-open={open ? 'true' : 'false'} />
      </button>
      {error ? (
        <div role="alert" className="pm-opret-error">{error}</div>
      ) : null}
      {open ? (
        <div id={`pm-opret-panel-${id}`} className="pm-opret-panel">{children}</div>
      ) : null}
    </div>
  );
}

export function CreateMatchForm({
  newMatch,
  setNewMatch,
  creating,
  createMatch,
  defaultLevelElo,
  venueOptions,
  createVenueOptions,
  matchTypeTabs,
  padelCreateFieldError,
  setPadelCreateFieldError,
  setShowCreate,
  padelCreateFormRef,
  padelCreateDateFieldRef,
  padelCreateTimeFieldRef,
  padelCreateVenueFieldRef,
  padelCreateDurationFieldRef,
}) {
  const [open, setOpen] = useState(null);
  const toggle = (name) => setOpen((cur) => (cur === name ? null : name));

  const generalError = fieldValidationMessage(padelCreateFieldError, 'general');
  const venueError = fieldValidationMessage(padelCreateFieldError, 'venue');
  const dateError = fieldValidationMessage(padelCreateFieldError, 'date');
  const timeError = fieldValidationMessage(padelCreateFieldError, 'time');
  const durationError = fieldValidationMessage(padelCreateFieldError, 'duration');

  // Mangler et felt, foldes dets raekke ud, saa man kan rette det med det samme.
  const errorField = padelCreateFieldError?.field;
  useEffect(() => {
    const map = { venue: 'bane', date: 'dag', time: 'tid', duration: 'varighed' };
    if (errorField && map[errorField]) setOpen(map[errorField]);
  }, [errorField]);

  const clearError = (field) => {
    if (padelCreateFieldError?.field === field) setPadelCreateFieldError(null);
  };

  const todayIso = isoDate(new Date());
  const days = nextDays();
  const dayInQuick = days.some((d) => d.iso === newMatch.date);

  const startM = timeToMinutes(newMatch.time);
  const dur = parseInt(newMatch.duration, 10) || 120;
  const endM = Number.isFinite(startM) ? startM + dur : null;
  const endTime = endM != null
    ? `${String(Math.floor(endM / 60) % 24).padStart(2, '0')}:${String(endM % 60).padStart(2, '0')}`
    : '';

  const courtLabel = (isMatchVenueCustom(newMatch.court_id)
    ? cleanCustomCourtName(newMatch.custom_court)
    : (isMatchVenueTbd(newMatch.court_id) ? '' : courtNameFromVenueSelection(newMatch.court_id, createVenueOptions))) || '';
  const lvlMin = eloToLevel(Number(newMatch.level_min) || defaultLevelElo.min);
  const lvlMax = eloToLevel(Number(newMatch.level_max) || defaultLevelElo.max);
  const levelLabel = formatPlaytomicLevelRange(lvlMin, lvlMax);
  const durationLabel = DURATIONS.find((d) => d.value === String(newMatch.duration))?.label || `${dur} min`;

  const dayLabel = dayWord(newMatch.date, todayIso);
  const dateLong = newMatch.date
    ? new Date(`${newMatch.date}T12:00:00`).toLocaleDateString('da-DK', { weekday: 'long', day: 'numeric', month: 'short' })
    : 'Vælg dag';
  const headline = newMatch.date ? `${dayLabel} kl. ${newMatch.time}` : 'Vælg dag og tid';
  const resume = [courtLabel || 'Bane ikke valgt endnu', endTime ? `${newMatch.time}–${endTime}` : null, `niveau\u00A0${levelLabel.replace(/ /g, '\u00A0')}`]
    .filter(Boolean)
    .join(' · ');

  const priceValue = Number(String(newMatch.price_per_person || '').replace(',', '.'));
  const hasPrice = Number.isFinite(priceValue) && priceValue > 0;
  const priceSummary = hasPrice
    ? `${priceValue % 1 === 0 ? priceValue : priceValue.toFixed(2).replace('.', ',')} kr.`
    : 'Gratis';
  const onPriceChange = (value) => {
    const n = Number(String(value || '').replace(',', '.'));
    const paid = Number.isFinite(n) && n > 0;
    setNewMatch((m) => ({
      ...m,
      price_per_person: value,
      // Ingen pris = gratis. Skrives der en pris, foreslås MobilePay.
      payment_method: paid ? (m.payment_method === 'free' ? 'mobilepay' : m.payment_method) : 'free',
    }));
  };

  const setBooked = (booked) => {
    setNewMatch((m) => {
      let nextCourtId = m.court_id;
      if (booked) {
        if (!nextCourtId || isMatchVenueTbd(nextCourtId)) nextCourtId = venueOptions[0]?.id ?? '';
      } else if (!nextCourtId) {
        nextCourtId = MATCH_VENUE_TBD;
      }
      return { ...m, court_booked: booked, court_id: nextCourtId };
    });
    if (booked) setOpen('bane');
  };

  const close = () => {
    setShowCreate(false);
    setPadelCreateFieldError(null);
  };

  const cannotCreate = creating || venueOptions.length === 0;
  const ctaLabel = creating
    ? 'Opretter…'
    : newMatch.date
      ? `Opret kamp · ${dayLabel.charAt(0).toLowerCase()}${dayLabel.slice(1)} kl. ${newMatch.time}`
      : 'Opret kamp';

  return (
    <div ref={padelCreateFormRef} className="pm-create-form-anchor pm-opret">
      <div className="pm-opret-head">
        <span className="pm-opret-head-kicker">Ny 2v2-kamp · du er på Hold 1</span>
        <p className="pm-opret-head-title" aria-live="polite">{headline}</p>
        <p className="pm-opret-head-resume">{resume}</p>
      </div>

      {generalError ? (
        <div role="alert" className="pm-opret-error pm-opret-error--general">{generalError}</div>
      ) : null}

      <div className="pm-opret-card">
        <Row
          id="bane"
          label="Bane"
          value={courtLabel || 'Ikke valgt endnu'}
          open={open === 'bane'}
          onToggle={() => toggle('bane')}
          error={venueError}
          rowRef={padelCreateVenueFieldRef}
        >
          <VenueRegionPicker
            value={newMatch.court_id}
            onChange={(id) => {
              setNewMatch((m) => ({ ...m, court_id: id }));
              clearError('venue');
            }}
            options={createVenueOptions}
            placeholder={newMatch.court_booked ? 'Vælg booket center' : 'Ikke valgt endnu'}
            emptyLabel="Indlæser centre…"
            ariaLabel={newMatch.court_booked ? 'Vælg booket bane' : 'Vælg foretrukket center'}
          />
          {isMatchVenueCustom(newMatch.court_id) ? (
            <input
              type="text"
              value={newMatch.custom_court || ''}
              onChange={(e) => {
                setNewMatch((m) => ({ ...m, custom_court: e.target.value.slice(0, CUSTOM_COURT_NAME_MAX) }));
                clearError('venue');
              }}
              placeholder="Skriv banens navn, fx Padelhallen Køge"
              aria-label="Banens navn"
              maxLength={CUSTOM_COURT_NAME_MAX}
              style={{ ...inputStyle, marginTop: 8 }}
            />
          ) : null}
          <p className="pm-opret-hint">
            {newMatch.court_booked
              ? 'Vælg det center, hvor du har booket tid.'
              : 'Du behøver ikke have booket endnu. Lad den stå tom, eller peg på et center du overvejer.'}
          </p>
        </Row>

        <Row
          id="dag"
          label="Dag"
          value={dateLong.charAt(0).toUpperCase() + dateLong.slice(1)}
          open={open === 'dag'}
          onToggle={() => toggle('dag')}
          error={dateError}
          rowRef={padelCreateDateFieldRef}
        >
          <div className="pm-opret-chips pm-opret-chips--days" role="group" aria-label="Vælg dag">
            {days.map((d) => (
              <button
                key={d.iso}
                type="button"
                className="pm-opret-chip pm-opret-chip--day"
                aria-pressed={newMatch.date === d.iso}
                onClick={() => {
                  setNewMatch((m) => ({ ...m, date: d.iso }));
                  clearError('date');
                  setOpen(null);
                }}
              >
                <span className="pm-opret-chip-top">{d.top}</span>
                <span className="pm-opret-chip-num">{d.num}</span>
              </button>
            ))}
          </div>
          <div style={{ marginTop: 12 }}>
            <DateInputField
              label={dayInQuick ? 'Eller vælg en anden dato' : 'Dato'}
              labelStyle={labelStyle}
              value={newMatch.date}
              min={todayIso}
              onChange={(e) => {
                setNewMatch((m) => ({ ...m, date: e.target.value }));
                clearError('date');
              }}
              inputStyle={{ ...inputStyle, marginBottom: 0, ...fieldValidationErrorStyle(Boolean(dateError)) }}
              aria-invalid={dateError ? true : undefined}
            />
          </div>
        </Row>

        <Row
          id="tid"
          label="Tid"
          value={endTime ? `${newMatch.time}–${endTime}` : newMatch.time}
          open={open === 'tid'}
          onToggle={() => toggle('tid')}
          error={timeError}
          rowRef={padelCreateTimeFieldRef}
        >
          <div className="pm-opret-chips" role="group" aria-label="Vælg starttid">
            {QUICK_TIMES.map((t) => (
              <button
                key={t}
                type="button"
                className="pm-opret-chip"
                aria-pressed={newMatch.time === t}
                onClick={() => {
                  setNewMatch((m) => ({ ...m, time: t }));
                  clearError('time');
                  setOpen(null);
                }}
              >
                {t}
              </button>
            ))}
          </div>
          <label htmlFor="padel-create-time" style={{ ...labelStyle, marginTop: 12 }}>Andet tidspunkt</label>
          <select
            id="padel-create-time"
            value={newMatch.time}
            onChange={(e) => {
              setNewMatch((m) => ({ ...m, time: e.target.value }));
              clearError('time');
            }}
            style={{ ...inputStyle, ...fieldValidationErrorStyle(Boolean(timeError)) }}
            aria-invalid={timeError ? true : undefined}
          >
            {TIME_OPTIONS.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </Row>

        <Row
          id="varighed"
          label="Varighed"
          value={durationLabel}
          open={open === 'varighed'}
          onToggle={() => toggle('varighed')}
          error={durationError}
          rowRef={padelCreateDurationFieldRef}
        >
          <div className="pm-opret-chips" role="group" aria-label="Vælg varighed">
            {DURATIONS.map((d) => (
              <button
                key={d.value}
                type="button"
                className="pm-opret-chip"
                aria-pressed={String(newMatch.duration) === d.value}
                onClick={() => {
                  setNewMatch((m) => ({ ...m, duration: d.value }));
                  clearError('duration');
                  setOpen(null);
                }}
              >
                {d.label}
              </button>
            ))}
          </div>
        </Row>

        <Row
          id="niveau"
          label="Niveau"
          value={levelLabel}
          open={open === 'niveau'}
          onToggle={() => toggle('niveau')}
        >
          <div className="pm-level-range-box">
            <LevelRangeSlider
              minVal={lvlMin}
              maxVal={lvlMax}
              step={0.1}
              onMinChange={(v) => setNewMatch((m) => ({ ...m, level_min: String(levelToElo(v)) }))}
              onMaxChange={(v) => setNewMatch((m) => ({ ...m, level_max: String(levelToElo(v)) }))}
            />
          </div>
          <p className="pm-opret-hint">Spillere på niveau {levelLabel} matcher kampen.</p>
        </Row>
      </div>

      <h3 className="pm-opret-section">Valgfrit</h3>
      <div className="pm-opret-card">
        <button
          type="button"
          role="switch"
          aria-checked={newMatch.court_booked === true}
          className="pm-opret-row pm-opret-row--switch"
          onClick={() => setBooked(newMatch.court_booked !== true)}
        >
          <span className="pm-opret-row-text">
            <span className="pm-opret-row-title">Banen er booket</span>
            <span className="pm-opret-row-desc">Slå til, når du har booket en tid</span>
          </span>
          <span className="pm-opret-switch" data-on={newMatch.court_booked === true ? 'true' : 'false'} aria-hidden>
            <span />
          </span>
        </button>

        <Row
          id="hvem"
          wide
          label="Hvem kan være med"
          value={newMatch.match_type === 'closed' ? 'Du godkender' : 'Åben for alle'}
          open={open === 'hvem'}
          onToggle={() => toggle('hvem')}
        >
          <PillTabs
            tabs={matchTypeTabs}
            value={newMatch.match_type === 'closed' ? 'closed' : 'open'}
            onChange={(id) => setNewMatch((m) => ({ ...m, match_type: id }))}
            ariaLabel="Kamptype"
            size="sm"
          />
          <p className="pm-opret-hint">
            {newMatch.match_type === 'closed'
              ? 'Alle kan se kampen, men skal anmode om at deltage. Du godkender selv.'
              : 'Alle kan tilmelde sig direkte.'}
          </p>
        </Row>

        <Row
          id="pris"
          wide
          label="Pris og beskrivelse"
          value={priceSummary}
          open={open === 'pris'}
          onToggle={() => toggle('pris')}
        >
          <div className="pm-form-2col">
            <div style={{ minWidth: 0 }}>
              <label htmlFor="padel-create-price" style={labelStyle}>Pris pr. person</label>
              <div style={{ position: 'relative' }}>
                <input
                  id="padel-create-price"
                  type="text"
                  inputMode="decimal"
                  value={newMatch.price_per_person}
                  onChange={(e) => onPriceChange(e.target.value)}
                  placeholder="0"
                  style={{ ...inputStyle, paddingRight: 36 }}
                />
                <span className="pm-opret-suffix">kr.</span>
              </div>
            </div>
            {hasPrice ? (
              <div style={{ minWidth: 0 }}>
                <label htmlFor="padel-create-payment" style={labelStyle}>Betaling</label>
                <select
                  id="padel-create-payment"
                  value={newMatch.payment_method}
                  onChange={(e) => setNewMatch((m) => ({ ...m, payment_method: e.target.value }))}
                  style={inputStyle}
                >
                  <option value="mobilepay">MobilePay</option>
                  <option value="cash">Ved fremmøde</option>
                </select>
              </div>
            ) : null}
          </div>
          <label htmlFor="padel-create-description" style={{ ...labelStyle, marginTop: 12 }}>Beskrivelse</label>
          <input
            id="padel-create-description"
            value={newMatch.description}
            onChange={(e) => setNewMatch((m) => ({ ...m, description: e.target.value }))}
            placeholder="Fx: Søger venstreside-spiller"
            style={inputStyle}
          />
        </Row>
      </div>

      <div className="pm-opret-actions">
        <button type="button" className="pm-opret-cta" onClick={createMatch} disabled={cannotCreate}>
          {ctaLabel}
        </button>
        <p className="pm-opret-foot">Du kan rette eller slette kampen bagefter.</p>
        <button type="button" className="pm-opret-cancel" onClick={close} disabled={creating}>
          Annullér
        </button>
      </div>
    </div>
  );
}
