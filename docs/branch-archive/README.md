# Branch-arkiv — 20. september 2026

Repoet havde **162 branches** ud over `main`. Alle deres PR'er var lukkede;
ingen var åbne. De er ryddet væk her, uden at noget indhold gik tabt.

## Hvorfor det ikke kunne afgøres med git

Branchene deler **ingen fælles forfader** med `main`:

```
git merge-base origin/main origin/claude/actions-reorganize   →  tomt
```

Historikken er blevet lagt om undervejs, så `main` er en ny rod. Derfor kan
`git branch --merged` ikke svare på, om en branch' arbejde er landet — den
sædvanlige metode giver et forkert svar, ikke bare et usikkert et.

## Hvad der så blev brugt

GitHub gemmer hver PR's commits permanent under `refs/pull/<nr>/head`, også
efter at branchen er slettet. Det gav et præcist kriterium:

```
git ls-remote origin 'refs/pull/*/head'      # 371 PR-referencer
git rev-list <branch> --not <alle PR-refs>   # commits der KUN findes på branchen
```

| | Antal | Bevaret af |
|---|---|---|
| Branches hvis tip **er** en PR-head | 141 | GitHub, permanent — PR'ens "Files changed" og "Restore branch" |
| Branches uden PR, men helt indeholdt i andre PR'er | 5 | de PR'er |
| Branches med commits der kun fandtes dér | 16 | `patches/` i denne mappe |
| **I alt** | **162** | |

De 16 havde tilsammen **37 unikke commits**. 35 ligger her som patch-filer;
to var merge-commits, hvis diff er identisk med den commit lige før, og én var
en dublet af `00000000000000_baseline_schema.sql`, som allerede er i repoet.

`package-lock.json` og `package.json` er udeladt af patcherne — de er støj og
findes i forvejen i `main`.

## Sådan henter du en patch frem igen

```bash
git checkout -b genskab main
git am docs/branch-archive/patches/<branch>/*.patch
```

De er 5 måneder gamle og vil ofte give konflikter. Brug dem som opslag, ikke
som noget der bare kan køres.

## Hvad der blev tjekket efter — og fundet

Tre af branchene indeholdt noget der så ud til at mangle. Alle tre er
verificeret mod `00000000000000_baseline_schema.sql`, som er et dump af den
kørende produktionsdatabase:

**`claude/review-project-architecture-VBOdQ`** — fem sikkerhedsrettelser fra
april i `supabase/sql/critical_fixes_2026_04_15.sql`, en fil der ikke findes i
`main`. Alle otte funktioner (`admin_adjust_elo`, `protect_elo_fields`,
`join_match`, `leave_match`, `kick_player_from_match`, `apply_elo_for_match`,
`enforce_max_players`, `recalc_profile_stats_from_elo_history`) og triggeren
`trg_enforce_max_players` kører i produktionen. To af de fire politikker findes
under deres oprindelige navne; de to andre er siden omdøbt
(`match_results_update_by_participant_or_admin` →
`match_results_update_by_participant`) og har stadig `is_admin()` i både
`USING` og `WITH CHECK`. Intet mangler.

**`merge/charming-tesla-into-main`** — 14 commits fra juli med redesign,
wizards og en række rettelser. Indholdet er i `main` (62–100 % af de tilføjede
linjer genfindes ordret; resten er siden skrevet om).

**Tre migrationsfiler** fra juli — `20260705120000_confirm_match_result_and_apply_elo`,
`20260705130000_notify_match_creator_on_join` og
`20260713183000_join_request_team_race_fix` — nåede aldrig ind i
`supabase/migrations/`. Men `confirm_match_result_and_apply_elo`,
`notify_match_creator_on_join`, `approve_match_join_request`,
`set_match_player_team` og indekset `idx_notifications_user_type_created` findes
**alle** i produktionen. SQL'en blev altså kørt direkte mod databasen og aldrig
gemt som fil. Det er præcis den drift, sammenlægningen til baseline lukkede.

## Forbehold

For de ældste UI-commits (april, mørk tilstand i `KampeTab`/`LigaTab`) genfindes
0–25 % af linjerne ordret i `main`. Det er **ikke** bevis for at arbejdet er
tabt — brugerfladen er redesignet siden, så linjerne ville alligevel ikke matche.
Det er bevis for at jeg ikke maskinelt kan afgøre det. Derfor ligger de her.

