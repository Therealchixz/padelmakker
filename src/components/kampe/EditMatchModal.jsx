/**
 * "Ret bane, dato og tid" for opretteren af en kamp (før den er startet).
 * Samme felter som i opret-guiden. Selve gemningen sker i KampeTab.
 */
import { useMemo, useState } from 'react';
import { AppModal } from '../AppModal';
import { DateInputField } from '../DateInputField';
import { PillTabs } from '../PillTabs';
import { VenueRegionPicker } from '../VenueRegionPicker';
import { btn, inputStyle, labelStyle, theme } from '../../lib/platformTheme';
import { TIME_OPTIONS } from '../../lib/timeSlotOptions';
import { MATCH_VENUE_TBD, isMatchVenueTbd } from '../../lib/matchVenueOptions';
import { buildMatchEditPatch, initialMatchEditForm } from '../../lib/matchEdit.js';

const BOOKED_TABS = [
  { id: 'yes', label: 'Ja, booket' },
  { id: 'no', label: 'Nej, ikke endnu' },
];

export function EditMatchModal({ match, venueOptions, saving = false, onSave, onClose }) {
  const [form, setForm] = useState(() => initialMatchEditForm(match, venueOptions));
  const [error, setError] = useState('');

  const pickerOptions = useMemo(
    () => (form.court_booked
      ? venueOptions
      : [{ id: MATCH_VENUE_TBD, label: 'Ikke valgt endnu', courtId: null }, ...venueOptions]),
    [form.court_booked, venueOptions],
  );
  // Tidspunkter uden for listen (fx 18:15) bevares som valgmulighed.
  const timeOptions = TIME_OPTIONS.includes(form.time) ? TIME_OPTIONS : [form.time, ...TIME_OPTIONS];

  const set = (patch) => {
    setForm((f) => ({ ...f, ...patch }));
    setError('');
  };

  const save = () => {
    const { patch, error: err } = buildMatchEditPatch(form, match, venueOptions);
    if (!patch) {
      setError(err);
      return;
    }
    onSave?.(patch);
  };

  return (
    <AppModal open onClose={saving ? undefined : onClose} ariaLabel="Ret kamp" maxWidthPreset="md" showClose>
      <div style={{ padding: '18px 18px 16px' }}>
        <h2 style={{ fontSize: 18, fontWeight: 800, margin: '0 0 4px', color: theme.text }}>Ret bane, dato og tid</h2>
        <p style={{ fontSize: 13, color: theme.textMid, margin: '0 0 16px', lineHeight: 1.45 }}>
          De andre spillere får en besked i kamp-chatten om ændringen.
        </p>

        <label style={labelStyle}>Har du booket en bane?</label>
        <PillTabs
          tabs={BOOKED_TABS}
          value={form.court_booked ? 'yes' : 'no'}
          onChange={(id) => {
            const booked = id === 'yes';
            let venue = form.venue;
            if (booked && isMatchVenueTbd(venue)) venue = venueOptions[0]?.id ?? MATCH_VENUE_TBD;
            set({ court_booked: booked, venue });
          }}
          ariaLabel="Bane booket"
          size="sm"
          style={{ margin: '4px 0 14px' }}
        />

        <label style={labelStyle}>{form.court_booked ? 'Hvilken bane er booket?' : 'Hvor vil du helst spille? (valgfrit)'}</label>
        <VenueRegionPicker
          value={form.venue}
          onChange={(id) => set({ venue: id })}
          options={pickerOptions}
          placeholder={form.court_booked ? 'Vælg booket center' : 'Ikke valgt endnu'}
          ariaLabel={form.court_booked ? 'Vælg booket bane' : 'Vælg foretrukket center'}
        />

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

        {error ? (
          <div role="alert" style={{ color: theme.red, fontSize: 13, margin: '4px 0 10px' }}>{error}</div>
        ) : null}

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
  );
}
