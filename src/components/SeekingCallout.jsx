/**
 * Ens advarsels-/søger-blok (kamp/makker) — bruger pm-state-card--warning tokens.
 */

export function SeekingCallout({ title, meta, children, className = '' }) {
  return (
    <div className={`pm-seeking-callout pm-state-card pm-state-card--warning ${className}`.trim()}>
      {title ? <div className="pm-seeking-callout__title">{title}</div> : null}
      {meta ? <div className="pm-seeking-callout__meta">{meta}</div> : null}
      {children ? <div className="pm-seeking-callout__body">{children}</div> : null}
    </div>
  );
}

/** Enkel detaljelinje med valgfrit label (fx "Niveau: 2,3–2,7") */
export function SeekingCalloutDetail({ label, value }) {
  if (label) {
    return (
      <div className="pm-seeking-callout__detail">
        <span className="pm-seeking-callout__detail-label">{label}: </span>
        <span className="pm-seeking-callout__detail-value">{value}</span>
      </div>
    );
  }
  return <div className="pm-seeking-callout__detail pm-seeking-callout__detail-value">{value}</div>;
}
