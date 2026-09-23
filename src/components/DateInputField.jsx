/** ISO YYYY-MM-DD → dd.mm.åååå (visning i felt, samme format som resten af appen) */
export function formatIsoForDisplay(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || '').trim());
  if (!m) return '';
  return `${m[3]}.${m[2]}.${m[1]}`;
}

/** HH:MM(:SS) → HH:MM (24-timers ur, også når telefonen står på engelsk) */
export function formatTimeForDisplay(value) {
  const m = /^(\d{1,2}):(\d{2})/.exec(String(value || '').trim());
  if (!m) return '';
  return `${m[1].padStart(2, '0')}:${m[2]}`;
}

/**
 * Dato-felt (eller tids-felt med type="time") med samme look som inputStyle.
 * Synlig tekst i facade; gennemsigtigt type=date lag ovenpå (tap åbner kalender på mobil).
 *
 * Det indbyggede felt viser datoen i telefonens/browserens sprog, så en
 * engelsk telefon viste 09/23/2026. Facaden viser altid dansk format.
 *
 * @param {{
 *   label?: import('react').ReactNode,
 *   value: string,
 *   onChange: (e: import('react').ChangeEvent<HTMLInputElement>) => void,
 *   labelStyle?: import('react').CSSProperties,
 *   inputStyle?: import('react').CSSProperties,
 *   min?: string,
 *   type?: 'date' | 'time',
 *   className?: string,
 *   [key: string]: unknown,
 * }} props
 */
export function DateInputField({
  label,
  value,
  onChange,
  labelStyle,
  inputStyle,
  min,
  type = 'date',
  className = '',
  ...inputProps
}) {
  const { marginBottom = '10px', ...fieldStyle } = inputStyle || {};
  const isTime = type === 'time';
  const display = isTime ? formatTimeForDisplay(value) : formatIsoForDisplay(value);
  const ariaLabel = typeof label === 'string' ? label : undefined;

  return (
    <>
      {label ? <label style={labelStyle}>{label}</label> : null}
      <div className={`pm-date-field${className ? ` ${className}` : ''}`} style={{ marginBottom }}>
        <div className="pm-date-field__facade" style={fieldStyle} aria-hidden="true">
          {display ? (
            <span className="pm-date-field__value">{display}</span>
          ) : (
            <span className="pm-date-field__placeholder">{isTime ? 'tt:mm' : 'dd.mm.åååå'}</span>
          )}
        </div>
        <input
          type={isTime ? 'time' : 'date'}
          className="pm-date-field__overlay"
          value={value}
          min={min}
          onChange={onChange}
          aria-label={ariaLabel}
          {...inputProps}
        />
      </div>
    </>
  );
}
