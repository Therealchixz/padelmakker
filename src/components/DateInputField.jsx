/** ISO YYYY-MM-DD → dd-mm-åååå (visning i felt) */
function formatIsoForDisplay(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || '').trim());
  if (!m) return '';
  return `${m[3]}-${m[2]}-${m[1]}`;
}

/**
 * Dato-felt med samme look som inputStyle.
 * Synlig tekst i facade; gennemsigtigt type=date lag ovenpå (tap åbner kalender på mobil).
 */
export function DateInputField({
  label,
  value,
  onChange,
  labelStyle,
  inputStyle,
  min,
}) {
  const { marginBottom = '10px', ...fieldStyle } = inputStyle || {};
  const display = formatIsoForDisplay(value);
  const ariaLabel = typeof label === 'string' ? label : undefined;

  return (
    <>
      {label ? <label style={labelStyle}>{label}</label> : null}
      <div className="pm-date-field" style={{ marginBottom }}>
        <div className="pm-date-field__facade" style={fieldStyle} aria-hidden="true">
          {display ? (
            <span className="pm-date-field__value">{display}</span>
          ) : (
            <span className="pm-date-field__placeholder">dd-mm-åååå</span>
          )}
        </div>
        <input
          type="date"
          className="pm-date-field__overlay"
          value={value}
          min={min}
          onChange={onChange}
          aria-label={ariaLabel}
        />
      </div>
    </>
  );
}
