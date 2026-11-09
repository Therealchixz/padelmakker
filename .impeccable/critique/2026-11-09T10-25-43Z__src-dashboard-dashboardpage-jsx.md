---
target: indloggede app
total_score: 27
max_score: 40
na_heuristics: 
p0_count: 1
p1_count: 3
target_identity: "file:/home/user/padelmakker/src/dashboard/DashboardPage.jsx"
target_fingerprint: "sha256:90fd7e33c2e89a2e8ccd0606be6df8b8a8aa395d1c237af5cd008dcbac97e544"
target_path: /home/user/padelmakker/src/dashboard/DashboardPage.jsx
timestamp: 2026-11-09T10-25-43Z
slug: src-dashboard-dashboardpage-jsx
---
Method: dual-agent (A: design review · B: detector + in-page overlay + audit). Mock harness with fake data (no real login; all Supabase calls answered locally). Target: logged-in app (src/dashboard/*, NotifikationerPage). Mode: Operate. iPhone 13 light/dark + 1440x900.

## Heuristics 27/40 (Acceptable, up from 24)
1:3 badges/status good; visiting Kampe silently marks notifications read | 2:2 two level scales (ELO-derived "niveau" vs stored level), "Win rate"/"Badges" | 3:2 back from conversation/player modal/SPIL sheet loses place | 4:3 shared header fixed; two notification UIs, navy match detail | 5:3 | 6:3 Baner/Rangliste/Beskeder under Mere | 7:3 no "i aften" | 8:2 Hjem ~6 screens, Kampe 5 control rows | 9:3 | 10:3
Audit 12/20: A11y 2, Perf 3, Theming 2, Responsive 3, Integrity 2.

## Specificity
Now authored (paper/ink/clay, Instrument Sans, Anton names/numbers, B-racket avatar, SPIL sheet). Leftovers: match-detail navy hero + blue court + 🎾 fallback (kampdetalje.css:28-77, PadelCourtTopView), chat iOS greys, emoji icons in Profil/Makkere/Notifikationer, mono used for words. Detector: 0 anti-pattern rules; 303 advisories (288 font-size drift, 55 < 11px; navy rgba ConfirmResultModal:86, BanerVenueMap:42). Overlay: undersized-ui-text (profil 31, hjem date tags 10px), skipped-heading makkere h1→h3; cream/overused-font false positives.

## Priority issues
1. [P0] Dark-mode chat unreadable: incoming bubbles 1.05:1, timestamps 2.3:1 (responsive.css ~1733, 10492, 10511, 10683 hard-coded #F2F2F7/#E9E9EB). Fix tokens. SMALL. (harden/colorize)
2. [P1] Two level scales: Hjem "Åbne kampe på dit niveau" filters/labels by eloToLevel(ELO) (base ELO 1000 = niveau 4.0) while profile/notifications/filter use stored level → 2.5 player sees 4-7 matches, misses 2.0-3.0 matches (HomeTab.jsx:1106-1117, LigaSelectedDetail.jsx:151). SMALL. (clarify)
3. [P1] Back navigation: conversation doesn't push history (back → previous tab), player modal + SPIL sheet don't consume back (BeskedTab, PlayerProfileModal, DashboardPage SPIL). SMALL. (harden)
4. [P1] Keyboard/screen reader: MobileChatOverlay + KampeFilterSheet no focus move/trap/Escape; FilterToggle switches unnamed; CreateMatchForm Starttid/Varighed selects unlabelled; search fields placeholder-only; targets < 24px (chat "+" 12x21, emoji 30x18, "Skift side" 29x17, "Se alle" 38x19). SMALL. (harden/adapt)
5. [P2] Off-brand leftovers: match-detail navy hero/court/amber chips/🎾, emoji icons, chat greys. Colour decision → owner. (colorize/polish)
6. [P2] Hjem/Kampe overloaded: "kommer snart" teaser, map list repeats Baner, 9 identical black "Detaljer/Tilmeld", Kampe ~12 controls before first card. (distill)
7. [P2] Text < 12px (9-11px badges, labels, nav 11px) and 32-40px targets (Rangliste period 32, back buttons 32-36). (typeset/adapt)
8. [P2] Hjem first load: Leaflet+venues ~250 KB eager, 55 API calls (profiles x10). (optimize)

## Previous critique (4 Nov)
Shared top bar FIXED; brand at login LARGELY FIXED; Hjem overload IMPROVED; small text/targets PARTLY; nav/h1/badges MOSTLY FIXED (Kampe dot silent, SPIL no aria-haspopup).

## Personas
First-timer: teaser first, ELO vs niveau unexplained, two notification screens. Casual 45: level mismatch, English labels, back loses chats, 11px nav. Low-vision: dark chat, 9-10px labels, small targets. Power user: 12 controls before first match, no "i aften", Detaljer extra tap.

## Minor
Venue list order 12 km before 6 km; crowded Kampe pills at 390px; card-in-card Rangliste/Beskeder; clay on non-tappables; Notifikationer page older style vs bell sheet; SPIL "Liga" row not creatable; "Juster/Justér"; nav "Makkere" vs h1 "Find makker"; harsh "100% nederlag" line on own profile; no <main>, h2-only subpages; lint at 4/4 warnings.
