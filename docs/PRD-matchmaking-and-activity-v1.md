# PRD — PadelMakker: Partner Matchmaking + Activity & Notifications (Phased)

**Status:** Draft for review
**Date:** 2026-06-05
**Scope:** Two feature areas chosen for V1 — (1) Partner Matchmaking, (2) Activity Feed + Notifications.
**Guiding principle:** *Extend the existing React + Supabase app. Do not rebuild. Get a quick win, then layer complexity.*

---

## 1. Why "extend, not rebuild"

PadelMakker already runs on React + Supabase/Postgres and already has working primitives for both focus areas: seeking-partner cards, invitations/join-requests, an activity feed ("Seneste aktivitet"), and Web Push via a service worker + VAPID. The research below confirms that for an app of this size (hundreds → low-thousands of users), **you already own every infrastructure layer that the paid SaaS products sell.** The job is to sharpen what exists, not replace it.

The single biggest external constraint discovered: **iOS Web Push only works for an installed (Add-to-Home-Screen) PWA, iOS 16.4+.** This is an Apple platform limit — *no vendor (Novu/Knock/OneSignal) solves it.* It must be a first-class UX consideration regardless of roadmap.

---

## 2. Build-vs-buy decisions (research-backed)

| Capability | Decision | What we use | Why |
|---|---|---|---|
| Skill rating engine | **Build (on a library)** | `openskill` (npm), **MIT**, team-native, maintained (v4.1.1, Mar 2026) | Padel is **doubles**; Elo/Glicko are 1v1-only. OpenSkill models 2v2 teams natively and is the patent-free alternative to TrueSkill (which is **patented by Microsoft — avoid for a commercial app**). |
| Matchmaking algorithm | **Build (plain SQL)** | Postgres rating-band filter + PostGIS `ST_DWithin` | Google's **OpenMatch is overkill** (Go/Kubernetes distributed system). A social-sports app needs a `WHERE rating BETWEEN … AND ST_DWithin(...)` query, not a matchmaking cluster. |
| Geo "near me" | **Build (Postgres)** | **PostGIS** `geography(Point,4326)` + GiST index, exposed via Supabase RPC | PostGIS is available on Supabase and first-class documented. `ST_DWithin` uses the spatial index; `<->` for nearest sort. |
| Activity feed | **Build (Postgres)** | Single `activity` table, **fan-out-on-read**, Supabase Realtime `postgres_changes` | At this scale a feed engine (Stream) adds cost + lock-in + a 2nd datastore. Stream's React SDK is **unmaintained** (last release Mar 2022) and pricing jumps steeply past free. Fan-out-on-read is the correct default for small N. |
| In-app notifications | **Keep what you have** | Postgres `notifications` table + Supabase Realtime | Realtime `postgres_changes` on a notifications table *is* a complete live in-app inbox. |
| Push notifications | **Keep what you have** | `web-push` (npm, **MPL-2.0**) + VAPID + service worker | Standards-based, free, no per-message vendor cost, no Firebase dependency. FCM-for-web uses VAPID under the hood anyway — you're not missing a standard. |
| Notification SaaS | **Defer** | (later: **Novu** — open-source, MIT core, self-hostable, React `<Inbox/>`) | Only worth it when you need pre-built UI + true multichannel (email/SMS digests). Avoid Knock/Courier for now: brutal free→paid cliff ($0 → $99–$250/mo). |
| Padel sports data | **Optional add** | **padelapi.org** — free 50k req/mo, REST + its own MCP | Only padel-domain data API/MCP found. Premier Padel/FIP rankings, results. Nice-to-have, not core to matchmaking amateurs. |
| Court discovery data | **Defer** | OpenStreetMap Overpass (`leisure=pitch`+`sport=padel`), free | Verify Danish coverage first (volunteer-dependent). |
| Court **booking** availability | **Out of scope / partnerships only** | — | No clean public path. Playtomic's official API is **club-only, read-only, per-club credentials** — not a public cross-club availability API. Reverse-engineered Playtomic APIs exist but are **ToS-risky and fragile — do not depend on them.** |
| Backend tooling | **Already wired** | Official Supabase MCP (confirmed, connected in this env) | — |

---

## 3. The two product areas

### A. Partner Matchmaking
Help a player find the right partner/match by **skill level** and (later) **proximity**, mirroring the proven Playtomic "open match" mechanic: a match row with a host, open slots, a level band, time, and location; one-click join; approval required for out-of-band joiners.

### B. Activity Feed + Notifications
A reliable, live "Seneste aktivitet" timeline (matches played, partner-seeking posts, invitations) backed by a proper events table, plus the existing push/in-app notifications — made consistent and trustworthy.

---

## 4. Phased roadmap

### Phase 1 — Quick Win (the lovable minimum) 🎯
**Theme: "Find a partner at my level" — with zero new infrastructure.**

The fastest value comes from a **self-rated level** (no rating engine yet) plus filtering the discovery you already have.

