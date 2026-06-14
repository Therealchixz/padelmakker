import { useState, useEffect, useMemo, useCallback } from 'react'
import { benchCountPerRound } from '../../lib/americanoRoundRobinSchedule'
import {
  formatEstimatedDuration,
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

import { supabase } from '../../lib/supabase'
import { theme, btn } from '../../lib/platformTheme'
import type { AmericanoPlayerSlots, AmericanoPoints, AmericanoOpponentPasses, AmericanoTournamentFormat } from './types'
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

const PLAYER_OPTIONS: AmericanoPlayerSlots[] = [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]
const POINT_OPTIONS: AmericanoPoints[] = [16, 24, 32]

export const AMERICANO_COURT_NONE = AMERICANO_VENUE_NONE

function WizardIndicator({ step }: { step: 1 | 2 | 3 }) {
  const steps = [
    { n: 1, label: 'Info' },
    { n: 2, label: 'Indstillinger' },
    { n: 3, label: 'Publicér' },
  ]
  return (
    <div className="pm-wiz">
      {steps.map((s, i) => {
        const state = s.n < step ? 'done' : s.n === step ? 'on' : ''
        return (
          <>
            <div key={s.n} className={`pm-wiz-step${state ? ' ' + state : ''}`}>
              <div className="pm-wiz-num">
                {state === 'done' ? '✓' : s.n}
              </div>
              <span className="pm-wiz-label">{s.label}</span>
            </div>
            {i < steps.length - 1 && <div key={`line-${i}`} className="pm-wiz-line" />}
          </>
        )
      })}
    </div>
  )
}

function SegControl({
  options,
  value,
  onChange,
}: {
  options: { id: string; label: string }[]
  value: string
  onChange: (id: string) => void
}) {
  return (
    <div className="pm-seg">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          className={`pm-seg-btn${value === o.id ? ' active' : ''}`}
          onClick={() => onChange(o.id)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

function ChipsRow<T extends string | number>({
  options,
  value,
  onChange,
  labelFn,
}: {
  options: T[]
  value: T
  onChange: (v: T) => void
  labelFn?: (v: T) => string
}) {
  return (
    <div className="pm-chips-row">
      {options.map((o) => (
        <button
          key={String(o)}
          type="button"
          className={`pm-chip-btn${value === o ? ' active' : ''}`}
          onClick={() => onChange(o)}
        >
          {labelFn ? labelFn(o) : String(o)}
        </button>
      ))}
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
  const [name, setName] = useState('')
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0])
  const [timeSlot, setTimeSlot] = useState(() => nearestHalfHour())
  const venueOptions = useMemo(() => getMatchVenueOptions(courts), [courts])
  const selectOptions = useMemo(
    () => [
      { id: AMERICANO_COURT_NONE, label: 'Ikke valgt / anden bane', courtId: null as string | null },
      ...venueOptions,
    ],
    [venueOptions]
  )
  const [courtId, setCourtId] = useState(AMERICANO_COURT_NONE)
  const [playerSlots, setPlayerSlots] = useState<AmericanoPlayerSlots>(8)
  const [courtsPerRound, setCourtsPerRound] = useState(1)
  const [pointsPerMatch, setPointsPerMatch] = useState<AmericanoPoints>(16)
  const [opponentPasses, setOpponentPasses] = useState<AmericanoOpponentPasses>(1)
  const [tournamentFormat, setTournamentFormat] = useState<AmericanoTournamentFormat>('americano')
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [step1Error, setStep1Error] = useState<string | null>(null)

  const maxCourts = Math.floor(playerSlots / 4)
  const minCourts = Math.min(maxCourts, recommendedCourtsPerRound(playerSlots))
  const COURT_OPTIONS = Array.from({ length: maxCourts - minCourts + 1 }, (_, i) => minCourts + i)

  const schedulePreview = useMemo(
    () =>
      getCreateFormSchedulePreview({
        format: tournamentFormat,
        playerSlots,
        courtsPerRound,
        opponentPasses,
        pointsPerMatch,
      }),
    [tournamentFormat, playerSlots, courtsPerRound, opponentPasses, pointsPerMatch],
  )

  const handlePlayerSlotsChange = useCallback((n: AmericanoPlayerSlots) => {
    setPlayerSlots(n)
    setCourtsPerRound((prev) => {
      const max = Math.floor(n / 4)
      const min = Math.min(max, recommendedCourtsPerRound(n))
      return Math.max(min, Math.min(prev, max))
    })
  }, [])

  useEffect(() => {
    setCourtId((prev: string) => {
      const ids = new Set(selectOptions.map((o) => o.id))
      if (ids.has(prev)) return prev
      return AMERICANO_COURT_NONE
    })
  }, [selectOptions])

  const goNext = () => {
    if (step === 1) {
      if (!name.trim()) {
        setStep1Error('Angiv et navn til turneringen.')
        return
      }
      setStep1Error(null)
      setStep(2)
    } else if (step === 2) {
      setStep(3)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
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
          courts_per_round: schedulePreview.effectiveCourts,
          points_per_match: pointsPerMatch,
          opponent_passes: opponentPasses,
          format: tournamentFormat,
          description: description.trim() || null,
          status: 'registration',
        })
        .select('id')
        .single()

      if (insErr) throw insErr
      if (!row?.id) throw new Error('Ingen id returneret')

      const { error: partErr } = await supabase.from('americano_participants').insert({
        tournament_id: row.id,
        user_id: userId,
        display_name: displayName.trim() || 'Spiller',
      })
      if (partErr) throw partErr

      onCreated?.({
        id: row.id,
        name: n,
        format: tournamentFormat,
        tournament_date: date,
        time_slot: timeSlot,
        player_slots: playerSlots,
        points_per_match: pointsPerMatch,
        court_name: courtNameFromVenueSelection(courtId, selectOptions) || null,
      })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(msg.includes('americano') ? msg : `${msg} — Har du kørt americano_schema.sql i Supabase?`)
    } finally {
      setSubmitting(false)
    }
  }

  const formatLabel = tournamentFormat === 'mexicano' ? 'Mexicano' : 'Americano'

  return (
    <form onSubmit={handleSubmit} style={{ paddingBottom: 8 }}>
      <WizardIndicator step={step} />

      {/* Step 1: Info */}
      {step === 1 && (
        <>
          <div className="pm-field">
            <label>Format</label>
            <SegControl
              options={[
                { id: 'americano', label: 'Americano' },
                { id: 'mexicano', label: 'Mexicano' },
              ]}
              value={tournamentFormat}
              onChange={(v) => setTournamentFormat(v as AmericanoTournamentFormat)}
            />
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
              placeholder={`F.eks. Fredags ${formatLabel}`}
              style={inputStyle}
            />
            {step1Error && <div style={{ color: theme.red, fontSize: 12, marginTop: 6 }}>{step1Error}</div>}
          </div>

          <div className="pm-field">
            <label>Center / bane (valgfrit)</label>
            <VenueRegionPicker
              value={courtId}
              onChange={setCourtId}
              options={selectOptions}
              placeholder="Ikke valgt / anden bane"
              ariaLabel="Vælg bane til turnering"
            />
          </div>

          <div style={{ display: 'flex', gap: 10, margin: '0 18px 14px' }}>
            <div style={{ flex: 2, minWidth: 0 }}>
              <label style={labelSmall}>Dato</label>
              <input
                type="date"
                value={date}
                min={new Date().toISOString().split('T')[0]}
                onChange={(e) => setDate(e.target.value)}
                style={{ ...inputStyle, appearance: 'none', WebkitAppearance: 'none' }}
              />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <label style={labelSmall}>Tid</label>
              <select value={timeSlot} onChange={(e) => setTimeSlot(e.target.value)} style={inputStyle}>
                {TIME_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>

          <div className="pm-format-card">
            <b>{formatLabel}-format</b>
            <p>
              {tournamentFormat === 'mexicano'
                ? 'Spændende format hvor næste runde parres ud fra stilling. Hold skifter løbende.'
                : 'Klassisk format med fast rundeplan — alle møder alle, med skiftende makkere.'}
            </p>
          </div>
        </>
      )}

      {/* Step 2: Indstillinger */}
      {step === 2 && (
        <>
          <div className="pm-field">
            <label>Antal spillere</label>
            <div className="pm-chips-row" style={{ flexWrap: 'wrap' }}>
              {PLAYER_OPTIONS.map((p) => (
                <button
                  key={p}
                  type="button"
                  className={`pm-chip-btn${playerSlots === p ? ' active' : ''}`}
                  onClick={() => handlePlayerSlotsChange(p)}
                >
                  {p}
                </button>
              ))}
            </div>
            <div className="pm-field-hint">
              {playerSlots % 4 !== 0
                ? `${playerSlots % 4 === 1 || playerSlots % 4 === 3 ? benchCountPerRound(playerSlots, courtsPerRound) : 0} sidder over pr. runde`
                : 'Alle er på banen hver runde'}
            </div>
          </div>

          {COURT_OPTIONS.length > 1 && (
            <div className="pm-field">
              <label>Baner pr. runde</label>
              <ChipsRow
                options={COURT_OPTIONS}
                value={courtsPerRound}
                onChange={setCourtsPerRound}
                labelFn={(c) => `${c} ${c === 1 ? 'bane' : 'baner'}`}
              />
            </div>
          )}

          <div className="pm-field">
            <label>Varighed</label>
            <div className="pm-chips-row">
              <button
                type="button"
                className={`pm-chip-btn${opponentPasses === 1 ? ' active' : ''}`}
                onClick={() => setOpponentPasses(1)}
              >
                Normal ({schedulePreview.normalRounds} runder)
              </button>
              <button
                type="button"
                className={`pm-chip-btn${opponentPasses === 2 ? ' active' : ''}`}
                onClick={() => setOpponentPasses(2)}
              >
                Lang ({schedulePreview.longRounds} runder)
              </button>
            </div>
            <div className="pm-field-hint">
              Estimeret: <strong>{schedulePreview.estSelectedLabel}</strong> (~{schedulePreview.minPerRound} min pr. runde)
            </div>
          </div>

          <div className="pm-field">
            <label>Point per kamp</label>
            <ChipsRow
              options={POINT_OPTIONS}
              value={pointsPerMatch}
              onChange={(v) => setPointsPerMatch(v as AmericanoPoints)}
              labelFn={(p) => `${p} point`}
            />
          </div>

          <div className="pm-field">
            <label>Beskrivelse <span style={{ fontWeight: 400, color: theme.textLight }}>(valgfrit)</span></label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Regler, niveau, hvem er velkomne..."
              style={{ ...inputStyle, height: 'auto', resize: 'vertical' }}
            />
          </div>
        </>
      )}

      {/* Step 3: Publicér */}
      {step === 3 && (
        <>
          <div style={{ margin: '0 18px 16px', background: 'var(--pm-surface-muted)', border: '1px solid var(--pm-americano-tie-border)', borderRadius: 14, padding: '16px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: theme.textLight, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 10 }}>
              Oversigt
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { label: 'Format', value: formatLabel },
                { label: 'Navn', value: name || '—' },
                { label: 'Dato', value: `${date} kl. ${timeSlot}` },
                { label: 'Spillere', value: `${playerSlots} spillere` },
                { label: 'Runder', value: `${schedulePreview.selectedRounds} runder` },
                { label: 'Estimeret tid', value: schedulePreview.estSelectedLabel },
                { label: 'Point pr. kamp', value: `${pointsPerMatch} point` },
              ].map((row) => (
                <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                  <span style={{ fontSize: 12, color: theme.textLight }}>{row.label}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: theme.text, textAlign: 'right' }}>{row.value}</span>
                </div>
              ))}
            </div>
          </div>

          {error && (
            <div style={{ margin: '0 18px 12px', color: theme.red, fontSize: 13 }}>{error}</div>
          )}
        </>
      )}

      {/* Navigation buttons */}
      <div style={{ display: 'flex', gap: 10, padding: '4px 18px 4px' }}>
        {step > 1 ? (
          <button
            type="button"
            onClick={() => setStep((s) => (s - 1) as 1 | 2 | 3)}
            style={{ ...btn(false, { size: 'md', fontWeight: 600 }), flex: 1 }}
          >
            ← Tilbage
          </button>
        ) : onCancel ? (
          <button type="button" onClick={onCancel} style={{ ...btn(false, { size: 'md', fontWeight: 600 }), flex: 1 }}>
            Annullér
          </button>
        ) : null}

        {step < 3 ? (
          <button
            type="button"
            onClick={goNext}
            style={{ ...btn(true, { size: 'md', fontWeight: 600 }), flex: 2 }}
          >
            Næste →
          </button>
        ) : (
          <button
            type="submit"
            disabled={submitting}
            style={{ ...btn(true, { size: 'md', fontWeight: 600 }), flex: 2, cursor: submitting ? 'wait' : 'pointer' }}
          >
            {submitting ? 'Opretter…' : `Opret ${formatLabel}`}
          </button>
        )}
      </div>
    </form>
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
}
