# PadelMakker — Sikkerhedsrevision & Arkitekturgennemgang

**Dato:** 2026-04-15  
**Scope:** Supabase-skema, RLS-policies, RPC-funktioner, frontend-kode  

---

## TOP 3 KRITISKE SÅRBARHEDER

### KRITISK #1: `recalc_profile_stats_from_elo_history` — `games_won` nulstilles altid til 0

**Placering:** Supabase-funktion `recalc_profile_stats_from_elo_history`

**Problem:** Variablen `v_wins` er deklareret men **aldrig tildelt en værdi**. Når funktionen kører (via trigger på `elo_history` INSERT/UPDATE/DELETE), sættes `games_won = COALESCE(v_wins, 0)` = **altid 0**. Sekvensen er:

1. `apply_elo_for_match` opdaterer `profiles.games_won` korrekt via direkte UPDATE
2. Samme funktion indsætter en række i `elo_history`
3. Triggeren `elo_history_sync_profile` fyrer → kalder `recalc_profile_stats_from_elo_history`
4. Denne funktion OVERSKRIVER `games_won` til 0

**Sværhedsgrad:** DATA-KORRUPTION — alle spilleres sejrantal nulstilles efter hver kamp.

**Fix:**

```sql
CREATE OR REPLACE FUNCTION recalc_profile_stats_from_elo_history(p_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_first numeric;
  v_delta numeric;
  v_games int;
  v_wins  int;
BEGIN
  SELECT COUNT(*)::int INTO v_games FROM public.elo_history
  WHERE user_id = p_user_id AND match_id IS NOT NULL;

  -- FIX: Tæl faktiske sejre fra elo_history
  SELECT COUNT(*)::int INTO v_wins FROM public.elo_history
  WHERE user_id = p_user_id AND match_id IS NOT NULL AND result = 'win';

  SELECT e.old_rating::numeric INTO v_first FROM public.elo_history e
  WHERE e.user_id = p_user_id AND e.old_rating IS NOT NULL
  ORDER BY e.date ASC NULLS LAST, e.match_id ASC NULLS LAST, e.id ASC NULLS LAST LIMIT 1;

  SELECT COALESCE(SUM(CASE
    WHEN change IS NOT NULL THEN change::numeric
    WHEN new_rating IS NOT NULL AND old_rating IS NOT NULL THEN (new_rating - old_rating)::numeric
    ELSE 0 END), 0) INTO v_delta
  FROM public.elo_history WHERE user_id = p_user_id;

  UPDATE public.profiles SET
    elo_rating   = GREATEST(100, ROUND(COALESCE(v_first, 1000) + COALESCE(v_delta, 0))::int),
    games_played = COALESCE(v_games, 0),
    games_won    = COALESCE(v_wins, 0)
  WHERE id = p_user_id;
END;
$$;
```

---

### KRITISK #2: `matches` UPDATE-policy — deltageres opdateringer fejler stille

**Placering:** RLS-policy `matches_update_by_creator_or_participant`

**Problem:** Policyens USING-clause tillader deltagere (match_players), men WITH CHECK tillader **kun creator/admin**:

```
USING:      creator_id = auth.uid() OR EXISTS(match_players...) OR is_admin()
WITH CHECK: creator_id = auth.uid() OR is_admin()
```

Når en **ikke-opretter** joiner en kamp, kører frontend:
```js
// KampeTab.jsx linje 327-329
await supabase.from("matches").update({ status: "full", current_players: 4 }).eq("id", matchId);
```

Denne opdatering **fejler stille** (0 rækker returneret, ingen fejl) fordi WITH CHECK blokerer. Resultatet er at `current_players` og `status` aldrig opdateres når en ikke-opretter fylder kampen.

**Sværhedsgrad:** DATA-INKONSISTENS — kampe viser forkert antal spillere og status.

**Fix — Option A (RPC-tilgang, anbefalet):**

