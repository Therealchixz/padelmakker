/**
 * Ens sektionsoverskrift (fx «Seneste aktivitet» på Hjem).
 */

export function PageSectionTitle({ children, className = '' }) {
  return (
    <div className={`pm-page-section-title ${className}`.trim()}>
      {children}
    </div>
  );
}
