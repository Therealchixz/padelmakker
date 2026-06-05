# Phase 1 — Implementation Plan (recalibrated to actual codebase)

**Status:** Draft for review
**Date:** 2026-06-05
**Prereq finding:** A code + live-schema audit shows PadelMakker **already has** Playtomic 0–7 levels, dual ELO engines (2v2 + Americano), a Glicko-2 shadow system, level-band + geo (haversine) matchmaking, and a full notification stack (`notifications` + `push_subscriptions` tables, Web Push/VAPID, Realtime inbox, per-channel prefs). The original PRD's "Phase 1" is therefore **mostly already built.**

This document replaces that Phase 1 with the **two genuine gaps** found in the audit.

---

## What's already built (do NOT rebuild)
| Capability | Where | Status |
|---|---|---|
| Playtomic 0–7 level (self-set + computed) | `lib/padelLevelUtils.js`, `components/PlaytomicLevelPicker.jsx` | ✅ |
| ELO 2v2 engine (K-decay, margin, zero-sum) | `lib/eloV2Math.js`, `elo_history` table | ✅ |
| Americano ELO + history | `lib/americanoEloMath.js`, `americano_elo_history` | ✅ |
| Glicko-2 shadow ratings | `glicko2_shadow_ratings/_history` tables | ✅ (shadow) |
| Level-band matchmaking (±0.1–0.5) | `lib/matchSearchFilterCore.js`, `makkerSearchFilterCore.js` | ✅ |
| 5-factor match scoring (skill/time/geo/intent/court) | `lib/matchmakingUtils.js` | ✅ |
| Geo "near me" (haversine + area fallback + travel_willing) | `lib/matchmakingUtils.js` (client-side JS) | ✅ |
| Notifications table + RPC + policy (25+ types) | `notifications` table, `lib/notifications.js`, `lib/notificationPolicy.js` | ✅ |
| Web Push (VAPID) + subscriptions | `push_subscriptions` table (7 live), `send-push` edge fn | ✅ |
| Realtime in-app inbox + app badge | `components/NotificationBell.jsx` | ✅ |

---

## The two real gaps

### Gap 1 — The activity feed is fragile and not realtime
**Current state:** `HomeTab.jsx` `fetchFeed` runs ~8 parallel client-side queries (`elo_history`, `americano_tournaments` ×2, `leagues` ×2, `matches`, `profiles` where `seeking_match`), merges + sorts them in the browser, guarded by a 15s watchdog and `Promise.allSettled`. There is **no dedicated feed table and no Realtime** — it only refreshes on poll/navigation. This client-side assembly is the direct source of the recurring "Seneste aktivitet viser bare grå" bug (one throwing query or a lost state-set blanks the whole feed).

**Goal:** Make the feed robust, fast, and live — without inventing premature infrastructure (43 users, 11 matches: a dedicated denormalized activity table is NOT yet justified).

### Gap 2 — No iOS "install to enable push" prompt
**Current state:** Web Push works; `push_subscriptions` has 7 live rows. But on iPhone, Web Push **only** works inside an installed (Add-to-Home-Screen) PWA — and the app has no custom prompt guiding iOS users to install. iOS users silently can't receive push. `NotificationBell.jsx` checks `isPushSupported()` but doesn't coach the install step.

---

## Phase 1 scope (the quick win)

### 1.1 Consolidate the feed into ONE server-side RPC
Replace the 8 client-side queries with a single Postgres function `get_home_feed(p_limit int, p_user_id uuid)` that `UNION ALL`s the existing sources into one shape and returns the top N by recency. One round-trip, server-sorted, RLS-respecting.

- **No new tables.** Read from existing tables (`elo_history`, `americano_tournaments`, `leagues`, `matches`, `profiles` seeking). This keeps fan-out-on-read (correct at this scale) but moves assembly server-side where it's robust.
- Returns a uniform row: `kind, ref_id, actor_id, title, subtitle, tone, created_at, meta jsonb`.
- The seeking-profile TTL logic (`seekingFeedTtl.js`: 24h kamp / 7d makker) is encoded in the RPC's WHERE clause.
- **Client change:** `fetchFeed` becomes a single `supabase.rpc('get_home_feed', …)` call. Delete the 8-query orchestration, the 15s watchdog, and the `withTimeout`/`fetchIdRef` race scaffolding that caused the gray-feed regressions. Map RPC rows to the existing feed-row renderer (keep the current card UI + filter chips untouched).