## Inventarliste

| Branch | Sidste commit | Tip | PR | Hvor indholdet findes |
|---|---|---|---|---|
| `claude/2v2-live-winner-states` | 2026-05-16 | `91f642a2` | #197 | PR #197 |
| `claude/actions-reorganize` | 2026-05-16 | `6e07dc33` | #203 | PR #203 |
| `claude/add-open-match-feature-FFtQC` | 2026-04-18 | `a83c78a0` | #158 | PR #158 |
| `claude/admin-actions-inside-accordion` | 2026-05-16 | `82445adf` | #204 | PR #204 |
| `claude/americano-completed-blue-header` | 2026-05-17 | `265c0b68` | #229 | PR #229 |
| `claude/americano-open-card-design` | 2026-05-15 | `45078c29` | #192 | PR #192 |
| `claude/americano-open-card-polish` | 2026-05-15 | `de4daa68` | #193 | PR #193 |
| `claude/americano-podium-fix` | 2026-05-17 | `ddcc2084` | #228 | PR #228 |
| `claude/charming-tesla-u5o85u` | 2026-07-04 | `b9fa2637` | #353 | PR #353 |
| `claude/code-review-and-fixes-EmTt4` | 2026-05-14 | `d4b83d1d` | #177 | PR #177 |
| `claude/code-review-main-hUiA9` | 2026-05-04 | `7a7ecbc9` | #175 | PR #175 |
| `claude/code-review-optimization-3M1Nj` | 2026-04-20 | `d73e69d2` | #166 | PR #166 |
| `claude/court-empty-slots-contrast` | 2026-05-16 | `ddd4c1e2` | #198 | PR #198 |
| `claude/court-gns-abbrev` | 2026-05-15 | `928c6b50` | #191 | PR #191 |
| `claude/court-mobile-compact` | 2026-05-15 | `c88b4f96` | #188 | PR #188 |
| `claude/court-team-header-above` | 2026-05-15 | `6d2179c2` | #190 | PR #190 |
| `claude/court-team-info-badge` | 2026-05-15 | `273079e1` | #189 | PR #189 |
| `claude/dazzling-gates-AmCDe` | 2026-06-07 | `f774ad34` | #341 | PR #341 |
| `claude/elo-balance-bar` | 2026-05-16 | `42258259` | #200 | PR #200 |
| `claude/elo-bar-contrast` | 2026-05-16 | `1cc8ed24` | #201 | PR #201 |
| `claude/elo-test-suite` | 2026-05-14 | `af2e323a` | #180, #182 | PR #180, #182 |
| `claude/empty-slot-match-skift` | 2026-05-16 | `d68b211b` | #199 | PR #199 |
| `claude/force-start-fully-in-accordion` | 2026-05-16 | `9a485db3` | #205 | PR #205 |
| `claude/jolly-keller-6qiwnx` | 2026-09-20 | `8b5ec827` | #371 | PR #371 |
| `claude/liga-open-card-design` | 2026-05-15 | `228a2cb8` | #194 | PR #194 |
| `claude/match-chat-total-count` | 2026-05-16 | `a888cd21` | #206 | PR #206 |
| `claude/match-quality-nowrap` | 2026-05-15 | `a18c0667` | #184 | PR #184 |
| `claude/matchmaking-history-favorites` | 2026-05-16 | `befb8529` | #207 | PR #207 |
| `claude/padel-court-visualisering` | 2026-05-15 | `c2ec0575` | #187 | PR #187 |
| `claude/preferred-partner-level` | 2026-05-16 | `d9562b4d` | #208 | PR #208 |
| `claude/project-code-review-4T7pr` | 2026-04-14 | `97099576` | #141 | PR #141 |
| `claude/remove-top-team-labels` | 2026-05-16 | `ba5dadfb` | #202 | PR #202 |
| `claude/restore-emojis` | 2026-05-15 | `c1cb24f3` | #196 | PR #196 |
| `claude/review-database-sql-uVlrb` | 2026-04-14 | `3aabcef2` | #128 | PR #128 |
| `claude/review-padelmakker-strategy-iECtB` | 2026-04-16 | `8b7b15f5` | #153 | PR #153 |
| `claude/review-padelmakker-website-t5Eu2` | 2026-04-28 | `a3db205b` | #168 | PR #168 |
| `claude/security-edge-fn-error` | 2026-05-14 | `bf31be0e` | #179 | PR #179 |
| `claude/segmented-pill-tabs` | 2026-05-15 | `2fe79b17` | #181 | PR #181 |
| `claude/segmented-variant-a` | 2026-05-15 | `9c84c1e7` | #183 | PR #183 |
| `claude/sql-legacy-guards` | 2026-05-14 | `4138ce43` | #178 | PR #178 |
| `claude/sticky-submit-mobile` | 2026-05-15 | `31ec4a18` | #186 | PR #186 |
| `claude/ui-polish-round-1` | 2026-05-15 | `63219c1f` | #185 | PR #185 |
| `claude/unified-blue-headers` | 2026-05-15 | `91a53662` | #195 | PR #195 |
| `codex/add-dropdown-menu-for-user-level` | 2026-04-15 | `54ea5208` | #144 | PR #144 |
| `codex/add-dropdown-menu-for-user-level-1335r5` | 2026-04-15 | `6425b9da` | #147 | PR #147 |
| `codex/add-dropdown-menu-for-user-level-g9glap` | 2026-04-15 | `878823c6` | #146 | PR #146 |
| `codex/add-dropdown-menu-for-user-level-phqdy9` | 2026-04-15 | `8b876f5f` | #145 | PR #145 |
| `codex/add-dropdown-menu-for-user-level-uqdde4` | 2026-04-15 | `967fc5a9` | #149 | PR #149 |
| `codex/add-dropdown-menu-for-user-level-uw5fe3` | 2026-04-15 | `970b8738` | #148 | PR #148 |
| `codex/fix-live-notification-issue-on-app-icon` | 2026-04-15 | `1c97df67` | #142 | PR #142 |
| `codex/fix-live-notification-issue-on-app-icon-s9s6ek` | 2026-04-15 | `1b55131c` | #143 | PR #143 |
| `codex/fix-push-notification-issue` | 2026-04-15 | `70be7dd6` | #150 | PR #150 |
| `codex/fix-push-notification-issue-q7xt6p` | 2026-04-15 | `30d3bbe2` | #151 | PR #151 |
| `codex/review-all-my-code-thoroughly` | 2026-04-19 | `b006b0e7` | #160 | PR #160 |
| `codex/review-all-my-code-thoroughly-4b3mdo` | 2026-04-19 | `ec5eff85` | #165 | PR #165 |
| `codex/review-all-my-code-thoroughly-5trer6` | 2026-04-19 | `a461eff1` | #162 | PR #162 |
| `codex/review-all-my-code-thoroughly-83q839` | 2026-04-19 | `433f5b4f` | #163 | PR #163 |
| `codex/review-all-my-code-thoroughly-8eyqs8` | 2026-04-19 | `674498bd` | #161 | PR #161 |
| `codex/review-all-my-code-thoroughly-90qd22` | 2026-04-19 | `bae7bc31` | #164 | PR #164 |
| `codex/review-padelmakker-codebase-and-architecture` | 2026-04-14 | `6083ae5f` | #129 | PR #129 |
| `codex/review-padelmakker-codebase-and-architecture-21zrh8` | 2026-04-14 | `6132c54b` | #138 | PR #138 |
| `codex/review-padelmakker-codebase-and-architecture-5j0ogj` | 2026-04-14 | `46e0d2e9` | #132 | PR #132 |
| `codex/review-padelmakker-codebase-and-architecture-7983ak` | 2026-04-14 | `c5e591ca` | #131 | PR #131 |
| `codex/review-padelmakker-codebase-and-architecture-durffr` | 2026-04-14 | `38eaa893` | #139 | PR #139 |
| `codex/review-padelmakker-codebase-and-architecture-l7tn6e` | 2026-04-14 | `46a2fb27` | #133 | PR #133 |
| `codex/review-padelmakker-codebase-and-architecture-mbv52o` | 2026-04-14 | `367e459b` | #134 | PR #134 |
| `codex/review-padelmakker-codebase-and-architecture-pzsgfj` | 2026-04-14 | `18364c5c` | #137 | PR #137 |
| `codex/review-padelmakker-codebase-and-architecture-xh15qt` | 2026-04-14 | `43df4a3c` | #130 | PR #130 |
| `cursor/admin-edit-americano-liga-ded9` | 2026-05-17 | `39948db9` | #245 | PR #245 |
| `cursor/admin-edit-match-result-ded9` | 2026-05-17 | `94ea29ae` | #244 | PR #244 |
| `cursor/admin-matches-sort-filter-ab50` | 2026-05-20 | `821511a3` | #258 | PR #258 |
| `cursor/admin-notif-result-errors-pin-ab50` | 2026-05-20 | `8a29c940` | #266 | PR #266 |
| `cursor/admin-phone-sms-exempt-ab50` | 2026-05-20 | `7a8f28ac` | #260 | PR #260 |
| `cursor/admin-pin-session-hardening-ab50` | 2026-05-19 | `4c94d6b1` | #254 | PR #254 |
| `cursor/americano-datetime-ddmm-punktum` | 2026-04-08 | `00ccf957` | #98 | PR #98 |
| `cursor/americano-liga-full-notify-ab50` | 2026-05-20 | `24e72c7b` | #269 | PR #269 |
| `cursor/americano-start-full-courts-tab-refresh` | 2026-04-08 | `bf9563cb` | #100 | PR #100 |
| `cursor/automate-sql-deploy-ab50` | 2026-05-20 | `c93ca2e7` | #270 | PR #270 |
| `cursor/baner-halbooking-link` | 2026-04-08 | `dc5cc03d` | #85 | PR #85 |
| `cursor/batch-notifications-ded9` | 2026-05-16 | `ac5a227d` | #210 | PR #210 |
| `cursor/dead-code-cleanup-049b` | 2026-04-09 | `de26e7d3` | #105 | PR #105 |
| `cursor/development-environment-setup-2e57` | 2026-04-06 | `e0e02b7c` | #11 | PR #11 |
| `cursor/elo-margin-multiplier-049b` | 2026-04-09 | `6ca65609` | #109 | PR #109 |
| `cursor/eslint-split-platform` | 2026-04-07 | `4a8eee6c` | #82 | PR #82 |
| `cursor/eu-date-format-followup` | 2026-04-08 | `4e3b16a8` | #93 | PR #93 |
| `cursor/exempt-skip-onboarding-ab50` | 2026-05-20 | `7a6aa95c` | #265 | PR #265 |
| `cursor/find-makker-bio-collapse-ab50` | 2026-05-20 | `7346e079` | #277 | PR #277 |
| `cursor/fix-americano-rls-execute-ab50` | 2026-05-19 | `a2d67058` | #256 | PR #256 |
| `cursor/fix-e2e-smoke-stats-locator-ab50` | 2026-05-20 | `ce1bad6a` | #259 | PR #259 |
| `cursor/fix-elo-match-players-team-type` | 2026-04-06 | `00c017e1` | #17 | PR #17 |
| `cursor/fix-find-makker-elo-display-ab50` | 2026-05-20 | `69a00783` | #276 | PR #276 |
| `cursor/fix-kampe-notif-focus-scroll-ab50` | 2026-05-20 | `e844e403` | #267 | PR #267 |
| `cursor/fix-onboarding-exempt-fetch-ab50` | 2026-05-20 | `565bf7db` | #263 | PR #263 |
| `cursor/fix-onboarding-phone-exempt-ab50` | 2026-05-20 | `7acfeb40` | #261 | PR #261 |
| `cursor/fix-profile-availability-array` | 2026-04-07 | `2a241976` | #81 | PR #81 |
| `cursor/fix-tab-focus-spinner` | 2026-04-08 | `beb22053` | #101 | PR #101 |
| `cursor/fix-tab-spinner-when-profile-exists` | 2026-04-08 | `8146894a` | #103 | PR #103 |
| `cursor/forgot-password-neutral-copy-ded9` | 2026-05-18 | `1633f0a2` | #248 | PR #248 |
| `cursor/harden-phone-exempt-security-ab50` | 2026-05-20 | `c9299ee2` | #262 | PR #262 |
| `cursor/hide-expired-report-error-box-ab50` | 2026-05-19 | `564fa014` | #257 | PR #257 |
| `cursor/hjemmeside-opbygning-26f3` | 2026-04-09 | `78c49adc` | #15 | PR #15 |
| `cursor/kampe-americano-liga-notif-focus-ab50` | 2026-05-20 | `21b59d1e` | #268 | PR #268 |
| `cursor/kampe-scoped-queries-elo-maybe-single-049b` | 2026-04-10 | `522f516a` | #112 | PR #112 |
| `cursor/landing-seo-support-pwa-049b` | 2026-04-09 | `d2a94e24` | #108 | PR #108 |
| `cursor/landing-stats-invite-share-ded9` | 2026-05-17 | `e45cefe2` | #212 | PR #212 |
| `cursor/landing-trust-pages-049b` | 2026-04-09 | `f7bfe7ae` | #106 | PR #106 |
| `cursor/league-matches-rls-cleanup-ded9` | 2026-05-18 | `b5e25971` | #247 | PR #247 |
| `cursor/makkere-elo-americano-delete` | 2026-04-08 | `c8d70fc9` | #99 | PR #99 |
| `cursor/match-result-one-set-wins` | 2026-04-06 | `58ff9a05` | #16 | PR #16 |
| `cursor/notifications-full-suite-ab50` | 2026-05-20 | `48048f7b` | #272 | PR #272 |
| `cursor/notifications-remaining-ab50` | 2026-05-20 | `44fda8e3` | #273 | PR #273 |
| `cursor/oauth-google-apple-ded9` | 2026-05-18 | `76c22f9d` | #249 | PR #249 |
| `cursor/onboarding-prefill-profile-ab50` | 2026-05-20 | `0300a5a4` | #264 | PR #264 |
| `cursor/pentest-pii-lockdown-ab50` | 2026-05-19 | `d89d92ab` | #253 | PR #253 |
| `cursor/performance-optimizations-ded9` | 2026-05-16 | `0db92503` | #209 | PR #209 |
| `cursor/phone-verify-existing-admin-exempt-ded9` | 2026-05-19 | `c7e58d29` | #252 | PR #252 |
| `cursor/profile-avatar-pending-upload-049b` | 2026-04-10 | `52785e61` | #117 | PR #117 |
| `cursor/profile-elo-sync-elo-history` | 2026-04-06 | `782db8e1` | #29 | PR #29 |
| `cursor/public-events-americano-049b` | 2026-04-09 | `3193ccc2` | #107 | PR #107 |
| `cursor/push-onboarding-opt-out-ab50` | 2026-05-20 | `b84eadcc` | #274 | PR #274 |
| `cursor/ranking-load-more-ded9` | 2026-05-16 | `7edab083` | #211 | PR #211 |
| `cursor/reminder-guards-unfilled-matches-4951` | 2026-09-14 | `507c8d7f` | #354 | PR #354 |
| `cursor/remove-apple-oauth-ded9` | 2026-05-19 | `b43545f1` | #250 | PR #250 |
| `cursor/result-error-reports-ded9` | 2026-05-17 | `340fea2b` | #243 | PR #243 |
| `cursor/revert-scoreboard-pr119-049b` | 2026-04-10 | `d9d2c36f` | #120 | PR #120 |
| `cursor/rls-advisor-fix` | 2026-04-07 | `8acf69e6` | #84 | PR #84 |
| `cursor/scroll-to-top-on-route-049b` | 2026-04-09 | `32a45083` | #111 | PR #111 |
| `cursor/security-hardening-phase2-ded9` | 2026-05-18 | `0c6ebb81` | #246 | PR #246 |
| `cursor/security-stability-fixes-ab50` | 2026-05-20 | `a0e4247d` | #275 | PR #275 |
| `cursor/skansen-halbooking-match` | 2026-04-08 | `ed0a8791` | #87 | PR #87 |
| `cursor/split-platform-tabs` | 2026-04-07 | `02749737` | #83 | PR #83 |
| `cursor/trigger-vercel-deploy-americano-dates` | 2026-04-08 | `4dfe0a4b` | #95 | PR #95 |
| `cursor/twilio-phone-signup-ded9` | 2026-05-19 | `86cdc649` | #251 | PR #251 |
| `cursor/venues-onboarding-names` | 2026-04-08 | `052c955d` | #102 | PR #102 |
| `cursor/vercel-deploy-smoke-test` | 2026-04-08 | `2036128d` | #97 | PR #97 |
| `revert-133-codex/review-padelmakker-codebase-and-architecture-l7tn6e` | 2026-04-14 | `953e7193` | #136 | PR #136 |
| `schema-baseline/20260920-203723` | 2026-09-20 | `a0b2643c` | #370 | PR #370 |
| `vercel/install-vercel-speed-insights-c7pdim` | 2026-04-05 | `725335a3` | #2 | PR #2 |
| `vercel/install-vercel-speed-insights-dfboub` | 2026-04-05 | `2101e05f` | #1 | PR #1 |
| `vercel/install-vercel-speed-insights-r6hiyr` | 2026-04-08 | `90b219fa` | #96 | PR #96 |
| `vercel/vercel-web-analytics-integrati-2xkau1` | 2026-04-05 | `65141257` | #3 | PR #3 |
| `claude/americano-completed-redesign` | 2026-05-17 | `ce27016c` | — | `patches/claude__americano-completed-redesign/` |
| `claude/code-review-oGzoN` | 2026-04-19 | `8d16e06e` | — | `patches/claude__code-review-oGzoN/` |
| `claude/review-project-architecture-VBOdQ` | 2026-04-15 | `63f7d599` | — | `patches/claude__review-project-architecture-VBOdQ/` |
| `cursor/admin-security-phase3-ab50` | 2026-05-19 | `4d7005c2` | — | `patches/cursor__admin-security-phase3-ab50/` |
| `cursor/agent-workflow-new-pr-per-change` | 2026-04-06 | `37c457f5` | — | `patches/cursor__agent-workflow-new-pr-per-change/` |
| `cursor/baner-external-booking-links-049b` | 2026-04-13 | `09030f53` | — | `patches/cursor__baner-external-booking-links-049b/` |
| `cursor/baner-past-slots-match-padel` | 2026-04-09 | `7374bdbe` | — | helt indeholdt i andre PR'er |
| `cursor/baner-skansen-halbooking-live` | 2026-04-08 | `423f4257` | — | `patches/cursor__baner-skansen-halbooking-live/` |
| `cursor/code-review-fixes-ded9` | 2026-05-17 | `47614f6f` | — | helt indeholdt i andre PR'er |
| `cursor/completed-match-scoreboard-card-049b` | 2026-04-10 | `9d9b006c` | — | `patches/cursor__completed-match-scoreboard-card-049b/` |
| `cursor/debug-fixes-jul2026` | 2026-07-05 | `5596a053` | — | `patches/cursor__debug-fixes-jul2026/` |
| `cursor/elo-graph-hover-svg-mapping` | 2026-04-06 | `cd38dc24` | — | `patches/cursor__elo-graph-hover-svg-mapping/` |
| `cursor/faq-elo-explainer-049b` | 2026-04-09 | `2b771eaf` | — | `patches/cursor__faq-elo-explainer-049b/` |
| `cursor/fix-supabase-migrate-workflow-ab50` | 2026-05-20 | `1bfc596c` | — | helt indeholdt i andre PR'er |
| `cursor/full-app-audit-followup-4951` | 2026-09-14 | `e5d8ce0b` | — | `patches/cursor__full-app-audit-followup-4951/` |
| `cursor/invisible-security-hardening-ab50` | 2026-05-19 | `f0173e21` | — | helt indeholdt i andre PR'er |
| `cursor/public-footer-elo-049b` | 2026-04-09 | `967cbdc1` | — | `patches/cursor__public-footer-elo-049b/` |
| `cursor/signup-email-confirmation-page-049b` | 2026-04-10 | `2a111f25` | — | `patches/cursor__signup-email-confirmation-page-049b/` |
| `merge/charming-tesla-into-main` | 2026-07-13 | `50914eed` | — | `patches/merge__charming-tesla-into-main/` |
| `schema-baseline/20260920-202646` | 2026-09-20 | `9392c1d3` | — | `patches/schema-baseline__20260920-202646/` |
| `v0/therealchixz-dd175950` | 2026-04-03 | `71ff39ab` | — | helt indeholdt i andre PR'er |

Antal: 162
