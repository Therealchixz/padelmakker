/**
 * Dato-input med dd-mm-åååå-hint når tom (type="date" har ikke placeholder på mobil).
 */
export function DateInputField({
  label,
  value,
  onChange,
  labelStyle,
  min,
  className = '',
}) {
  const empty = !value;

  return (
    <div className={`pm-form-field pm-date-input-wrap ${className}`.trim()}>
      {label ? <label style={labelStyle}>{label}</label> : null}
      <div className={`pm-date-input-inner${empty ? ' pm-date-input-inner--empty' : ''}`}>
        <input
          type="date"
          className="pm-date-input-native"
          value={value}
          min={min}
          onChange={onChange}
          aria-label={typeof label === 'string' ? label : undefined}
        />
        {empty ? (
          <span className="pm-date-input-hint" aria-hidden="true">
            dd-mm-åååå
          </span>
        ) : null}
      </div>
    </div>
  );
}