```sql
CREATE OR REPLACE FUNCTION join_match(p_match_id uuid, p_team int)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_count int;
  v_t1 int;
  v_t2 int;
  v_max int;
BEGIN
  IF (SELECT auth.uid()) IS NULL THEN RAISE EXCEPTION 'Ikke logget ind'; END IF;

  -- Indsæt spilleren (unik-constraint forhindrer dobbelt-join)
  INSERT INTO match_players (match_id, user_id, team)
  VALUES (p_match_id, auth.uid(), p_team);

  -- Optæl og opdatér match-status atomisk
  SELECT COUNT(*) INTO v_count FROM match_players WHERE match_id = p_match_id;
  SELECT COUNT(*) INTO v_t1 FROM match_players WHERE match_id = p_match_id AND team = 1;
  SELECT COUNT(*) INTO v_t2 FROM match_players WHERE match_id = p_match_id AND team = 2;
  SELECT max_players INTO v_max FROM matches WHERE id = p_match_id;

  UPDATE matches SET
    current_players = v_count,
    status = CASE WHEN v_t1 >= 2 AND v_t2 >= 2 THEN 'full' ELSE 'open' END
  WHERE id = p_match_id;
END;
$$;
```

**Fix — Option B (policy-rettelse):**

```sql
DROP POLICY matches_update_by_creator_or_participant ON matches;
CREATE POLICY matches_update_by_creator_or_participant ON matches
  FOR UPDATE TO authenticated
  USING (
    creator_id = auth.uid()
    OR EXISTS (SELECT 1 FROM match_players mp WHERE mp.match_id = matches.id AND mp.user_id = auth.uid())
    OR is_admin()
  )
  WITH CHECK (
    creator_id = auth.uid()
    OR EXISTS (SELECT 1 FROM match_players mp WHERE mp.match_id = matches.id AND mp.user_id = auth.uid())
    OR is_admin()
  );
```

> **Bemærk:** Option B åbner for at deltagere kan ændre vilkårlige felter (fx `creator_id`). Tilføj en trigger eller brug Option A.

---

### KRITISK #3: Race condition ved match-join — ingen server-side max_players-håndhævelse

**Placering:** `KampeTab.jsx` `joinMatchWithTeam` + database

**Problem:** Spillertæl og statusopdatering sker client-side. To brugere der klikker "Tilmeld" samtidigt:

1. Bruger A: INSERT match_players → succes (unik constraint OK, forskellige user_ids)
2. Bruger B: INSERT match_players → succes (unik constraint OK)
3. Begge forsøger UPDATE matches SET current_players → se KRITISK #2 (fejler for ikke-opretter)
4. Kampen kan ende med 5+ spillere uden at status skifter til "full"

Der er **ingen CHECK-constraint** eller **trigger** der håndhæver `max_players` på databaseniveau.

**Sværhedsgrad:** DATA-INTEGRITET — kampe kan overskride maksimalt antal spillere.

**Fix (database-trigger):**

```sql
CREATE OR REPLACE FUNCTION enforce_max_players()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_current int;
  v_max int;
BEGIN
  SELECT COUNT(*) INTO v_current FROM match_players WHERE match_id = NEW.match_id;
  SELECT max_players INTO v_max FROM matches WHERE id = NEW.match_id;

  IF v_current >= COALESCE(v_max, 4) THEN
    RAISE EXCEPTION 'Kampen er fuld (% / % spillere)', v_current, v_max;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_enforce_max_players
  BEFORE INSERT ON match_players
  FOR EACH ROW EXECUTE FUNCTION enforce_max_players();
```

---

## YDERLIGERE FUND

### 4. Orphan Data-risiko — FK delete-regler er `NO ACTION`

| Tabel | FK-kolonne | Peger på | Delete-regel |
|-------|-----------|----------|-------------|
| match_players | user_id | profiles | NO ACTION |
| match_results | team*_player*_id | profiles | NO ACTION |
| elo_history | user_id | profiles | NO ACTION |
| bookings | user_id | profiles | NO ACTION |
| messages | sender_id, receiver_id | profiles | NO ACTION |
| matches | creator_id | profiles | NO ACTION |

**Risiko:** Hvis en profil nogensinde slettes, vil FK-constraints blokere sletningen eller efterlade orphaned data. Da profiler ikke kan slettes (RLS: kun admin), er dette en latent risiko.

**Anbefaling:** Overvej `ON DELETE SET NULL` for match_results player-felter og `ON DELETE CASCADE` for match_players, elo_history og notifications.

---

### 5. `match_results` mangler UNIQUE constraint på `match_id`

**Problem:** Flere resultater kan indsættes for samme kamp. Frontend vælger den seneste via `ORDER BY created_at DESC LIMIT 1`, men databasen håndhæver det ikke.

**Fix:**

