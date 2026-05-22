/**
 * Dato-input — samme inputStyle som tekstfelter.
 * Tom: én dd-mm-åååå-hint (WebKit-felter skjult). Mobil: bredere input klippet i __clip.
 */
export function DateInputField({
  label,
  value,
  onChange,
  labelStyle,
  inputStyle,
  min,
}) {
  const empty = !value;
  const { marginBottom = '10px', ...fieldInputStyle } = inputStyle || {};

  return (
    <>
      {label ? <label style={labelStyle}>{label}</label> : null}
      <div className="pm-date-field" style={{ marginBottom }}>
        <div className="pm-date-field__clip">
          <input
            type="date"
            className={
              empty
                ? 'pm-date-field__input pm-date-field__input--empty'
                : 'pm-date-field__input'
            }
            value={value}
            min={min}
            onChange={onChange}
            style={{ ...fieldInputStyle, marginBottom: 0 }}
            aria-label={typeof label === 'string' ? label : undefined}
          />
          {empty ? (
            <span className="pm-date-field__hint" aria-hidden="true">
              dd-mm-åååå
            </span>
          ) : null}
        </div>
      </div>
    </>
  );
}
