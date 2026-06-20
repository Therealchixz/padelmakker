import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { benchCountPerRound } from '../../lib/americanoRoundRobinSchedule'
import {
  getCreateFormSchedulePreview,
  recommendedCourtsPerRound,
} from './americanoDisplayUtils'

function nearestHalfHour(): string {
  const now = new Date()
  const h = now.getHours()
  const m = now.getMinutes()
  if (m < 15) return `${String(h).padStart(2, '0')}:00`
  if (m < 45) return `${String(h).padStart(2, '0')}:30`
  return `${String((h + 1) % 24).padStart(2, '0')}:00`
}

const TIME_OPTIONS: string[] = []
for (let h = 6; h <= 23; h++) {
  TIME_OPTIONS.push(`${String(h).padStart(2, '0')}:00`)
  TIME_OPTIONS.push(`${String(h).padStart(2, '0')}:30`)
}

const PAYMENT_OPTIONS = [
  { id: 'mobilepay', label: 'MobilePay' },
  { id: 'cash', label: 'Ved fremmøde' },
  { id: 'free', label: 'Gratis' },
]

// Full range 4–16, matching the original
const PLAYER_OPTIONS = [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]

const RANGE_MIN = 1.0
const RANGE_MAX = 5.0
const RANGE_STEP = 0.1

import { supabase } from '../../lib/supabase'
import { theme, btn } from '../../lib/platformTheme'
import type { AmericanoPoints, AmericanoOpponentPasses, AmericanoTournamentFormat } from './types'
import {
  getMatchVenueOptions,
  courtIdFromVenueSelection,
  courtNameFromVenueSelection,
  AMERICANO_VENUE_NONE,
} from '../../lib/matchVenueOptions'
import { VenueRegionPicker } from '../../components/VenueRegionPicker'

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

// ── Wizard indicator ──
function WizardIndicator({ step }: { step: 1 | 2 | 3 }) {
  return (
    <div className="pm-wiz">
      {([{ n: 1, label: 'Info' }, { n: 2, label: 'Pris' }, { n: 3, label: 'Publicér' }] as const).map((s, i) => {
        const state = s.n < step ? 'done' : s.n === step ? 'on' : ''
        return (
          <span key={s.n} style={{ display: 'contents' }}>
            <div className={`pm-wiz-step${state ? ' ' + state : ''}`}>
              <div className="pm-wiz-num">{state === 'done' ? '✓' : s.n}</div>
              <span className="pm-wiz-label">{s.label}</span>
            </div>
            {i < 2 && <div className="pm-wiz-line" />}
          </span>
        )
      })}
    </div>
  )
}

// ── Dual range slider ──
function LevelRangeSlider({
  minVal, maxVal,
  onMinChange, onMaxChange,
}: {
  minVal: number; maxVal: number
  onMinChange: (v: number) => void; onMaxChange: (v: number) => void
}) {
  const toPercent = (v: number) => ((v - RANGE_MIN) / (RANGE_MAX - RANGE_MIN)) * 100

  return (
    <div style={{ padding: '20px 8px 4px' }}>
      <div style={{ position: 'relative', height: 32 }}>
        {/* Track */}
        <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: 4, background: 'var(--pm-border)', borderRadius: 2, transform: 'translateY(-50%)', pointerEvents: 'none' }} />
        {/* Navy fill */}
        <div style={{ position: 'absolute', top: '50%', left: `${toPercent(minVal)}%`, right: `${100 - toPercent(maxVal)}%`, height: 4, background: 'var(--pm-navy)', borderRadius: 2, transform: 'translateY(-50%)', pointerEvents: 'none' }} />

        {/* Min knob tooltip */}
        <div style={{ position: 'absolute', top: -20, left: `${toPercent(minVal)}%`, transform: 'translateX(-50%)', background: 'var(--pm-navy)', color: '#fff', fontSize: 10.5, fontWeight: 700, padding: '2px 6px', borderRadius: 5, pointerEvents: 'none', whiteSpace: 'nowrap', zIndex: 6 }}>
          {minVal.toFixed(1)}
        </div>
        {/* Max knob tooltip */}
        <div style={{ position: 'absolute', top: -20, left: `${toPercent(maxVal)}%`, transform: 'translateX(-50%)', background: 'var(--pm-navy)', color: '#fff', fontSize: 10.5, fontWeight: 700, padding: '2px 6px', borderRadius: 5, pointerEvents: 'none', whiteSpace: 'nowrap', zIndex: 6 }}>
          {maxVal.toFixed(1)}
        </div>

        {/* Min range input */}
        <input
          type="range" min={RANGE_MIN} max={RANGE_MAX} step={RANGE_STEP} value={minVal}
          onChange={e => { const v = parseFloat(e.target.value); if (v < maxVal) onMinChange(v) }}
          style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', appearance: 'none', WebkitAppearance: 'none', background: 'transparent', cursor: 'pointer', zIndex: minVal > maxVal - RANGE_STEP ? 5 : 4, margin: 0 }}
          className="pm-range-input"
        />
        {/* Max range input */}
        <input
          type="range" min={RANGE_MIN} max={RANGE_MAX} step={RANGE_STEP} value={maxVal}
          onChange={e => { const v = parseFloat(e.target.value); if (v > minVal) onMaxChange(v) }}
          style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', appearance: 'none', WebkitAppearance: 'none', background: 'transparent', cursor: 'pointer', zIndex: 4, margin: 0 }}
          className="pm-range-input"
        />
      </div>
      {/* Labels */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, padding: '0 2px' }}>
        {[1, 2, 3, 4, 5].map(l => (
          <span key={l} style={{ fontSize: 10, color: 'var(--pm-text-light)' }}>{l === 5 ? '5.0+' : `${l}.0`}</span>
        ))}
      </div>
    </div>
  )
}

