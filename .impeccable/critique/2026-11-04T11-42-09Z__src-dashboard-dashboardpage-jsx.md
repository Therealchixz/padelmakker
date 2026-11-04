---
target: logged-in app (dashboard)
total_score: 24
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 3
target_identity: "file:/home/user/padelmakker/src/dashboard/DashboardPage.jsx"
target_fingerprint: "sha256:5929025e4a5c28eaa58e171ab6919cb5f49faf7b555df3a693d7f3813bc0892e"
target_path: /home/user/padelmakker/src/dashboard/DashboardPage.jsx
timestamp: 2026-11-04T11-42-09Z
slug: src-dashboard-dashboardpage-jsx
---
Method: dual-agent (A: design review · B: detector + in-page overlay). Mock harness with fake data; no real login, all Supabase calls answered locally.
Target: logged-in app (src/dashboard/*, NotifikationerPage). Mode: Operate.

## Heuristics 24/40 (Acceptable)
1:3 status good; bell only on Hjem (mobile) | 2:2 "Win rate", "Badges", "compose-knappen", unlabeled chips | 3:3 | 4:1 every tab has its own top bar; name drift Kamp/Kampe/Åbne Kampe, Book Bane/Baner; dark mode two primary blues | 5:3 | 6:2 Baner/Rangliste/Profil hidden under Mere; Liga is a chip in Kampe | 7:3 no "i aften" shortcut | 8:2 Hjem: e-mail card + "Månedens mester kommer snart" + CTA + 4 tiles + ELO disclaimer before content; Kampe 5 control rows | 9:2 | 10:3

## Specificity
Content/flows are padel-specific (Jeg vil spille sheet, 2v2 vs card, podium); visual layer is template: Inter 100% (detector overused-font on every route), --pm-font-display still Inter (variables.css:122), .pm-brand only on public pages, orange almost absent, dark mode stock Tailwind #2563EB/#60A5FA (variables.css:143-147), default avatar 🎾 tennis emoji (AuthContext.jsx:467/532).

## Detector (B)
CLI: 2× side-tab (AdminTab.jsx:1420, LigaTab.jsx:1241; also RankingTab.jsx:947 unflagged). Overlay (10 runs, injection OK): undersized/tiny text everywhere — bottom-nav labels 10px (.pm-mobile-bottom-label), profil achievements 9px, "Aktuel 2v2-ELO" 9.5px, Kampe "NOV" 9.5px, podium labels 10.5px (RankingTab:660/666); flat-type-hierarchy on Hjem (14/15/15.5px, ratio 1.07); low-contrast: podium #1 badge navy on amber 2.9:1 (RankingTab:668-672), .pm-kampe-v2-badge--warm 4.0:1, --open 4.4:1; nested-cards ×5 profil. False positives: all text-occlusion (overlay labels). Real sub-44 targets: Rangliste period tabs 32px (RankingTab:757), "Læs hvordan ELO virker" 16px tall, "Tilmeld mig" 42px. Placeholder-only labels: Makkere + Kampe search. No JS errors, 0 unnamed controls.

## Priority
- [P1] No shared top bar (confirmed): Hjem greeting+bell, hand-rolled h2 19px in Makkere:648/Baner:441/Ranking:685/Profil:786, Kampe title+floating +, Beskeder title in card, Notifikationer own sticky bar; gutters 12/24/30px; DashboardPage:1336 hides shared header on mobile. -> one ScreenHeader (h1, bell always, 16px gutter) -> layout/polish
- [P1] Brand stops at the login door: Bricolage for titles/big numbers, orange with one meaning (open seat / søger), navy-derived dark mode, initials instead of 🎾 -> typeset/colorize
- [P1] Hjem overloaded (4/8 cognitive-load fails): hide "kommer snart" teaser, ELO disclaimer contextual (HomeTab:1195-1225 -18px hack), lead with Kommende/åbne kampe i aften, drop Rangliste tile -> distill
- [P2] Small text/contrast/tap targets: raise 9-10.5px labels to ≥12px, fix podium/badge contrast, period tabs ≥44px, ELO link -> typeset/adapt
- [P2] Nav differs mobile/desktop; no h1 anywhere; bottom-nav aria-label hides unread badge (DashboardPage:1983); Mere lacks aria-expanded/dialog -> layout/harden

## Personas
Jordan: nag + teaser + disclaimer first, all-zero profile, unexplained ELO/Americano/Begge. Casey: + and bell at top 32-36px, 32px segments, pale 10px text in sunlight. Sam: no h1, badge not announced, Mere no aria-expanded. Club player 45: can't add own friends when creating match; no "i aften"; 10-11px uppercase labels.

## Minor
Feed: date header above every card; "En spiller vandt" mock artifact but real copy would be third person ("Karl Jensen vandt") -> "Du vandt mod …"; Rangliste 3 stacked filters + caption repeat; desktop content column 870px vs full-width header; Beskeder empty icon off-centre + "compose-knappen"; Liga "💬 Kontakt admin"; title case "Find Makker/Book Bane". Possibly mock artifacts: ranking order, profil stats contradictions.

## Questions
One entry point "Find spillere til i aften" for join + need-a-4th? One colour meaning "this game needs you" (orange)? Real faces/initials on Hjem instead of 4 nav tiles?
