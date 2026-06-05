# Phase 2 — Plan: Scheduled Reminders (#1) + Add-to-Calendar (#2)

**Status:** Draft for review
**Date:** 2026-06-05
**Goal:** Add the missing *proactive, time-based* layer so the app reaches out at the right moment — reducing no-shows, re-engaging users, and keeping ELO data fresh.

---

## Verified backend reality (drives the design)
- The only pg_cron job today is `auto-confirm-expired-results` (pure SQL). **No reminders of any kind exist.**
- **No DB trigger sends push** — push is triggered only by the client calling the `send-push` Edge Function (VAPID/Web Push). Inserting a `notifications` row does NOT send a push.
- **`pg_net` is not installed**, so the database cannot make outbound HTTP. Therefore reminders must be driven by an **Edge Function** (which can both send Web Push and write rows), invoked on a schedule.
- Existing assets to reuse: `notifications` table, `push_subscriptions` table, `send-push` Edge Function (web-push/VAPID), notification policy + per-channel prefs, `match_players` / `americano_participants` / `league_teams` for recipients, Copenhagen-timezone helpers on the client.

---

## Feature #2 — "Tilføj til kalender" (.ics)  ·  *do this first (quick win, zero backend)*

**Why first:** pure client-side, no backend, very low risk, instant daily utility, and it complements reminders.

**Build:**
1. `src/lib/calendarExport.js`:
   - `buildIcs({ uid, title, description, location, startISO, endISO })` → returns a valid VCALENDAR/VEVENT string (CRLF line endings, `DTSTART`/`DTEND` in UTC with `Z`, escaped text).
   - `downloadIcs(filename, ics)` → Blob + temporary `<a download>` click (works on desktop + Android; on iOS Safari it opens the calendar import sheet).
   - Helpers `icsForMatch(match)`, `icsForTournament(t)` mapping our fields (date + time + court/venue) into the event. Use the existing match time fields; compute end from `time_end` or default +90 min.
2. Add a **"Tilføj til kalender"** button (lucide `CalendarPlus`) on:
   - the match detail modal (`setViewMatch`) on HomeTab/KampeTab,
   - the tournament detail view,
   - optionally the "Kommende kampe" cards.

**Risk:** minimal. No schema, no deploy of functions. Lint/build/SW bump, ship.

---

## Feature #1 — Scheduled reminders  ·  *the higher-value piece*

### What the user gets
- **"Din kamp er i morgen kl. 19"** (T‑24h) and **"Din kamp starter om 1 time"** (T‑1h) for matches the user is in.
- Same for **Americano/Mexicano** and **Liga** matches the user is scheduled for.
- *(Phase 1b option)* **"Husk at indtaste resultat"** ~2h after a match's end if no result is logged — keeps ELO alive.

### Architecture (fits the verified backend)
1. **New Edge Function `send-reminders`** (service-role):
   - Computes the current time in **Europe/Copenhagen** (matches store local date + `time`).
   - Finds entities entering a reminder window:
     - matches with status in (`open`,`full`,`in_progress`) whose start is in **[+23h45m, +24h15m]** (24h) and **[+45m, +75m]** (1h),
     - americano_tournaments (status not completed/cancelled) in the same windows,
     - (later) league_matches with a scheduled time.
   - For each entity, resolves recipients (`match_players` / `americano_participants` / league team members), **skips users already sent that (entity, kind)** via a dedup log, **honors each user's notification prefs** (reuse the same prefs the client respects), inserts a `notifications` row, and sends Web Push by reusing the `send-push` web-push/VAPID logic (extract the core sender into a shared module imported by both functions).
   - Writes a dedup row.
2. **Dedup table** (new migration):
   ```sql
   create table public.reminder_log (
     entity_type text not null,   -- 'match' | 'americano' | 'league_match'
     entity_id   uuid not null,
     kind        text not null,   -- 'reminder_24h' | 'reminder_1h' | 'result_nudge'
     user_id     uuid not null,
     sent_at     timestamptz not null default now(),
     primary key (entity_type, entity_id, kind, user_id)
   );
   ```
   RLS: server-only (no client access).
3. **New notification types** in `notificationPolicy.js`: `match_reminder`, `tournament_reminder` (channel `kampe`, level `normal`, `sendPush: true`, sensible cooldown). Optional `result_nudge` (channel `resultat`).
4. **Scheduling** — two options:
   - **(A, recommended) In-Supabase:** `create extension pg_net;` then a `cron.schedule(...)` job every ~15 min that `net.http_post`s the `send-reminders` function URL with the service-role key. Self-contained, matches existing pg_cron usage.
   - **(B) GitHub Actions:** a scheduled workflow (`*/15 * * * *`) curls the function URL with a secret. No pg_net needed; visible in the repo. Good fallback if we prefer not to enable pg_net.

### Important design guards
- **Timezone:** all window math in Europe/Copenhagen (matches store local time). Get this wrong and reminders fire at the wrong hour.
- **No spam:** dedup table + tight windows + a 15-min cadence; respect per-user channel prefs; consider skipping 1h reminders during night hours.
- **Graceful degrade:** users without push (e.g. iOS not installed as PWA) still get the in-app notification + bell badge when they next open the app — the reminder isn't lost.
- **Cancellations:** if a match is cancelled, don't remind (status filter handles it).

### Effort
- #2 calendar: ~half a day, client-only.
- #1 reminders: ~1–2 focused sessions (edge function + shared push module + dedup migration + policy types + scheduling + careful testing of the time windows).

---

## Recommended order
1. **Ship #2 (calendar export)** — instant value, no risk.
2. **Build #1 (reminders)** — start with **match 24h + 1h**; add tournament reminders and the result-nudge once the core loop is proven.

## Open questions
1. Reminder windows — is **24h + 1h** the right pair, or also a **morning-of** ("i dag kl. 19")?
2. Include the **"husk resultat"** nudge in the first cut, or keep v1 to pre-match reminders only?
3. Scheduling: enable **pg_net + pg_cron** (self-contained) or use **GitHub Actions cron**? *(Recommendation: pg_net + pg_cron — matches existing infra.)*
