/**
 * Tegnet padel-ketsjer (massivt hoved med huller + kort håndtag) — standardbillede
 * for spillere uden eget profilbillede. Ejeren 4. nov. 2026: "Et padel-ikon" i stedet
 * for tennis-emojien 🎾. Samme stregtykkelse som lucide-ikonerne i resten af appen.
 */
export function PadelRacketIcon({ size = 24, strokeWidth = 2, title, style }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title || undefined}
      style={{ display: 'block', ...style }}
    >
      <path d="M12 2.5c3.6 0 6.2 2.7 6.2 6.3 0 3.4-2.4 6.2-5 6.7h-2.4c-2.6-.5-5-3.3-5-6.7 0-3.6 2.6-6.3 6.2-6.3Z" />
      <path d="M10.8 15.5 10.6 18.5M13.2 15.5l.2 3" />
      <rect x="10.2" y="18.5" width="3.6" height="3.4" rx="1.2" />
      <g fill="currentColor" stroke="none">
        <circle cx="9.6" cy="7" r="0.85" />
        <circle cx="12" cy="6" r="0.85" />
        <circle cx="14.4" cy="7" r="0.85" />
        <circle cx="10.6" cy="9.6" r="0.85" />
        <circle cx="13.4" cy="9.6" r="0.85" />
        <circle cx="12" cy="12" r="0.85" />
      </g>
    </svg>
  );
}

/** Tom avatar eller den gamle standard-emoji (🎾) → vis padel-ikonet. */
export function isDefaultAvatar(avatar) {
  const a = String(avatar ?? '').trim();
  return a === '' || a === '🎾';
}
