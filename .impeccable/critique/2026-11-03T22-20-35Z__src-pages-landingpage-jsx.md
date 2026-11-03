---
target: offentlige sider (forside, om, faq, events, elo, privatlivspolitik)
total_score: 23
max_score: 36
na_heuristics: 7
p0_count: 0
p1_count: 3
target_identity: "file:/home/user/padelmakker/src/pages/LandingPage.jsx"
target_fingerprint: "sha256:04f5a3fc33e48441bb0169758651df624f2cc22924ac6c6e897688b618e5b986"
target_path: /home/user/padelmakker/src/pages/LandingPage.jsx
timestamp: 2026-11-03T22-20-35Z
slug: src-pages-landingpage-jsx
---
# Critique: public pages (/, /om, /faq, /events, /elo, /privatlivspolitik)
Method: dual-agent (A: design review · B: detector). Overlay skipped (cloud, no visible browser).

## Heuristics: 23/36 (64%, Acceptable). n/a: 7, 10-partially scored 2 (help) — 7 n/a, 10 scored.
1:2 stats show "—" | 2:3 jargon (K-værdi, Swiss) | 3:3 | 4:2 four nav/footer sets, 4 CTA labels | 5:3 events CTA with 0 events | 6:3 | 7:n/a | 8:2 landing 10,302px mobile, repeats story | 9:3 dev string PublicEventsPage.jsx:282 | 10:2 FAQ/ELO not in desktop nav

## Specificity: content specific (~8/10), visual form generic (~3/10)
Detector (live URLs): 71 desktop / 66 mobile. icon-tile-stack x12, kicker-above-heading x7, nested-cards x5, line-length x17 (LegalPageLayout 720px/15px), overused-font x6 (intentional Inter, FP as defect), pulsing-dot, radial glow, ai-color-palette, tiny-text 11px, low-contrast (Live 4.1:1; mobile hero accent 2.9:1), em-dash x15. FPs: mockup nested cards, one-shot ELO glow.

## Priority issues
- [P1] Stats "—" advertise inactivity (landingStatsDisplay.js, LandingPage.jsx:62-67,478-487) → clarify
- [P1] Landing repeats story 4-5x; cut features grid, move roadmap to /om, ≤6 sections → distill
- [P1] Events empty dead end with sign-up CTA (PublicEventsPage.jsx:261-270,308-313) → onboard
- [P2] Generic visual identity: Inter display, icon tiles, kickers, blurred hero, hero accent contrast → bolder, typeset
- [P2] Secondary pages: no logo/CTA in LegalPageLayout, lost list bullets, FAQ intro spacing, dark-mode white fade (responsive.css:160-166) + cookie bar (CookieNoticeBar.jsx:61), step numbers invalid color theme.accent+"12" (LandingPage.jsx:568) → polish

## Personas
Jordan: jargon, unexplained phone verification, "Idéfase", "action-pakken" on /elo. Casey: 120px sticky header, 17-28px footer tap targets, mockup below campaign. Riley: ambiguous "—", LIVE on scripted mockup, OS dark ignored, missing period in campaign copy.

## Minor
Subtitle repeats H1; 8 cards in 3 cols orphan; "Senest opdateret" on non-legal pages; privacy page no TOC; mobile menu 8 options.
