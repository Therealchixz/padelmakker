import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { ChevronDown } from 'lucide-react';
import { useScrollToFieldOnError } from '../../lib/formValidationScroll'
import { nearestHalfHour, TIME_OPTIONS } from '../../lib/timeSlotOptions.js'
import { benchCountPerRound } from '../../lib/americanoRoundRobinSchedule'
import {
  getCreateFormSchedulePreview,
  recommendedCourtsPerRound,
} from './americanoDisplayUtils'

const PAYMENT_OPTIONS = [
  { id: 'mobilepay', label: 'MobilePay' },
  { id: 'cash', label: 'Ved fremmøde' },
  { id: 'free', label: 'Gratis' },
]

// Full range 4–16, matching the original
const PLAYER_OPTIONS = [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]

import { supabase } from '../../lib/supabase'
import { theme } from '../../lib/platformTheme'
import '../../styles/opret-h.css'
import type { AmericanoPoints, AmericanoOpponentPasses, AmericanoTournamentFormat } from './types'
import {
  getMatchVenueOptions,
  courtIdFromVenueSelection,
  courtNameFromVenueSelection,
  AMERICANO_VENUE_NONE,
  CUSTOM_VENUE_OPTION,
  CUSTOM_COURT_NAME_MAX,
  cleanCustomCourtName,
  isMatchVenueCustom,
} from '../../lib/matchVenueOptions'
import { VenueRegionPicker } from '../../components/VenueRegionPicker'
import { DateInputField } from '../../components/DateInputField'
import { LevelRangeSlider } from '../../components/LevelRangeSlider.jsx'
import { formatPlaytomicLevelRange } from '../../lib/padelLevelUtils'

type CourtOption = { id: string; name: string }

export type CreatedTournamentInfo = {
  id: string
  name: string
  format: AmericanoTournamentFormat
  tournament_date: string
  time_slot: string
  player_slots: number
  points_per_match: number
  court_name: string | null
}

type Props = {
  userId: string
  displayName: string
  courts: CourtOption[]
  onCreated?: (info: CreatedTournamentInfo) => void
  onCancel?: () => void
}

const POINT_OPTIONS: AmericanoPoints[] = [16, 24, 32]

export const AMERICANO_COURT_NONE = AMERICANO_VENUE_NONE

const STEP_LABELS = ['Info', 'Pris', 'Publicér'] as const
const DURATION_OPTIONS = [
  { value: 60, label: '1 time' },
  { value: 90, label: '1½ time' },
  { value: 120, label: '2 timer' },
  { value: 150, label: '2½ timer' },
  { value: 180, label: '3 timer' },
]
/** De mest brugte starttider som knapper; resten ligger i "Andet tidspunkt". */
const QUICK_TIMES = (TIME_OPTIONS as string[]).filter((t) => {
  const [h, m] = t.split(':').map(Number)
  const mins = h * 60 + m
  return mins >= 16 * 60 && mins <= 21 * 60 + 30
})

function isoDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** I dag + de næste seks dage som knapper. */
function nextDays() {
  const base = new Date()
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + i)
    const short = d.toLocaleDateString('da-DK', { weekday: 'short' }).replace('.', '')
    return { iso: isoDate(d), top: i === 0 ? 'I dag' : short.charAt(0).toUpperCase() + short.slice(1), num: d.getDate() }
  })
}

// ── En række, der folder ud på stedet (samme mønster som Opret 2v2-kamp) ──
function Row({ id, label, value, open, onToggle, wide, error, children }: {
  id: string
  label: string
  value: React.ReactNode
  open: boolean
  onToggle: () => void
  wide?: boolean
  error?: string | null
  children: React.ReactNode
}) {
  return (
    <div className="pm-opret-row-wrap">
      <button
        type="button"
        className={wide ? 'pm-opret-row pm-opret-row--wide' : 'pm-opret-row'}
        aria-expanded={open}
        aria-controls={`pm-opret-am-panel-${id}`}
        onClick={onToggle}
      >
        <span className="pm-opret-row-label">{label}</span>
        <span className="pm-opret-row-value">{value}</span>
        <ChevronDown size={18} aria-hidden className="pm-opret-row-chev" data-open={open ? 'true' : 'false'} />
      </button>
      {error ? <div id={`pm-opret-am-error-${id}`} role="alert" className="pm-opret-error">{error}</div> : null}
      {open ? <div id={`pm-opret-am-panel-${id}`} className="pm-opret-panel">{children}</div> : null}
    </div>
  )
}