// ── Toggle ──
function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      className={`pm-kampe-v2-toggle${on ? ' pm-kampe-v2-toggle--on' : ''}`}
      onClick={() => onChange(!on)}
      aria-pressed={on}
    >
      <span className="pm-kampe-v2-toggle-knob" />
    </button>
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

  // Step 1 state
  const [tournamentFormat, setTournamentFormat] = useState<AmericanoTournamentFormat>('americano')
  const [name, setName] = useState('')
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0])
  const [timeSlot, setTimeSlot] = useState(() => nearestHalfHour())
  const [durationMinutes, setDurationMinutes] = useState(120)
  const venueOptions = useMemo(() => getMatchVenueOptions(courts), [courts])
  const selectOptions = useMemo(
    () => [
      { id: AMERICANO_COURT_NONE, label: 'Ikke valgt / anden bane', courtId: null as string | null },
      ...venueOptions,
    ],
    [venueOptions]
  )
  const [courtId, setCourtId] = useState(AMERICANO_COURT_NONE)
  const [playerSlots, setPlayerSlots] = useState(8)
  const [pointsPerMatch, setPointsPerMatch] = useState<AmericanoPoints>(16)
  const [levelMin, setLevelMin] = useState(3.0)
  const [levelMax, setLevelMax] = useState(4.0)
  const [opponentPasses, setOpponentPasses] = useState<AmericanoOpponentPasses>(1)
  const [description, setDescription] = useState('')
  const [step1Error, setStep1Error] = useState<string | null>(null)

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
        court_name: courtNameFromVenueSelection(courtId, selectOptions) || null,
      })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(msg.includes('americano') ? msg : `${msg} — Har du kørt americano_schema.sql i Supabase?`)
    } finally {
      setSubmitting(false)
    }
  }

  const formatDanishDate = (d: string) => {
    const dt = new Date(d + 'T12:00:00')
    const days = ['Søndag', 'Mandag', 'Tirsdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lørdag']
    const months = ['januar', 'februar', 'marts', 'april', 'maj', 'juni', 'juli', 'august', 'september', 'oktober', 'november', 'december']
    return `${days[dt.getDay()]} d. ${dt.getDate()}. ${months[dt.getMonth()]}`
  }

  const formatPrice = (p: number) =>
    p === 0 ? 'Gratis' : (p % 1 === 0 ? `${p} kr.` : `${p.toFixed(2).replace('.', ',')} kr.`)

  const formatLabel = tournamentFormat === 'mexicano' ? 'Mexicano' : 'Americano'
  const courtLabel = courtNameFromVenueSelection(courtId, selectOptions)
  const paymentLabel = PAYMENT_OPTIONS.find(p => p.id === paymentMethod)?.label ?? paymentMethod

  const endTime = (() => {
    const [h, m] = timeSlot.split(':').map(Number)
    const end = h * 60 + m + durationMinutes
    return `${String(Math.floor(end / 60) % 24).padStart(2, '0')}:${String(end % 60).padStart(2, '0')}`
  })()

  return (
    <div style={{ paddingBottom: 8 }}>
      <WizardIndicator step={step} />

      {/* ── Step 1: Info ── */}
      {step === 1 && (
        <>
          <div className="pm-field">
            <label>Format</label>
            <div className="pm-seg">
              {([{ id: 'americano', label: 'Americano' }, { id: 'mexicano', label: 'Mexicano' }] as const).map(o => (
                <button key={o.id} type="button" className={`pm-seg-btn${tournamentFormat === o.id ? ' active' : ''}`} onClick={() => setTournamentFormat(o.id)}>
                  {o.label}
                </button>
              ))}
            </div>
            <div className="pm-field-hint">
              {tournamentFormat === 'mexicano'
                ? 'Efter runden parres spillere ud fra stilling. Runder genereres løbende.'
                : 'Hele planen genereres når turneringen startes — alle møder er planlagt på forhånd.'}
            </div>
          </div>

          <div className="pm-field">
            <label>Turneringens navn</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}
              placeholder={`F.eks. Fredags ${formatLabel}`}
              style={inputStyle}
            />
            {step1Error && <div style={{ color: theme.red, fontSize: 12, marginTop: 6 }}>{step1Error}</div>}
          </div>

          <div className="pm-field">
            <label>Vælg padel-center</label>
            <VenueRegionPicker
              value={courtId}
              onChange={setCourtId}
              options={selectOptions}
              placeholder="Ikke valgt / anden bane"
              ariaLabel="Vælg bane til turnering"
            />
          </div>

          <div className="pm-field">
            <label>Antal spillere</label>
            <div className="pm-chips-row" style={{ flexWrap: 'wrap' }}>
              {PLAYER_OPTIONS.map((p) => (
                <button key={p} type="button" className={`pm-chip-btn${playerSlots === p ? ' active' : ''}`} onClick={() => handlePlayerSlotsChange(p)}>
                  {p}
                </button>
              ))}
            </div>
            <div className="pm-field-hint">
              {playerSlots % 4 !== 0
                ? `${benchCountPerRound(playerSlots, courtsPerRound)} sidder over pr. runde`
                : 'Alle er på banen hver runde'}
            </div>
          </div>

          <div className="pm-field">
            <label>Baner</label>
            <div style={{ margin: '0 18px', padding: '10px 14px', borderRadius: 12, border: '1px solid var(--pm-border)', background: 'var(--pm-surface-muted)', fontSize: 13, color: 'var(--pm-text-mid)', fontWeight: 600 }}>
              {courtsPerRound} {courtsPerRound === 1 ? 'bane' : 'baner'} · alle spiller hver runde
            </div>
            <div className="pm-field-hint">Antal baner følger spillerantallet (4 spillere pr. bane).</div>
          </div>

          <div className="pm-field">
            <label>Dato</label>
            <input
              type="date"
              value={date}
              min={new Date().toISOString().split('T')[0]}
              onChange={(e) => setDate(e.target.value)}
              style={{ ...inputStyle, appearance: 'none', WebkitAppearance: 'none' }}
            />
          </div>

          <div style={{ display: 'flex', gap: 10, margin: '0 18px 14px' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <label style={labelSmall}>Starttid</label>
              <select value={timeSlot} onChange={(e) => setTimeSlot(e.target.value)} style={{ ...inputStyle, margin: 0 }}>
                {TIME_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <label style={labelSmall}>Varighed</label>
              <select value={durationMinutes} onChange={e => setDurationMinutes(Number(e.target.value))} style={{ ...inputStyle, margin: 0 }}>
                <option value={60}>1 time</option>
                <option value={90}>1½ time</option>
                <option value={120}>2 timer</option>
                <option value={150}>2½ timer</option>
                <option value={180}>3 timer</option>
              </select>
            </div>
          </div>

          <div className="pm-field">
            <label>Niveau-interval</label>
            <div style={{ margin: '0 18px', background: 'var(--pm-surface)', border: '1px solid var(--pm-border)', borderRadius: 12, padding: '0 8px 8px' }}>
              <LevelRangeSlider
                minVal={levelMin} maxVal={levelMax}
                onMinChange={setLevelMin} onMaxChange={setLevelMax}
              />
            </div>
            <div className="pm-field-hint">Niveau {levelMin.toFixed(1)}–{levelMax.toFixed(1)} · Kan håndhæves ved tilmelding (slås til i næste trin)</div>
          </div>

          <div className="pm-field">
            <label>Point pr. kamp</label>
            <div className="pm-chips-row">
              {POINT_OPTIONS.map((p) => (
                <button key={p} type="button" className={`pm-chip-btn${pointsPerMatch === p ? ' active' : ''}`} onClick={() => setPointsPerMatch(p)}>
                  {p} point
                </button>
              ))}
            </div>
            <div className="pm-field-hint">Pointene fordeles mellem holdene pr. kamp — fx 10–6 ved 16 point.</div>
          </div>

          <div className="pm-field">
            <label>Kamplængde</label>
            <div className="pm-chips-row">
              <button type="button" className={`pm-chip-btn${opponentPasses === 1 ? ' active' : ''}`} onClick={() => setOpponentPasses(1)}>
                Normal ({schedulePreview.normalRounds} runder)
              </button>
              <button type="button" className={`pm-chip-btn${opponentPasses === 2 ? ' active' : ''}`} onClick={() => setOpponentPasses(2)}>
                Lang ({schedulePreview.longRounds} runder)
              </button>
            </div>
            <div className="pm-field-hint">
              Estimeret: <strong>{schedulePreview.estSelectedLabel}</strong> (~{schedulePreview.minPerRound} min pr. runde)
            </div>
          </div>

          <div className="pm-field">
            <label>Særlige regler <span style={{ fontWeight: 400, color: theme.textLight }}>(valgfrit)</span></label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="F.eks. golden point, tidsbegrænsning på 15 min, etc."
              style={{ ...inputStyle, height: 'auto', resize: 'vertical' }}
            />
          </div>

          <div className="pm-format-card">
            <b>{formatLabel}-format</b>
            <p>
              {tournamentFormat === 'mexicano'
                ? 'Et spændende format hvor banerne skifter baseret på spillernes point — vinderne rykker op, og alle får jævnbyrdige kampe.'
                : 'Klassisk format med fast rundeplan — alle møder alle, med skiftende makkere.'}
            </p>
          </div>
        </>
      )}

      {/* ── Step 2: Pris & tilmelding ── */}
      {step === 2 && (
        <>
          <div className="pm-field">
            <label>Pris pr. person</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '0 18px' }}>
              <button type="button" className="pm-stepper-btn" style={{ width: 42, height: 42, flexShrink: 0 }}
                onClick={() => { const n = Math.max(0, Math.round((pricePerPerson - 10) * 100) / 100); setPricePerPerson(n); setPriceInput(String(n)) }}>−</button>
              <div style={{ flex: 1, position: 'relative' }}>
                <input
                  type="text"
                  inputMode="decimal"
                  value={priceInput}
                  onChange={e => syncPrice(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && e.preventDefault()}
                  onBlur={() => {
                    const display = pricePerPerson === 0 ? '0' : pricePerPerson % 1 === 0 ? String(pricePerPerson) : pricePerPerson.toFixed(2).replace('.', ',')
                    setPriceInput(display)
                  }}
                  style={{ ...inputStyle, margin: 0, textAlign: 'center', fontWeight: 700, fontSize: 18, paddingRight: 30 }}
                />
                <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 14, color: theme.textLight, pointerEvents: 'none' }}>kr.</span>
              </div>
              <button type="button" className="pm-stepper-btn" style={{ width: 42, height: 42, flexShrink: 0 }}
                onClick={() => { const n = Math.min(5000, Math.round((pricePerPerson + 10) * 100) / 100); setPricePerPerson(n); setPriceInput(String(n)); if (paymentMethod === 'free') setPaymentMethod('mobilepay') }}>+</button>
            </div>
            <div className="pm-field-hint">Sæt til 0 kr., hvis turneringen er gratis.</div>
          </div>

          <div className="pm-field">
            <label>Betaling</label>
            <div className="pm-chips-row">
              {PAYMENT_OPTIONS.map(o => (
                <button key={o.id} type="button"
                  className={`pm-chip-btn${paymentMethod === o.id ? ' active' : ''}`}
                  onClick={() => {
                    setPaymentMethod(o.id as typeof paymentMethod)
                    if (o.id === 'free') { setPricePerPerson(0); setPriceInput('0') }
                  }}>
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          {[
            { label: 'Offentlig turnering', desc: 'Alle kan se og tilmelde sig', value: isPublic, set: setIsPublic },
            { label: 'Kun niveau-interval kan tilmelde sig', desc: `Niveau ${levelMin.toFixed(1)}–${levelMax.toFixed(1)} håndhæves ved tilmelding`, value: enforceLevelInterval, set: setEnforceLevelInterval },
          ].map(row => (
            <div key={row.label} style={{ margin: '0 18px 12px', padding: '13px 15px', borderRadius: 14, border: '1px solid var(--pm-border)', background: 'var(--pm-surface)', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 13, color: theme.text }}>{row.label}</div>
                <div style={{ fontSize: 11.5, color: theme.textLight, marginTop: 2 }}>{row.desc}</div>
              </div>
              <Toggle on={row.value} onChange={row.set} />
            </div>
          ))}

          <div style={{ margin: '0 18px 16px', background: 'var(--pm-surface-muted)', border: '1px solid var(--pm-americano-tie-border)', borderRadius: 12, padding: '12px 14px', fontSize: 11.5, color: theme.textLight, lineHeight: 1.6 }}>
            Du får besked, når nogen tilmelder sig. Betalingen afregnes direkte mellem jer — PadelMakker tager ikke gebyr.
          </div>
        </>
      )}

      {/* ── Step 3: Publicér ── */}
      {step === 3 && (
        <>
          <div style={{ fontSize: 10.5, fontWeight: 700, color: theme.textLight, textTransform: 'uppercase', letterSpacing: '1.2px', margin: '0 18px 10px' }}>Sådan ser den ud for andre</div>

          {/* Preview card */}
          <div style={{ margin: '0 18px 16px', borderRadius: 16, overflow: 'hidden', border: '1px solid var(--pm-border)', boxShadow: 'var(--pm-shadow)' }}>
            <div style={{ background: 'linear-gradient(135deg, #0D2752 0%, #16377E 100%)', padding: '14px 14px 20px' }}>
              <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
                <span style={{ background: tournamentFormat === 'mexicano' ? '#F59E0B' : 'var(--pm-navy-deep)', color: tournamentFormat === 'mexicano' ? 'var(--pm-navy-deep)' : '#fff', border: tournamentFormat === 'mexicano' ? 'none' : '1px solid rgba(255,255,255,0.32)', fontSize: 9.5, fontWeight: 800, padding: '3px 8px', borderRadius: 5, letterSpacing: '0.6px', textTransform: 'uppercase' }}>
                  {formatLabel}
                </span>
                <span style={{ background: 'rgba(255,255,255,0.93)', color: 'var(--pm-navy-deep)', fontSize: 9.5, fontWeight: 700, padding: '3px 8px', borderRadius: 5 }}>
                  Niveau {levelMin.toFixed(1)}–{levelMax.toFixed(1)}
                </span>
              </div>
              {/* Padel court illustration */}
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '0 20px' }}>
                <div style={{ width: '100%', maxWidth: 220, height: 70, background: 'rgba(255,255,255,0.13)', borderRadius: 8, border: '2px solid rgba(255,255,255,0.22)', position: 'relative', overflow: 'hidden' }}>
                  <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 1.5, background: 'rgba(255,255,255,0.35)', transform: 'translateX(-50%)' }} />
                  <div style={{ position: 'absolute', left: '50%', top: '25%', bottom: '25%', width: 1.5, background: 'rgba(255,255,255,0.22)', transform: 'translateX(-50%)' }} />
                </div>
              </div>
            </div>
            <div style={{ padding: '12px 14px' }}>
              <div style={{ fontWeight: 700, fontSize: 15, color: theme.text, marginBottom: 6 }}>{name || `Fredags ${formatLabel}`}</div>
              <div style={{ fontSize: 12, color: theme.textLight, display: 'flex', alignItems: 'center', gap: 5, marginBottom: 3 }}>
                <svg style={{ width: 12, height: 12, flexShrink: 0 }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
                {formatDanishDate(date)} · {timeSlot}–{endTime}
              </div>
              {courtLabel && (
                <div style={{ fontSize: 12, color: theme.textLight, display: 'flex', alignItems: 'center', gap: 5 }}>
                  <svg style={{ width: 12, height: 12, flexShrink: 0 }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
                  {courtLabel}
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--pm-border)' }}>
                <div>
                  <div style={{ fontSize: 9, fontWeight: 700, color: theme.textLight, textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 1 }}>Pris</div>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{formatPrice(pricePerPerson)}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: theme.textLight, textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 1 }}>Pladser</div>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>0 / {playerSlots}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Summary table */}
          <div style={{ fontSize: 10.5, fontWeight: 700, color: theme.textLight, textTransform: 'uppercase', letterSpacing: '1.2px', margin: '0 18px 8px' }}>Opsummering</div>
          <div style={{ margin: '0 18px 14px', border: '1px solid var(--pm-border)', borderRadius: 14, background: 'var(--pm-surface)', overflow: 'hidden' }}>
            {[
              { label: 'Format', value: `${formatLabel} · ${pointsPerMatch} point pr. kamp` },
              { label: 'Spillere & baner', value: `${playerSlots} spillere · ${courtsPerRound} ${courtsPerRound === 1 ? 'bane' : 'baner'}` },
              { label: 'Betaling', value: pricePerPerson === 0 ? 'Gratis' : `${formatPrice(pricePerPerson)} · ${paymentLabel}` },
            ].map((row, i, arr) => (
              <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, padding: '9px 14px', borderBottom: i < arr.length - 1 ? '1px solid var(--pm-border)' : 'none' }}>
                <span style={{ fontSize: 12.5, color: theme.textLight, flexShrink: 0 }}>{row.label}</span>
                <span style={{ fontSize: 12.5, fontWeight: 600, color: theme.text, textAlign: 'right' }}>{row.value}</span>
              </div>
            ))}
          </div>

          <div style={{ margin: '0 18px 14px', background: 'var(--pm-surface-muted)', border: '1px solid var(--pm-americano-tie-border)', borderRadius: 12, padding: '12px 14px', fontSize: 11.5, color: theme.textLight, lineHeight: 1.6 }}>
            Turneringen bliver synlig under Turneringer og i aktivitetsfeedet for spillere i niveau-intervallet{courtLabel ? ` nær ${courtLabel}` : ''}.
          </div>

          {error && <div style={{ margin: '0 18px 12px', color: theme.red, fontSize: 13 }}>{error}</div>}
        </>
      )}

      {/* ── Navigation ── */}
      <div style={{ display: 'flex', gap: 10, padding: '4px 18px 4px' }}>
        {step > 1 ? (
          <button type="button" onClick={() => setStep((s) => (s - 1) as 1 | 2 | 3)} style={{ ...btn(false, { size: 'md', fontWeight: 600 }), flex: 1 }}>
            ← Tilbage
          </button>
        ) : onCancel ? (
          <button type="button" onClick={onCancel} style={{ ...btn(false, { size: 'md', fontWeight: 600 }), flex: 1 }}>
            Annullér
          </button>
        ) : null}

        {step < 3 ? (
          <button type="button" onClick={goNext} style={{ ...btn(true, { size: 'md', fontWeight: 600 }), flex: 2 }}>
            {step === 1 ? 'Næste: Pris & tilmelding →' : 'Næste: Publicér →'}
          </button>
        ) : (
          <button
            type="button"
            disabled={submitting}
            onClick={doSubmit}
            style={{ ...btn(true, { size: 'md', fontWeight: 600 }), flex: 2, cursor: submitting ? 'wait' : 'pointer' }}
          >
            {submitting ? 'Publicerer…' : `Publicér ${formatLabel} ✓`}
          </button>
        )}
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
  height: 42,
  lineHeight: '20px',
  borderRadius: 8,
  border: '1.5px solid var(--pm-border)',
  fontSize: 14,
  fontFamily: "'Inter', sans-serif",
  background: 'var(--pm-surface)',
  color: 'var(--pm-text)',
  display: 'block',
}
