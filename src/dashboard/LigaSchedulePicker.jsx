/**
 * Tidsplan i "Opret liga" (ejeren 27. sep. 2026: frist, start og sæsonslut
 * stod lidt dårligt og kunne skabe forvirring). De tre datoer vises i den
 * rækkefølge, de sker, med en kort forklaring og hurtigvalg for sæsonens længde.
 */
import { DateInputField } from '../components/DateInputField';
import { formatMatchDateDa } from '../lib/matchDisplayUtils';
import { addDaysYmd, resolveLeagueEndDate, seasonLengthLabel } from '../lib/ligaCreateDefaults.js';

const LENGTH_WEEKS = [4, 6, 8];

function Step({ n, title, hint, error, children, last = false }) {
  return (
    <div className={`pm-liga-schedule-step${last ? ' pm-liga-schedule-step--last' : ''}`}>
      <div className="pm-liga-schedule-rail" aria-hidden="true">
        <span className="pm-liga-schedule-dot">{n}</span>
      </div>
      <div className="pm-liga-schedule-body">
        <div className="pm-liga-schedule-title">{title}</div>
        <div className="pm-liga-schedule-hint">{hint}</div>
        {children}
        {error ? <div role="alert" className="pm-liga-schedule-error">{error}</div> : null}
      </div>
    </div>
  );
}

/**
 * @param {{
 *   form: { registration_deadline: string, start_date: string, end_date: string, season_type?: string },
 *   onChange: (patch: object) => void,
 *   errors?: { registration_deadline?: string | null, start_date?: string | null, end_date?: string | null },
 *   inputStyle: import('react').CSSProperties,
 *   errorStyle: (hasError: boolean) => import('react').CSSProperties,
 *   startRef?: import('react').Ref<HTMLDivElement>,
 *   endRef?: import('react').Ref<HTMLDivElement>,
 * }} props
 */
export function LigaSchedulePicker({ form, onChange, errors = {}, inputStyle, errorStyle, startRef, endRef }) {
  const today = new Date().toISOString().slice(0, 10);
  const endShown = form.start_date
    ? (form.end_date || resolveLeagueEndDate(form.start_date, '', form.season_type))
    : '';
  const length = form.start_date ? seasonLengthLabel(form.start_date, endShown) : '';
  const activeWeeks = form.start_date && form.end_date
    ? LENGTH_WEEKS.find((w) => addDaysYmd(form.start_date, w * 7) === form.end_date)
    : null;

  return (
    <div className="pm-field">
      <label>Tidsplan</label>
      <div className="pm-liga-schedule">
        <Step
          n={1}
          title="Tilmeldingsfrist"
          hint="Sidste dag, hold kan melde sig til."
          error={errors.registration_deadline}
        >
          <DateInputField
            value={form.registration_deadline}
            min={today}
            max={form.start_date || undefined}
            onChange={(e) => onChange({ registration_deadline: e.target.value })}
            inputStyle={{ ...inputStyle, ...errorStyle(Boolean(errors.registration_deadline)) }}
            aria-label="Tilmeldingsfrist"
          />
        </Step>
        <div ref={startRef}>
          <Step n={2} title="Sæsonstart" hint="Første dag, der spilles kampe." error={errors.start_date}>
            <DateInputField
              value={form.start_date}
              min={form.registration_deadline || today}
              onChange={(e) => onChange({ start_date: e.target.value })}
              inputStyle={{ ...inputStyle, ...errorStyle(Boolean(errors.start_date)) }}
              aria-label="Sæsonstart"
            />
          </Step>
        </div>
        <div ref={endRef}>
          <Step n={3} title="Sæsonslut" hint="Alle kampe skal være spillet." error={errors.end_date} last>
            <div className="pm-liga-schedule-chips" role="group" aria-label="Sæsonens længde">
              {LENGTH_WEEKS.map((w) => (
                <button
                  key={w}
                  type="button"
                  className={`pm-liga-schedule-chip${activeWeeks === w ? ' pm-liga-schedule-chip--on' : ''}`}
                  disabled={!form.start_date}
                  onClick={() => onChange({ end_date: addDaysYmd(form.start_date, w * 7) })}
                >
                  {w} uger
                </button>
              ))}
            </div>
            <DateInputField
              value={form.end_date}
              min={form.start_date || today}
              onChange={(e) => onChange({ end_date: e.target.value })}
              inputStyle={{ ...inputStyle, ...errorStyle(Boolean(errors.end_date)) }}
              aria-label="Sæsonslut"
            />
          </Step>
        </div>
      </div>
      <div className="pm-field-hint">
        {form.start_date
          ? `Sæsonen varer ${length}: ${formatMatchDateDa(form.start_date)} – ${formatMatchDateDa(endShown)}${form.end_date ? '' : ' (standard, hvis du ikke vælger en slutdato)'}.`
          : 'Vælg sæsonstart, så kan du vælge, hvor længe ligaen skal vare.'}
      </div>
    </div>
  );
}
