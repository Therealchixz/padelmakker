export function BrandLogo({ className = '', size = 'nav', showTagline = true }) {
  const classes = ['pm-brand-logo', `pm-brand-logo--${size}`, className]
    .filter(Boolean)
    .join(' ');

  return (
    <span className={classes} aria-label="PadelMakker">
      <img className="pm-brand-logo-mark" src="/logo-mark.png" alt="" aria-hidden="true" />
      <span className="pm-brand-logo-wordmark" aria-hidden="true">
        <strong>
          <span>PADEL</span>
          <span>MAKKER</span>
        </strong>
        {showTagline && <small>FIND DIN PERFEKTE MAKKER</small>}
      </span>
    </span>
  );
}
