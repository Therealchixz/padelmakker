import { useRef } from 'react';

/** ISO YYYY-MM-DD → dd-mm-åååå (visning i felt) */
function formatIsoForDisplay(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || '').trim());
  if (!m) return '';
  return `${m[3]}-${m[2]}-${m[1]}`;
}

function openNativeDatePicker(nativeInput) {
  if (!nativeInput) return;
  try {
    if (typeof nativeInput.showPicker === 'function') {
      nativeInput.showPicker();
      return;
    }
  } catch {
    /* showPicker kan kaste hvis ikke i bruger-gesture */
  }
  nativeInput.focus();
  nativeInput.click();
}

/**
 * Dato-felt med samme look som inputStyle (tekst-input).
 * Synligt felt er type=text; native date-picker via skjult input (mobil-safe).
 */
export function DateInputField({
  label,
  value,
  onChange,
  labelStyle,
  inputStyle,
  min,
}) {
  const nativeRef = useRef(null);
  const { marginBottom = '10px', ...fieldStyle } = inputStyle || {};
  const display = formatIsoForDisplay(value);

  const openPicker = () => openNativeDatePicker(nativeRef.current);

  return (
    <>
      {label ? <label style={labelStyle}>{label}</label> : null}
      <div className="pm-date-field" style={{ marginBottom }}>
        <input
          type="text"
          readOnly
          className="pm-date-field__display"
          value={display}
          placeholder="dd-mm-åååå"
          style={fieldStyle}
          onClick={openPicker}
          onFocus={openPicker}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              openPicker();
            }
          }}
          aria-label={typeof label === 'string' ? label : undefined}
          autoComplete="off"
        />
        <input
          ref={nativeRef}
          type="date"
          className="pm-date-field__native"
          tabIndex={-1}
          aria-hidden="true"
          value={value}
          min={min}
          onChange={onChange}
        />
      </div>
    </>
  );
}
