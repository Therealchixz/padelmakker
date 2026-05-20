# Supabase SQL - overblik og oprydning

Denne mappe indeholder baade:
- produktionskritiske migrations
- hotfixes
- demo/test scripts
- drifts-/reset scripts

For at undgaa fejlkoersel: koer aldrig et script "blindt" uden at laese headeren.

## 1) Kernescripts (rating/flows)

Brug disse som primaere kilder for nuvaerende logik:
- `elo_v2_glicko2_shadow.sql`
- `americano_elo_rating.sql`
- `elo_guardrails_admin_flags.sql`
- `admin_pin_guard.sql`
- `admin_delete_user.sql`
- `match_result_opponent_confirmation_guard.sql`

## 2) Admin/demo scripts

Kun til visuel test/demo:
- `admin_console_demo_flags.sql`

Husk at rydde demo-data bagefter (scriptet indeholder cleanup-query).

## 3) Drifts-/reset scripts (hoej risiko)

Disse maa kun bruges bevidst, typisk i test/staging:
- `wipe_all_users_and_data.sql`
- `reset_player_progress_soft.sql`
- `courts_reset_skansen_only.sql`
- `delete_user_by_email.sql`

## 4) Historiske hotfixes

Filer med navne som `fix_*`, `deep_fix_*`, `_alle_fixes.sql` er historiske
patches. De er nyttige som reference, men ikke noedvendigvis "koer denne foerst".

## 5) Anbefalet arbejdsflow

1. Lav aendring i ny SQL-fil med tydelig header.
2. Opret tilsvarende fil i `supabase/migrations/` (`npm run db:migration:new <navn>`).
3. **Cloud Agent:** koer straks i prod via Supabase MCP `apply_migration` (se `AGENTS.md`).
4. Ved merge til `main` koer GitHub Actions `supabase db push` for nye migrationsfiler.
5. Dokumenter kort i commit-besked hvad scriptet goer.

## 6) Naming guideline (fremadrettet)

- `feature_<omraade>.sql` for nye features
- `fix_<omraade>.sql` for maalrettede fejlrettelser
- `ops_<omraade>.sql` for driftsvaerktoejer
- `demo_<omraade>.sql` for test/demo data
