import { useId } from 'react';

/**
 * Tegnet padel-ketsjer (skrå, fyldt hoved med huller, hals og greb) — standardbillede
 * for spillere uden eget profilbillede. Ejeren 4. nov. 2026: valgte forslag "B: skrå
 * ketsjer, fyldt" i stedet for tennis-emojien 🎾.
 *
 * Ketsjeren er tegnet lodret i et 16×30-felt og drejet 45° ind i 24×24. Hullerne er
 * skåret ud med en maske, så baggrunden skinner igennem på enhver farve.
 */
const HEAD = 'M8 1C12.7 1 15 4.3 15 8.5 15 12.8 12.2 16.2 8 16.2S1 12.8 1 8.5C1 4.3 3.3 1 8 1Z';
const HOLES = [
  [5.6, 4.6], [8, 4], [10.4, 4.6],
  [4, 7.2], [6.6, 7], [9.4, 7], [12, 7.2],
  [4.4, 10], [6.9, 10], [9.1, 10], [11.6, 10],
  [6.2, 12.7], [8, 13.2], [9.8, 12.7],
];

export function PadelRacketIcon({ size = 24, title = '', style = {} }) {
  const maskId = `pm-racket-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title || undefined}
      style={{ display: 'block', overflow: 'visible', ...style }}
    >
      <g transform="translate(12 12) rotate(45) scale(0.8) translate(-8 -15)">
        <defs>
          <mask id={maskId} maskUnits="userSpaceOnUse" x="-4" y="-4" width="24" height="38">
            <rect x="-4" y="-4" width="24" height="38" fill="#fff" />
            {HOLES.map(([cx, cy]) => <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="0.95" fill="#000" />)}
            <path d="M7 16.9h2l-1 2.1Z" fill="#000" />
            <path d="M6.1 23.5h3.8M6.1 26.1h3.8" stroke="#000" strokeWidth="0.9" />
          </mask>
        </defs>
        <g mask={`url(#${maskId})`} fill="currentColor">
          <path d={HEAD} />
          <path d="M4.9 15.2h6.2l-1.5 5.2H6.4Z" />
          <rect x="6.05" y="20" width="3.9" height="9.2" rx="1.6" />
        </g>
      </g>
    </svg>
  );
}

/** Tom avatar eller den gamle standard-emoji (🎾) → vis padel-ikonet. */
export function isDefaultAvatar(avatar) {
  const a = String(avatar ?? '').trim();
  return a === '' || a === '🎾';
}