**Why this is the highest-value item:** it permanently kills the class of bug that's cost the most cycles, and it's a net code *deletion* on the client.

### 1.2 Live-update the feed via Supabase Realtime
Subscribe (lightweight) to the events that change the feed and re-call `get_home_feed` (debounced) when they fire — mirroring the proven pattern already in `NotificationBell.jsx`.

- Subscribe to `postgres_changes` INSERT on `elo_history`, `matches`, and `americano_tournaments` (and UPDATE on `profiles.seeking_match`), filtered minimally.
- On event → debounce 1–2s → silent re-fetch (`silent=true`, no skeleton flash). Reuse the existing retry/fallback-poll shape from the bell so a dropped channel degrades gracefully.
- Respect Realtime limits (fine at this scale; single-thread postgres_changes is a non-issue at 11 matches).

### 1.3 iOS PWA install prompt for push
Add a small, dismissible coach-mark shown only when: iOS + Safari + not running as installed PWA (`navigator.standalone !== true`) + push not yet enabled.

- Copy: "Tilføj PadelMakker til hjemmeskærmen for at få notifikationer" + the Del → "Føj til hjemmeskærm" steps.
- Detection helper (e.g. `lib/iosInstallPrompt.js`): `isIos()`, `isInStandalone()`, `shouldShowIosInstallHint()`. Persist "dismissed" in `localStorage`.
- Surface it next to the existing "Aktivér notifikationer" affordance in `NotificationBell.jsx` (and/or a one-time banner on `HomeTab`).
- Pure client; no schema/backend change.

---

## Explicitly deferred (not Phase 1)
- **PostGIS / `ST_DWithin`.** Current haversine-in-JS works for 43 users. Moving geo to a PostGIS RPC is a *scale/perf* optimization (avoids shipping candidate profiles to the client), not a feature. Revisit when candidate sets get large.
- **Dedicated denormalized `activity` table (fan-out-on-write).** Premature at this volume. The `get_home_feed` RPC (fan-out-on-read) is the right tool until feed queries get slow.
- **Novu / notification SaaS, padelapi.org, OSM court data.** Later phases per the PRD.

---

## Deliverables / order of work
1. **DB:** `get_home_feed` Postgres function (migration) — UNION of existing sources, TTL-encoded, `security definer` + RLS-safe. Verify against current row counts.
2. **Client:** rewrite `HomeTab.fetchFeed` to one `.rpc()` call; delete watchdog/withTimeout/fetchId scaffolding; keep card UI + chips.
3. **Realtime:** debounced subscription → silent re-fetch.
4. **iOS:** `lib/iosInstallPrompt.js` + coach-mark in `NotificationBell`/`HomeTab`.
5. **Verify:** `npm run lint` (0 errors — the lesson from the gray-feed saga) + `npm run build`; manual check that the feed loads, live-updates, and the iOS hint shows only in the right conditions. Bump SW version.

## Success criteria
- Feed renders from a single round-trip; no skeleton-stuck states reproducible.
- New match/result/tournament/seeking change appears in the feed within ~2s without manual refresh.
- iOS-Safari-not-installed users see the install hint; installed/Android users never do.
- Net reduction in client feed code.

## Risks
- **RPC ↔ existing renderer mismatch:** map RPC columns to the current feed-row shape carefully; keep the UI layer unchanged to limit blast radius.
- **Realtime noise:** debounce + silent refetch to avoid flicker; cap re-fetch frequency.
- **RLS in `security definer`:** ensure the function only returns rows the caller may see (mirror current per-source visibility).

## Open questions (non-blocking)
1. Level capture nuance (slider vs slider+questions) — moot for Phase 1 since level already exists; revisit only if we tweak onboarding.
2. iOS user share — sizes urgency of 1.3 (still cheap regardless).
3. Court-data seeding — Phase 2 (geo) concern.