1. **Player level (self-assessed).** Add a single `level` field on the **Playtomic 0.0–7.0 scale** (named bands: <1 Begynder, 1.0–2.4 Let øvet, 2.5–3.4 Øvet, 3.5–4.4 Rutineret, 4.5+ Avanceret), captured in a one-screen onboarding (slider + 2–3 calibrating questions). Pure data — no algorithm. *(Decided: 0–7, the de-facto padel standard; maps cleanly onto OpenSkill in Phase 3.)*
2. **Level-aware discovery.** Add a level filter/band to the existing "søger makker" / open-match lists ("vis spillere ±0.5 af mit niveau"). Show each player's level as a banded badge.
3. **Consolidate the activity feed** onto a single `activity` (events) table populated by triggers, replacing ad-hoc unions; keep the existing filter chips. (Builds directly on the feed you just stabilized.)
4. **Realtime feed + inbox.** Ensure Supabase Realtime `postgres_changes` live-updates both the feed and the notification bell (RLS-scoped).
5. **iOS PWA push UX.** Add a clear "Tilføj til hjemmeskærm for at få notifikationer" prompt for iOS users — the one thing that silently breaks push today.

**Why this is the quick win:** no OpenSkill, no PostGIS, no new services. Ships on the current stack, makes matching meaningfully better immediately, and de-risks the feed/notifications you just fixed.

**Success metrics:** % of users with a level set; # of level-filtered match joins; feed loads < 500 ms; push opt-in rate (split iOS-installed vs not).

### Phase 2 — Proximity matchmaking *(pulled forward — geo is a near-term must-have)*
- Enable **PostGIS**; add `geography(Point,4326)` to players/courts/matches + GiST index.
- "Spillere/kampe nær mig" via an RPC using `ST_DWithin` + `<->` nearest sort, **combined with the Phase-1 level band** → "spillere på mit niveau i nærheden."
- Court locations seeded from **OSM Overpass** (free), pending a Danish-coverage check; geocoding via Mapbox (more generous free tier than Google's 2026 pricing).

### Phase 3 — Automatic skill rating
- Introduce **OpenSkill.js** in a Supabase Edge Function: after each completed competitive match, update each player's μ/σ (team-native, doubles-correct).
- Display the **conservative rating (μ − 3σ)** mapped onto the familiar 0–7 scale.
- Add a **reliability/confidence** indicator (low matches → bigger swings), mirroring Playtomic. The Phase-1 self-rating becomes the cold-start seed; OpenSkill takes over as match history grows.

### Phase 4 — Notification depth (only if needed)
- Multichannel + digests ("din kamp er i morgen", weekly recap) — this is the real orchestration work.
- If hand-rolling becomes painful, adopt **Novu** (open-source, self-hostable, React `<Inbox/>`) rather than a proprietary SaaS. Push still rides your existing VAPID setup.

### Phase 5 — Padel data enrichment (nice-to-have)
- Integrate **padelapi.org** (free 50k/mo) for Premier Padel/FIP content — pro rankings/results as engagement content. Not part of amateur matchmaking.

---

## 5. Explicitly out of scope (and why)
- **Rebuilding the app** — throws away working code.
- **OpenMatch / dedicated matchmaking infra** — Kubernetes-scale solution to a SQL-scale problem.
- **Stream / feed-as-a-service** — cost, lock-in, unmaintained React SDK, unnecessary at this scale.
- **TrueSkill** — Microsoft patent; not for commercial use.
- **Reverse-engineered Playtomic/booking APIs** — ToS violation, fragile, legal risk.
- **Real-time court booking** — no clean public API; partnership-only.

---

## 6. Decisions & remaining questions
**Decided:**
- ✅ **Level scale:** Playtomic **0–7** (de-facto standard; maps to OpenSkill later).
- ✅ **Geography:** must-have soon → **proximity pulled forward to Phase 2** (ahead of auto-rating).

**Still open:**
1. **Phase 1 level capture:** single slider, or slider + 2–3 calibrating questions? *(Recommendation: slider + a couple of questions for a better starting estimate.)*
2. **iOS share:** what % of your users are on iOS? This sizes how urgent the PWA-install push UX is (it silently blocks push today).
3. **Court data for Phase 2:** seed from OSM Overpass (free, may be incomplete in DK) and let users add missing courts, or start with a hand-curated list of Danish clubs? *(Recommendation: hand-curated seed + user-submitted additions; OSM as enrichment.)*

---

### Appendix — key sources
- OpenSkill (MIT, doubles): github.com/philihp/openskill.js · paper arXiv:2401.05451
- TrueSkill patent caveat: patents.google.com/patent/US20090227313A1
- Playtomic levels (0–7, reliability): helpmanager.playtomic.com · Open Match mechanic: playerhelp.playtomic.com
- Supabase Realtime postgres_changes + RLS: supabase.com/docs/guides/realtime/postgres-changes
- PostGIS on Supabase: supabase.com/docs/guides/database/extensions/postgis
- `web-push` (MPL-2.0) + iOS 16.4 PWA push constraint: github.com/web-push-libs/web-push
- Novu (open-source notifications, React `<Inbox/>`): github.com/novuhq/novu
- Stream Activity Feeds (lock-in, unmaintained React SDK): github.com/GetStream/react-activity-feed
- padelapi.org (free padel data + MCP); OSM Overpass (free court data)
