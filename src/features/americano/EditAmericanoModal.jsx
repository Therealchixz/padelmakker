/**
 * "Ret bane, dato og tid" for opretteren af en Americano/Mexicano (før start).
 * Samme opbygning som EditMatchModal for kampe. Gemningen sker i AmericanoTab.
 */
import { useMemo, useState } from 'react'
import { AppModal } from '../../components/AppModal'
import { DateInputField } from '../../components/DateInputField'
import { VenueRegionPicker } from '../../components/VenueRegionPicker'
import { btn, inputStyle, labelStyle, theme } from '../../lib/platformTheme'
import { TIME_OPTIONS } from '../../lib/timeSlotOptions'
import {
  CUSTOM_COURT_NAME_MAX,
  CUSTOM_VENUE_OPTION,
  MATCH_VENUE_TBD,
  isMatchVenueCustom,
} from '../../lib/matchVenueOptions'
import { buildTournamentEditPatch, initialTournamentEditForm } from '../../lib/americanoEdit.js'

export function EditAmericanoModal({ tournament, venueOptions, saving = false, onSave, onClose }) {
  const [form, setForm] = useState(() => initialTournamentEditForm(tournament, venueOptions))
  const [error, setError] = useState('')

  const pickerOptions = useMemo(
    () => [{ id: MATCH_VENUE_TBD, label: 'Ikke valgt endnu', courtId: null }, CUSTOM_VENUE_OPTION, ...venueOptions],
    [venueOptions],
  )
  const timeOptions = TIME_OPTIONS.includes(form.time) ? TIME_OPTIONS : [form.time, ...TIME_OPTIONS]

  const set = (patch) => {
    setForm((f) => ({ ...f, ...patch }))
    setError('')
  }

  const save = () => {
    const { patch, error: err } = buildTournamentEditPatch(form, tournament, venueOptions)
    if (!patch) {
      setError(err)
      return
    }
    onSave(patch)
  }

  return (
    <AppModal open onClose={saving ? undefined : onClose} ariaLabel="Ret turnering" maxWidthPreset="md" showClose>
      <div style={{ padding: '18px 18px 16px' }}>
        <h2 style={{ fontSize: 18, fontWeight: 800, margin: '0 0 4px', color: theme.text }}>Ret bane, dato og tid</h2>
        <p style={{ fontSize: 13, color: theme.textMid, margin: '0 0 16px', lineHeight: 1.45 }}>
          De tilmeldte spillere får besked om ændringen.
        </p>

        <label style={labelStyle}>Hvor skal I spille?</label>
        <VenueRegionPicker
          value={form.venue}
          onChange={(id) => set({ venue: id })}
          options={pickerOptions}
          placeholder="Ikke valgt endnu"
          ariaLabel="Vælg bane"
        />
        {isMatchVenueCustom(form.venue) ? (
          <input
            type="text"
            value={form.custom_court}
            onChange={(e) => set({ custom_court: e.target.value.slice(0, CUSTOM_COURT_NAME_MAX) })}
            placeholder="Fx Padelhallen Køge"
            aria-label="Banens navn"
            maxLength={CUSTOM_COURT_NAME_MAX}
            autoFocus
            style={{ ...inputStyle, fontSize: '13px', marginTop: 8 }}
          />
        ) : null}

        <div className="pm-form-2col" style={{ marginTop: 14 }}>
          <div style={{ minWidth: 0 }}>
            <DateInputField
              label="Dato"
              labelStyle={labelStyle}
              value={form.date}
              min={new Date().toISOString().split('T')[0]}
              onChange={(e) => set({ date: e.target.value })}
              inputStyle={{ ...inputStyle, fontSize: '13px', marginBottom: 0 }}
            />
          </div>
          <div>
            <label style={labelStyle}>Starttid</label>
            <select value={form.time} onChange={(e) => set({ time: e.target.value })} style={{ ...inputStyle, fontSize: '13px' }}>
              {timeOptions.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={labelStyle}>Varighed</label>
            <select value={form.duration} onChange={(e) => set({ duration: e.target.value })} style={{ ...inputStyle, fontSize: '13px' }}>
              <option value="60">1 time</option>
              <option value="90">1½ time</option>
              <option value="120">2 timer</option>
              <option value="150">2½ timer</option>
              <option value="180">3 timer</option>
            </select>
          </div>
        </div>

        {error ? <div role="alert" style={{ color: theme.red, fontSize: 13, margin: '4px 0 10px' }}>{error}</div> : null}

        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <button type="button" onClick={onClose} disabled={saving} style={{ ...btn(false), flex: 1, justifyContent: 'center' }}>
            Fortryd
          </button>
          <button type="button" onClick={save} disabled={saving} style={{ ...btn(true), flex: 1, justifyContent: 'center' }}>
            {saving ? 'Gemmer…' : 'Gem ændringer'}
          </button>
        </div>
      </div>
    </AppModal>
  )
}
