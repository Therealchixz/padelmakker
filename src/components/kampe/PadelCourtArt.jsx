/* Stiliseret 3D-padelbane til detalje-hero'en — erstatter den gamle 2-streges CSS-bane.
   Ren SVG: skalerer skarpt, ingen billede-download, theme-uafhængig (hero er altid navy). */

// Bane-gulvets hjørner (perspektiv: bredere fortil, smallere bagtil)
const FL = [56, 164], FR = [344, 164], BR = [274, 100], BL = [126, 100];
// Glasvæggenes top-hjørner (væggene rejser sig fra gulvkanten)
const FLt = [56, 132], FRt = [344, 132], BRt = [274, 54], BLt = [126, 54];
// Hegn (mesh) — øverste bånd af væggene
const FLf = [56, 146], FRf = [344, 146], BRf = [274, 68], BLf = [126, 68];

const pts = (...ps) => ps.map((p) => p.join(',')).join(' ');
// Punkt på linjen A→B ved parameter t
const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

// Nettet ligger midt på banen (t = 0.5 langs sidelinjerne)
const netL = lerp(FL, BL, 0.5), netR = lerp(FR, BR, 0.5);
// Servelinjer: ca. mellem net og bagkant/forkant
const svcBackL = lerp(FL, BL, 0.78), svcBackR = lerp(FR, BR, 0.78);
const svcFrontL = lerp(FL, BL, 0.22), svcFrontR = lerp(FR, BR, 0.22);
// Midterlinje (center service line) fra forkant til bagkant
const midFront = lerp(FL, FR, 0.5), midBack = lerp(BL, BR, 0.5);

export function PadelCourtArt({ className }) {
  return (
    <svg
      className={className}
      viewBox="0 0 400 180"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id="pmCourtBg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#204E8B" />
          <stop offset="0.55" stopColor="#163B70" />
          <stop offset="1" stopColor="#0D2850" />
        </linearGradient>
        <radialGradient id="pmCourtGlow" cx="50%" cy="40%" r="62%">
          <stop offset="0" stopColor="#3B78C0" stopOpacity="0.55" />
          <stop offset="1" stopColor="#3B78C0" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="pmCourtFloor" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2C64AC" />
          <stop offset="1" stopColor="#3F88D8" />
        </linearGradient>
        <linearGradient id="pmGlass" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#8FC1F0" stopOpacity="0.30" />
          <stop offset="1" stopColor="#4C84C8" stopOpacity="0.10" />
        </linearGradient>
        <pattern id="pmMesh" width="8" height="8" patternUnits="userSpaceOnUse">
          <path d="M8 0H0V8" fill="none" stroke="#BBD6F2" strokeOpacity="0.32" strokeWidth="0.7" />
        </pattern>
      </defs>

      <rect width="400" height="180" fill="url(#pmCourtBg)" />
      <rect width="400" height="180" fill="url(#pmCourtGlow)" />

      {/* Glasvægge (bagvæg + to sidevægge) */}
      <g stroke="rgba(255,255,255,0.34)" strokeWidth="1.1" strokeLinejoin="round">
        <polygon points={pts(BL, BR, BRt, BLt)} fill="url(#pmGlass)" />
        <polygon points={pts(FL, BL, BLt, FLt)} fill="url(#pmGlass)" />
        <polygon points={pts(FR, BR, BRt, FRt)} fill="url(#pmGlass)" />
        {/* Hegn (mesh) i toppen af væggene */}
        <polygon points={pts(BLt, BRt, BRf, BLf)} fill="url(#pmMesh)" stroke="none" />
        <polygon points={pts(FLt, BLt, BLf, FLf)} fill="url(#pmMesh)" stroke="none" />
        <polygon points={pts(FRt, BRt, BRf, FRf)} fill="url(#pmMesh)" stroke="none" />
      </g>

      {/* Hjørnestolper */}
      <g stroke="rgba(255,255,255,0.5)" strokeWidth="1.6" strokeLinecap="round">
        <line x1={FL[0]} y1={FL[1]} x2={FLt[0]} y2={FLt[1]} />
        <line x1={FR[0]} y1={FR[1]} x2={FRt[0]} y2={FRt[1]} />
        <line x1={BL[0]} y1={BL[1]} x2={BLt[0]} y2={BLt[1]} />
        <line x1={BR[0]} y1={BR[1]} x2={BRt[0]} y2={BRt[1]} />
      </g>

      {/* Bane-gulv */}
      <polygon points={pts(FL, FR, BR, BL)} fill="url(#pmCourtFloor)" />

      {/* Linjer */}
      <g stroke="rgba(255,255,255,0.92)" strokeWidth="1.6" strokeLinecap="round">
        <polygon points={pts(FL, FR, BR, BL)} fill="none" />
        <line x1={svcFrontL[0]} y1={svcFrontL[1]} x2={svcFrontR[0]} y2={svcFrontR[1]} />
        <line x1={svcBackL[0]} y1={svcBackL[1]} x2={svcBackR[0]} y2={svcBackR[1]} />
        {/* Midterlinje kun mellem servelinjerne (som en rigtig padelbane) */}
        <line x1={lerp(midFront, midBack, 0.22)[0]} y1={lerp(midFront, midBack, 0.22)[1]} x2={lerp(midFront, midBack, 0.78)[0]} y2={lerp(midFront, midBack, 0.78)[1]} />
      </g>

      {/* Net */}
      <g>
        <line x1={netL[0]} y1={netL[1]} x2={netR[0]} y2={netR[1]} stroke="rgba(255,255,255,0.95)" strokeWidth="2.4" strokeLinecap="round" />
        <rect x={netL[0]} y={netL[1] - 7} width={netR[0] - netL[0]} height="7" fill="url(#pmMesh)" opacity="0.9" />
        <line x1={netL[0]} y1={netL[1]} x2={netL[0]} y2={netL[1] - 9} stroke="rgba(255,255,255,0.7)" strokeWidth="1.6" />
        <line x1={netR[0]} y1={netR[1]} x2={netR[0]} y2={netR[1] - 9} stroke="rgba(255,255,255,0.7)" strokeWidth="1.6" />
      </g>
    </svg>
  );
}
