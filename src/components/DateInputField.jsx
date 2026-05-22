/**
 * Dato-input — synlig boks på __clip (100 % bredde), ikke på input.
 * Undgår at WebKit type=date's indre min-bredde skubber border ud over kortet på mobil.
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

  const {
    width: _w,
    boxSizing: _bs,
    border,
    borderRadius,
    background,
    padding: _padding,
    transition,
    ...inputTypography
  } = fieldInputStyle;

  const boxStyle = {
    width: '100%',
    boxSizing: 'border-box',
    border,
    borderRadius,
    background,
    padding: 0,
    transition,
  };

  const inputInnerStyle = {
    ...inputTypography,
    width: '100%',
    boxSizing: 'border-box',
    margin: 0,
    border: 'none',
    background: 'transparent',
    outline: 'none',
    /* Samme som inputStyle + plads til kalender på mobil */
    padding: '10px 2.75rem 10px calc(var(--pm-space-2) + 2px)',
  };

  return (
    <>
      {label ? <label style={labelStyle}>{label}</label> : null}
      <div className="pm-date-field" style={{ marginBottom }}>
        <div className="pm-date-field__clip pm-date-field__box" style={boxStyle}>
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
            style={inputInnerStyle}
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