```sql
-- Tilføj unik constraint (fjern evt. dubletter først)
DELETE FROM match_results a USING match_results b
WHERE a.match_id = b.match_id AND a.created_at < b.created_at;

CREATE UNIQUE INDEX idx_match_results_unique_match ON match_results (match_id);
```

---

### 6. Frontend fejlhåndtering — stille fejl ved netværksproblemer

**Berørte filer:**
- `HomeTab.jsx` linje 32-38: `fetchFeed` destrukturerer `{ data }` uden at tjekke `error`
- `MakkereTab.jsx` linje 76: `Profile.filter()` kaster fejl, men `fetchEloStatsBatchByUserIds` ignorerer fejl stille
- `AdminTab.jsx` linje 40-43: `fetchUsers` tjekker `if (!error)` men viser ingen fejlbesked
- `base44Client.js`: `filter()` metoden kaster fejl (`throw error`), men kalderstederne fanger dem inkonsekvent

**Eksempler:**

```js
// HomeTab.jsx — ingen fejltjek
const { data: eloDataFull } = await supabase
  .from('elo_history')
  .select('...')
  // Hvis dette fejler, er eloDataFull undefined → filter() på undefined crasher
```

**Anbefaling:** Brug et konsistent mønster:
```js
const { data, error } = await supabase.from('elo_history').select('...');
if (error) { console.error(error); showToast?.('Netværksfejl'); return; }
const safeData = data || [];
```

---

### 7. `notifications` mangler INSERT-policy (korrekt design, men dokumentér)

Tabellen `notifications` har SELECT/UPDATE/DELETE policies men **ingen INSERT policy**. Alle inserts sker via SECURITY DEFINER RPCs (`create_notification_for_user`, `notify_match_creator_on_join`), som korrekt omgår RLS. Dette er godt design — men hvis nogen forsøger direkte INSERT, fejler det stille.

---

### 8. `protect_elo_fields` trigger + SECURITY DEFINER RPCs — potentiel konflikt

Triggeren `protect_elo_fields` blokerer ændringer af `elo_rating`, `games_played`, `games_won` for ikke-admins. Men `apply_elo_for_match` (SECURITY DEFINER) opdaterer disse felter direkte. Da `auth.uid()` stadig returnerer den originale brugers ID i SECURITY DEFINER-kontekst, vil `is_admin()` returnere `false` for en normal bruger.

**Potentiel risiko:** ELO-opdateringer kan blive blokeret af triggeren. Test dette scenarie med en ikke-admin bruger.

**Fix (hvis det er et problem):** Tilføj en session-variabel check i triggeren:

```sql
-- I apply_elo_for_match, FØR profiles-opdateringer:
PERFORM set_config('app.bypass_elo_protection', 'true', true);

-- I protect_elo_fields triggeren:
IF current_setting('app.bypass_elo_protection', true) = 'true' THEN
  RETURN NEW;
END IF;
```

---

### 9. AdminTab.jsx — duplikeret import

```js
// Linje 8-11 OG linje 15-20: Samme import to gange
import { LEVELS, PLAY_STYLES, REGIONS, levelStringFromNum } from '../lib/platformConstants';
import { LEVELS, PLAY_STYLES, REGIONS, levelStringFromNum } from '../lib/platformConstants';
```

**Fix:** Fjern den ene import-linje.

---

## OPSUMMERING

| # | Type | Sværhedsgrad | Status |
|---|------|-------------|--------|
| 1 | `v_wins` aldrig tildelt → games_won = 0 | KRITISK | Kræver SQL-fix |
| 2 | matches UPDATE policy mismatch | KRITISK | Kræver policy-fix eller RPC |
| 3 | Race condition ved match-join | KRITISK | Kræver DB-trigger |
| 4 | FK delete-regler = NO ACTION | MEDIUM | Overvej ON DELETE SET NULL/CASCADE |
| 5 | match_results mangler UNIQUE on match_id | MEDIUM | Tilføj index |
| 6 | Inkonsekvent fejlhåndtering i frontend | MEDIUM | Refactor DB-kald |
| 7 | notifications mangler INSERT policy | LAV | By design (RPCs) |
| 8 | protect_elo_fields vs SECURITY DEFINER | MEDIUM | Test + evt. bypass-mekanisme |
| 9 | Duplikeret import i AdminTab | LAV | Fjern duplikat |