// ── Til/fra-række ──
function SwitchRow({ title, desc, on, onChange }: { title: string; desc: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="pm-opret-row-wrap">
      <button type="button" role="switch" aria-checked={on} className="pm-opret-row pm-opret-row--switch" onClick={() => onChange(!on)}>
        <span className="pm-opret-row-text">
          <span className="pm-opret-row-title">{title}</span>
          <span className="pm-opret-row-desc">{desc}</span>
        </span>
        <span className="pm-opret-switch" data-on={on ? 'true' : 'false'} aria-hidden><span /></span>
      </button>
    </div>
  )
}

export function CreateAmericanoTournamentForm({
  userId,
  displayName,
  courts,
  onCreated,
  onCancel,
}: Props) {
  const [step, setStep] = useState<1 | 2 | 3>(1)
  // Navnet er det eneste, der skal skrives, så den række er åben fra start.
  const [open, setOpen] = useState<string | null>('navn')
  const toggle = (id: string) => setOpen((cur) => (cur === id ? null : id))

  // Step 1 state
  const [tournamentFormat, setTournamentFormat] = useState<AmericanoTournamentFormat>('americano')
  const [name, setName] = useState('')
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0])
  const [timeSlot, setTimeSlot] = useState(() => nearestHalfHour())
  const [durationMinutes, setDurationMinutes] = useState(120)
  const venueOptions = useMemo(() => getMatchVenueOptions(courts), [courts])
  const selectOptions = useMemo(
    () => [
      { id: AMERICANO_COURT_NONE, label: 'Ikke valgt endnu', courtId: null as string | null },
      { ...CUSTOM_VENUE_OPTION },
      ...venueOptions,
    ],
    [venueOptions]
  )
  const [courtId, setCourtId] = useState(AMERICANO_COURT_NONE)
  const [customCourt, setCustomCourt] = useState('')
  // Banens navn: fra listen, skrevet selv, eller ingen ("Ikke valgt endnu").
  const chosenCourtName = isMatchVenueCustom(courtId)
    ? cleanCustomCourtName(customCourt)
    : courtId === AMERICANO_COURT_NONE
      ? ''
      : courtNameFromVenueSelection(courtId, selectOptions)
  const [playerSlots, setPlayerSlots] = useState(8)
  const [pointsPerMatch, setPointsPerMatch] = useState<AmericanoPoints>(16)
  const [levelMin, setLevelMin] = useState(3.0)
  const [levelMax, setLevelMax] = useState(4.0)
  const [opponentPasses, setOpponentPasses] = useState<AmericanoOpponentPasses>(1)
  const [description, setDescription] = useState('')
  const [step1Error, setStep1Error] = useState<string | null>(null)
  const nameFieldRef = useRef<HTMLDivElement>(null)
  const nameInputRef = useRef<HTMLInputElement>(null)

  // Step 2 state
  const [pricePerPerson, setPricePerPerson] = useState(0)
  const [priceInput, setPriceInput] = useState('0')
  const [paymentMethod, setPaymentMethod] = useState<'mobilepay' | 'cash' | 'free'>('mobilepay')
  const [isPublic, setIsPublic] = useState(true)
  const [enforceLevelInterval, setEnforceLevelInterval] = useState(false)

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Antal baner er bestemt af spillerantallet (alle spiller hver runde), så det
  // er en afledt værdi — ikke et frit valg der alligevel overskrives.
  const courtsPerRound = recommendedCourtsPerRound(playerSlots)

  const schedulePreview = useMemo(
    () => getCreateFormSchedulePreview({ format: tournamentFormat, playerSlots, courtsPerRound, opponentPasses, pointsPerMatch }),
    [tournamentFormat, playerSlots, courtsPerRound, opponentPasses, pointsPerMatch],
  )

  const handlePlayerSlotsChange = useCallback((n: number) => {
    setPlayerSlots(n)
  }, [])

  useEffect(() => {
    setCourtId((prev: string) => {
      const ids = new Set(selectOptions.map((o) => o.id))
      return ids.has(prev) ? prev : AMERICANO_COURT_NONE
    })
  }, [selectOptions])

  useEffect(() => {
    if (paymentMethod === 'free') { setPricePerPerson(0); setPriceInput('0') }
  }, [paymentMethod])

  // Scroll til toppen ved skift mellem trin
  useEffect(() => {
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [step])

  // Mangler navnet, foldes rækken ud, så feltet kan udfyldes med det samme.
  useEffect(() => {
    if (step1Error) setOpen('navn')
  }, [step1Error])
  useScrollToFieldOnError(step1Error, nameFieldRef, nameInputRef)

  const syncPrice = (raw: string) => {
    setPriceInput(raw)
    const normalized = raw.replace(',', '.')
    const n = parseFloat(normalized)
    if (!isNaN(n) && n >= 0) {
      const clamped = Math.min(5000, Math.round(n * 100) / 100)
      setPricePerPerson(clamped)
      if (clamped > 0 && paymentMethod === 'free') setPaymentMethod('mobilepay')
    }
  }

  const goNext = () => {
    if (step === 1) {
      if (!name.trim()) { setStep1Error('Angiv et navn til turneringen.'); return }
      setStep1Error(null)
      setStep(2)
    } else if (step === 2) {
      setStep(3)
    }
  }

  const doSubmit = async () => {
    setError(null)
    const n = name.trim()
    if (!n) { setError('Angiv et navn.'); return }
    if (isMatchVenueCustom(courtId) && !chosenCourtName) { setError('Skriv navnet på banen.'); return }
    setSubmitting(true)
    try {
      const { data: row, error: insErr } = await supabase
        .from('americano_tournaments')
        .insert({
          creator_id: userId,
          name: n,
          tournament_date: date,
          time_slot: timeSlot,
          court_id: courtIdFromVenueSelection(courtId, selectOptions),
          court_name: chosenCourtName || null,
          player_slots: playerSlots,
          courts_per_round: courtsPerRound,
          points_per_match: pointsPerMatch,
          opponent_passes: opponentPasses,
          format: tournamentFormat,
          description: description.trim() || null,
          status: 'registration',
          price_per_person: pricePerPerson,
          payment_method: paymentMethod,
          is_public: isPublic,
          has_waitlist: false,
          enforce_level_interval: enforceLevelInterval,
          level_min: levelMin,
          level_max: levelMax,
          duration_minutes: durationMinutes,
        })
        .select('id')
        .single()

      if (insErr) throw insErr
      if (!row?.id) throw new Error('Ingen id returneret')

      await supabase.from('americano_participants').insert({
        tournament_id: row.id,
        user_id: userId,
        display_name: displayName.trim() || 'Spiller',
      })

      onCreated?.({
        id: row.id, name: n, format: tournamentFormat,
        tournament_date: date, time_slot: timeSlot,
        player_slots: playerSlots, points_per_match: pointsPerMatch,
        court_name: chosenCourtName || null,
      })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(msg.includes('americano') ? msg : `${msg} — Har du kørt americano_schema.sql i Supabase?`)
    } finally {
      setSubmitting(false)
    }
  }

  const formatPrice = (p: number) =>
    p === 0 ? 'Gratis' : (p % 1 === 0 ? `${p} kr.` : `${p.toFixed(2).replace('.', ',')} kr.`)

  const formatLabel = tournamentFormat === 'mexicano' ? 'Mexicano' : 'Americano'
  const courtLabel = chosenCourtName
  const paymentLabel = PAYMENT_OPTIONS.find(p => p.id === paymentMethod)?.label ?? paymentMethod

  const endTime = (() => {
    const [h, m] = timeSlot.split(':').map(Number)
    const end = h * 60 + m + durationMinutes
    return `${String(Math.floor(end / 60) % 24).padStart(2, '0')}:${String(end % 60).padStart(2, '0')}`
  })()

  const todayIso = isoDate(new Date())
  const days = nextDays()
  const dayInQuick = days.some((d) => d.iso === date)
  const shortDate = (() => {
    const dt = new Date(date + 'T12:00:00')
    const txt = dt.toLocaleDateString('da-DK', { weekday: 'short', day: 'numeric', month: 'short' })
    return txt.charAt(0).toUpperCase() + txt.slice(1)
  })()
  const courtsLabel = `${courtsPerRound} ${courtsPerRound === 1 ? 'bane' : 'baner'}`
  const durationLabel = DURATION_OPTIONS.find((d) => d.value === durationMinutes)?.label ?? `${durationMinutes} min`
  const levelLabel = formatPlaytomicLevelRange(levelMin, levelMax)
  const priceLabel = pricePerPerson === 0 ? 'Gratis' : `${formatPrice(pricePerPerson)} · ${paymentLabel}`
  const resume = [`${shortDate} · ${timeSlot}–${endTime}`, `${playerSlots} spillere`, courtsLabel].join(' · ')
  const goBack = () => {
    if (step > 1) setStep((s) => (s - 1) as 1 | 2 | 3)
    else onCancel?.()
  }
  const editAt = (target: 1 | 2, row?: string) => {
    setStep(target)
    setOpen(row ?? null)
  }

  return (
    <div className="pm-opret" style={{ marginBottom: 0 }}>
      <div className="pm-opret-head">
        <span className="pm-opret-head-kicker">
          Trin {step} af 3 · {STEP_LABELS[step - 1]}
        </span>
        <div className="pm-opret-steps" role="img" aria-label={`Trin ${step} af 3: ${STEP_LABELS[step - 1]}`}>
          {[1, 2, 3].map((n) => <span key={n} data-done={n <= step ? 'true' : 'false'} />)}
        </div>
        <p className="pm-opret-head-title" aria-live="polite">{name.trim() || `Ny ${formatLabel}`}</p>
        <p className="pm-opret-head-resume">{resume}</p>
      </div>

      {/* ── Trin 1: Info ── */}
      {step === 1 && (
        <>
          <div className="pm-opret-card">
            <Row id="format" label="Format" value={formatLabel} open={open === 'format'} onToggle={() => toggle('format')}>
              <div className="pm-opret-options" role="group" aria-label="Vælg format">
                {([
                  { id: 'americano', label: 'Americano', desc: 'Makkerne skifter efter en fast plan, så alle spiller med alle.' },
                  { id: 'mexicano', label: 'Mexicano', desc: 'Makkerne skifter efter stillingen, så kampene bliver jævne.' },
                ] as const).map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    className="pm-opret-option"
                    aria-pressed={tournamentFormat === o.id}
                    onClick={() => { setTournamentFormat(o.id); setOpen(null) }}
                  >
                    <b>{o.label}</b>
                    <span>{o.desc}</span>
                  </button>
                ))}
              </div>
            </Row>

            <div ref={nameFieldRef}>
              <Row
                id="navn"
                label="Navn"
                value={name.trim() || <span style={{ fontWeight: 600, color: theme.textLight }}>Skriv et navn</span>}
                open={open === 'navn'}
                onToggle={() => toggle('navn')}
                error={step1Error}
              >
                <input
                  id="americano-create-name"
                  ref={nameInputRef}
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value)
                    if (step1Error) setStep1Error(null)
                  }}
                  onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}
                  placeholder={`Fx Fredags ${formatLabel}`}
                  aria-label="Turneringens navn"
                  style={{
                    ...inputStyle,
                    ...(step1Error ? { borderColor: theme.red, boxShadow: `0 0 0 1px color-mix(in srgb, ${theme.red} 27%, transparent)` } : {}),
                  }}
                  aria-invalid={step1Error ? true : undefined}
                  aria-describedby={step1Error ? 'pm-opret-am-error-navn' : undefined}
                />
              </Row>
            </div>

            <Row id="center" label="Center" value={chosenCourtName || 'Ikke valgt endnu'} open={open === 'center'} onToggle={() => toggle('center')}>
              <VenueRegionPicker
                value={courtId}
                onChange={setCourtId}
                options={selectOptions}
                placeholder="Ikke valgt endnu"
                ariaLabel="Vælg bane til turnering"
              />
              {isMatchVenueCustom(courtId) ? (
                <input
                  type="text"
                  value={customCourt}
                  onChange={(e) => setCustomCourt(e.target.value.slice(0, CUSTOM_COURT_NAME_MAX))}
                  placeholder="Skriv banens navn, fx Padelhallen Køge"
                  aria-label="Banens navn"
                  maxLength={CUSTOM_COURT_NAME_MAX}
                  style={{ ...inputStyle, marginTop: 8 }}
                />
              ) : null}
            </Row>

            <Row id="dag" label="Dag" value={shortDate} open={open === 'dag'} onToggle={() => toggle('dag')}>
              <div className="pm-opret-chips pm-opret-chips--days" role="group" aria-label="Vælg dag">
                {days.map((d) => (
                  <button
                    key={d.iso}
                    type="button"
                    className="pm-opret-chip pm-opret-chip--day"
                    aria-pressed={date === d.iso}
                    onClick={() => { setDate(d.iso); setOpen(null) }}
                  >
                    <span className="pm-opret-chip-top">{d.top}</span>
                    <span className="pm-opret-chip-num">{d.num}</span>
                  </button>
                ))}
              </div>
              <label style={{ ...labelSmall, marginTop: 12 }}>{dayInQuick ? 'Eller vælg en anden dato' : 'Dato'}</label>
              <DateInputField
                value={date}
                min={todayIso}
                onChange={(e: { target: { value: string } }) => setDate(e.target.value)}
                inputStyle={{ ...inputStyle, marginBottom: 0 }}
                aria-label="Dato"
              />
            </Row>

            <Row id="tid" label="Tid" value={`${timeSlot}–${endTime}`} open={open === 'tid'} onToggle={() => toggle('tid')}>
              <div className="pm-opret-chips" role="group" aria-label="Vælg starttid">
                {QUICK_TIMES.map((t) => (
                  <button key={t} type="button" className="pm-opret-chip" aria-pressed={timeSlot === t} onClick={() => { setTimeSlot(t); setOpen(null) }}>
                    {t}
                  </button>
                ))}
              </div>
              <label htmlFor="americano-create-time" style={{ ...labelSmall, marginTop: 12 }}>Andet tidspunkt</label>
              <select id="americano-create-time" value={timeSlot} onChange={(e) => setTimeSlot(e.target.value)} style={inputStyle}>
                {TIME_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </Row>

            <Row id="varighed" label="Varighed" value={durationLabel} open={open === 'varighed'} onToggle={() => toggle('varighed')}>
              <div className="pm-opret-chips" role="group" aria-label="Vælg varighed">
                {DURATION_OPTIONS.map((d) => (
                  <button key={d.value} type="button" className="pm-opret-chip" aria-pressed={durationMinutes === d.value} onClick={() => { setDurationMinutes(d.value); setOpen(null) }}>
                    {d.label}
                  </button>
                ))}
              </div>
            </Row>

            <Row id="spillere" label="Spillere" value={`${playerSlots} spillere · ${courtsLabel}`} open={open === 'spillere'} onToggle={() => toggle('spillere')}>
              <div className="pm-opret-stepper">
                <button
                  type="button"
                  className="pm-opret-step-btn"
                  aria-label="Færre spillere"
                  disabled={playerSlots <= PLAYER_OPTIONS[0]}
                  onClick={() => handlePlayerSlotsChange(Math.max(PLAYER_OPTIONS[0], playerSlots - 1))}
                >−</button>
                <span className="pm-opret-step-num" aria-live="polite">{playerSlots}</span>
                <button
                  type="button"
                  className="pm-opret-step-btn pm-opret-step-btn--plus"
                  aria-label="Flere spillere"
                  disabled={playerSlots >= PLAYER_OPTIONS[PLAYER_OPTIONS.length - 1]}
                  onClick={() => handlePlayerSlotsChange(Math.min(PLAYER_OPTIONS[PLAYER_OPTIONS.length - 1], playerSlots + 1))}
                >+</button>
                <p className="pm-opret-hint" style={{ margin: 0, flex: 1 }}>
                  4 til 16 spillere. Antal baner følger spillerantallet.{' '}
                  {playerSlots % 4 !== 0
                    ? `${benchCountPerRound(playerSlots, courtsPerRound)} sidder over pr. runde.`
                    : 'Alle er på banen hver runde.'}
                </p>
              </div>
            </Row>

            <Row id="point" label="Point" value={`${pointsPerMatch} point pr. kamp`} open={open === 'point'} onToggle={() => toggle('point')}>
              <div className="pm-opret-chips pm-opret-chips--3" role="group" aria-label="Vælg point pr. kamp">
                {POINT_OPTIONS.map((p) => (
                  <button key={p} type="button" className="pm-opret-chip" aria-pressed={pointsPerMatch === p} onClick={() => { setPointsPerMatch(p); setOpen(null) }}>
                    {p} point
                  </button>
                ))}
              </div>
              <p className="pm-opret-hint">Pointene fordeles mellem holdene i hver kamp, fx 10–6 ved 16 point.</p>
            </Row>
          </div>

          <h3 className="pm-opret-section">Valgfrit</h3>
          <div className="pm-opret-card">
            <Row id="niveau" label="Niveau" wide value={levelLabel} open={open === 'niveau'} onToggle={() => toggle('niveau')}>
              <div className="pm-level-range-box">
                <LevelRangeSlider minVal={levelMin} maxVal={levelMax} onMinChange={setLevelMin} onMaxChange={setLevelMax} />
              </div>
              <p className="pm-opret-hint">
                Spillere på niveau {levelLabel} matcher turneringen. Du kan kræve niveauet ved tilmelding i trin 3.
              </p>
            </Row>
            <Row
              id="laengde"
              label="Kamplængde"
              wide
              value={opponentPasses === 2 ? `Lang · ${schedulePreview.longRounds} runder` : `Normal · ${schedulePreview.normalRounds} runder`}
              open={open === 'laengde'}
              onToggle={() => toggle('laengde')}
            >
              <div className="pm-opret-chips pm-opret-chips--2" role="group" aria-label="Vælg kamplængde">
                <button type="button" className="pm-opret-chip" aria-pressed={opponentPasses === 1} onClick={() => setOpponentPasses(1)}>
                  Normal ({schedulePreview.normalRounds} runder)
                </button>
                <button type="button" className="pm-opret-chip" aria-pressed={opponentPasses === 2} onClick={() => setOpponentPasses(2)}>
                  Lang ({schedulePreview.longRounds} runder)
                </button>
              </div>
              <p className="pm-opret-hint">
                Estimeret: <strong>{schedulePreview.estSelectedLabel}</strong> (ca. {schedulePreview.minPerRound} min pr. runde)
              </p>
            </Row>
            <Row id="regler" label="Særlige regler" wide value={description.trim() ? 'Udfyldt' : 'Ingen'} open={open === 'regler'} onToggle={() => toggle('regler')}>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="Fx golden point eller tidsbegrænsning på 15 min"
                aria-label="Særlige regler"
                style={{ ...inputStyle, height: 'auto', resize: 'vertical' }}
              />
            </Row>
          </div>
        </>
      )}

      {/* ── Trin 2: Pris ── */}
      {step === 2 && (
        <>
          <div className="pm-opret-card" style={{ padding: 16 }}>
            <label htmlFor="americano-create-price" style={labelSmall}>Pris pr. person</label>
            <div className="pm-opret-stepper">
              <button
                type="button"
                className="pm-opret-step-btn"
                aria-label="10 kr. mindre"
                onClick={() => { const n = Math.max(0, Math.round((pricePerPerson - 10) * 100) / 100); setPricePerPerson(n); setPriceInput(String(n)) }}
              >−</button>
              <div style={{ flex: 1, position: 'relative' }}>
                <input
                  id="americano-create-price"
                  type="text"
                  inputMode="decimal"
                  value={priceInput}
                  onChange={e => syncPrice(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && e.preventDefault()}
                  onBlur={() => {
                    const display = pricePerPerson === 0 ? '0' : pricePerPerson % 1 === 0 ? String(pricePerPerson) : pricePerPerson.toFixed(2).replace('.', ',')
                    setPriceInput(display)
                  }}
                  style={{ ...inputStyle, height: 48, textAlign: 'center', fontWeight: 800, fontSize: 20, paddingRight: 36 }}
                />
                <span className="pm-opret-suffix">kr.</span>
              </div>
              <button
                type="button"
                className="pm-opret-step-btn pm-opret-step-btn--plus"
                aria-label="10 kr. mere"
                onClick={() => { const n = Math.min(5000, Math.round((pricePerPerson + 10) * 100) / 100); setPricePerPerson(n); setPriceInput(String(n)); if (paymentMethod === 'free') setPaymentMethod('mobilepay') }}
              >+</button>
            </div>
            <p className="pm-opret-hint">Sæt til 0 kr., hvis turneringen er gratis.</p>

            <span style={{ ...labelSmall, marginTop: 16 }}>Betaling</span>
            <div className="pm-opret-chips pm-opret-chips--3" role="group" aria-label="Vælg betaling">
              {PAYMENT_OPTIONS.map(o => (
                <button
                  key={o.id}
                  type="button"
                  className="pm-opret-chip"
                  aria-pressed={paymentMethod === o.id}
                  onClick={() => {
                    setPaymentMethod(o.id as typeof paymentMethod)
                    if (o.id === 'free') { setPricePerPerson(0); setPriceInput('0') }
                  }}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>
          <p className="pm-opret-note">
            Du får besked, når nogen tilmelder sig. Betalingen afregnes direkte mellem jer. PadelMakker tager ikke gebyr.
          </p>
        </>
      )}

      {/* ── Trin 3: Publicér ── */}
      {step === 3 && (
        <>
          <div className="pm-opret-card">
            {[
              { label: 'Format', value: `${formatLabel} · ${pointsPerMatch} point`, target: 1 as const, row: 'format' },
              { label: 'Hvornår', value: `${shortDate} · ${timeSlot}–${endTime}`, target: 1 as const, row: 'dag' },
              { label: 'Center', value: courtLabel || 'Ikke valgt endnu', target: 1 as const, row: 'center' },
              { label: 'Spillere', value: `${playerSlots} spillere · ${courtsLabel}`, target: 1 as const, row: 'spillere' },
              { label: 'Niveau', value: levelLabel, target: 1 as const, row: 'niveau' },
              { label: 'Betaling', value: priceLabel, target: 2 as const, row: undefined },
            ].map((r) => (
              <div key={r.label} className="pm-opret-row-wrap">
                <button type="button" className="pm-opret-row" onClick={() => editAt(r.target, r.row)} aria-label={`Ret ${r.label.toLowerCase()}: ${r.value}`}>
                  <span className="pm-opret-row-label">{r.label}</span>
                  <span className="pm-opret-row-value">{r.value}</span>
                  <span className="pm-opret-row-edit">Ret</span>
                </button>
              </div>
            ))}
          </div>

          <h3 className="pm-opret-section">Hvem kan se og tilmelde sig</h3>
          <div className="pm-opret-card">
            <SwitchRow
              title="Offentlig turnering"
              desc="Alle kan se og tilmelde sig"
              on={isPublic}
              onChange={setIsPublic}
            />
            <SwitchRow
              title={`Kun niveau ${levelLabel} kan tilmelde sig`}
              desc={enforceLevelInterval ? 'Niveauet håndhæves ved tilmelding' : 'Alle niveauer kan tilmelde sig'}
              on={enforceLevelInterval}
              onChange={setEnforceLevelInterval}
            />
          </div>

          {error && <div role="alert" className="pm-opret-error pm-opret-error--general">{error}</div>}
        </>
      )}

      {/* ── Navigation ── */}
      <div className="pm-opret-actions">
        {step < 3 ? (
          <button type="button" className="pm-opret-cta" onClick={goNext}>
            {step === 1 ? 'Næste: Pris' : 'Næste: Publicér'}
          </button>
        ) : (
          <button type="button" className="pm-opret-cta" disabled={submitting} onClick={doSubmit}>
            {submitting ? 'Publicerer…' : `Publicér ${formatLabel}`}
          </button>
        )}
        <p className="pm-opret-foot">
          {step < 3
            ? 'Turneringen bliver først synlig, når du publicerer i trin 3.'
            : 'Du kan rette bane, dato og tid bagefter.'}
        </p>
        {step > 1 || onCancel ? (
          <button type="button" className="pm-opret-cancel" onClick={goBack} disabled={submitting}>
            {step > 1 ? 'Tilbage' : 'Annullér'}
          </button>
        ) : null}
      </div>
    </div>
  )
}

const labelSmall: React.CSSProperties = {
  display: 'block',
  fontSize: 12,
  fontWeight: 600,
  marginBottom: 6,
  color: 'var(--pm-text)',
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '10px 12px',
  height: 44,
  lineHeight: '20px',
  borderRadius: 12,
  border: '1.5px solid var(--pm-border)',
  fontSize: 14,
  fontFamily: "var(--pm-font)",
  background: 'var(--pm-surface)',
  color: 'var(--pm-text)',
  display: 'block',
}
