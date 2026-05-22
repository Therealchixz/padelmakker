/**
 * Dato-input med samme inputStyle som øvrige felter + dd-mm-åååå-hint når tom.
 */
export function DateInputField({
  label,
  value,
  onChange,
  labelStyle,
  inputStyle,
  min,
  className = '',
}) {
  const empty = !value;
  const baseInputStyle = inputStyle || {};
  const { marginBottom, ...inputRest } = baseInputStyle;
  const inputFieldStyle = {
    ...inputRest,
    marginBottom: 0,
    display: 'block',
  };

  return (
    <div
      className={`pm-form-field pm-date-input-wrap ${className}`.trim()}
      style={{ width: '100%', marginBottom: marginBottom ?? 0 }}
    >
      {label ? <label style={labelStyle}>{label}</label> : null}
      <div className="pm-date-input-shell">
        <input
          type="date"
          className={empty ? 'pm-date-input--empty' : undefined}
          value={value}
          min={min}
          onChange={onChange}
          style={inputFieldStyle}
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
