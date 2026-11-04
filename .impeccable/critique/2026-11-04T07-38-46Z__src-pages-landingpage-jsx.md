---
target: offentlige sider (genvurdering)
total_score: 24
max_score: 36
na_heuristics: 7
p0_count: 0
p1_count: 1
target_identity: "file:/home/user/padelmakker/src/pages/LandingPage.jsx"
target_fingerprint: "sha256:7c5ccaa3a2ce50dc9fb5d13e0e4f61c6adda3a8611028ddc7865cfe4a152a0d5"
target_path: /home/user/padelmakker/src/pages/LandingPage.jsx
timestamp: 2026-11-04T07-38-46Z
slug: src-pages-landingpage-jsx
---
# Re-critique: public pages (after #458-#461)
Method: dual-agent (A: design review · B: detector). Overlay skipped (cloud).
Heuristics 24/36 (67%, Acceptable; was 23/36). n/a: 7.
1:3 no current-page state | 2:3 ELO jargon, Americano never explained | 3:3 menu no Esc, Events back ignores session | 4:2 three page headers, campaign border bug | 5:3 | 6:3 desktop nav lacks Om/FAQ/ELO | 8:3 filler stat tiles, duplicated mobile CTAs | 9:2 Events error no retry | 10:2 FAQ flat wall, no link from landing ELO to /elo
Detector: desktop 71 -> 14, mobile 66 -> 12. Remaining: overused-font (body Inter, intentional) x6, nested-cards in phone mockup (FP) x4, dark-glow (FP), straggler x2, oversized-h1 (borderline).
## Priority
- [P1] Stat strip "118 spillere" undercuts "i nærheden"; "4"/"Gratis" are filler -> clarify/distill
- [P2] Campaign border `theme.accent + '44'` invalid CSS -> hard dark frame (same bug pattern 35x in src) -> polish
- [P2] Om/FAQ/ELO built as legal docs: FAQ 13 flat, /elo formula-first, no link from landing ELO -> layout/clarify
- [P2] Three different headers; mobile nav ~120px; duplicate Log ind/Opret in menu -> adapt
- [P3] Mockup palette green/amber off-brand; step-2 number box taller -> colorize/polish
