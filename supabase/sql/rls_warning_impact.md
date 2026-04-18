# Hvad betyder de 19 Supabase RLS warnings i praksis?

Kort version:
- De er **performance warnings** (ikke direkte "app er broken").
- Appen virker typisk stadig, men databasen bruger mere CPU pr. query.
- Ved højere trafik kan det give langsommere svar i fx kamplister/profiler.

## 1) `auth_rls_initplan`

Når en policy bruger `auth.uid()` direkte, kan Postgres ende med at evaluere den pr. række.
Det er funktionelt korrekt, men langsommere.

**Konsekvens på www.padelmakker.dk:**
- Ingen ændring i adgangsregler i sig selv.
- Potentielt langsommere queries på store tabeller.

## 2) `multiple_permissive_policies`

Når der er flere permissive policies for samme rolle+action (fx `authenticated + UPDATE`),
skal flere policy-udtryk evalueres ved hver query.

**Konsekvens på www.padelmakker.dk:**
- Funktioner virker ofte stadig (samme adgang kan stadig være tilladt).
- Men performance bliver ringere, og policy-landskabet bliver sværere at vedligeholde.

## Risiko ved at "fixe" warnings

Det der kan gå galt er ikke selve warningen, men en forkert policy-ændring:
- For stram policy => legitime handlinger bliver blokeret (fx deltager kan ikke indsende resultat).
- For åben policy => utilsigtet adgang.

Derfor bør fixes rulles ud med checkliste:
1. Kør SQL i staging/projekt-klon først.
2. Test flows: profil-opdatering, opret kamp, tilmeld/afmeld, indsæt/opdater/slet resultat, admin-kick.
3. Kør Supabase linter igen.
4. Rul til produktion.

## Hvad filen `rls_fix_19_linter_warnings.sql` gør

Den forsøger at:
- fjerne overlap mellem admin `FOR ALL` og action-specifikke policies,
- erstatte `auth.uid()` med `(select auth.uid())` hvor relevant,
- samle dublet-DELETE policies på `match_players` og `americano_participants`.

Se: `supabase/sql/rls_fix_19_linter_warnings.sql`.
