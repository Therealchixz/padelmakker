# Arkiveret migrationshistorik

Disse 150 filer var `supabase/migrations/` indtil 20. september 2026, hvor
historikken blev lagt sammen til én baseline.

## Hvorfor de blev flyttet

Historikken kunne ikke afspilles fra bunden. To grunde:

1. **Halvdelen af skemaet manglede.** 23 af produktionens 42 tabeller — heriblandt
   `profiles`, `matches`, `match_results` og `elo_history` — blev lavet i hånden
   før historikken begyndte 16. april. En frisk database fejlede derfor på
   migration nummer to med `relation "matches" does not exist`.

2. **Selv med skemaet på plads pegede historikken et andet sted hen end
   virkeligheden.** `admin_adjust_elo` returnerer `integer` i produktion, men to
   migrations her erklærer `void`. Afspilning ville altså ende med en *anden*
   database end den der kører — og en gendannelse der ser vellykket ud, men giver
   et forkert resultat, er farligere end ingen gendannelse.

## Hvad der gælder nu

`supabase/migrations/00000000000000_baseline_schema.sql` er den eneste opskrift.
Den er dumpet direkte fra produktionen med `supabase db dump`, så en frisk
database bliver identisk med produktionen **per konstruktion** — ikke fordi
nogen har holdt to ting i sync.

Regenerér den med workflowen `dump-schema-baseline.yml`.

## Hvad filerne her stadig er gode til

At slå op i. Vil du vide *hvornår* og *hvorfor* noget blev indført, står det her.
De køres aldrig igen — hverken på produktion (versionerne er erstattet af
baseline i `supabase_migrations.schema_migrations`) eller på friske databaser
(de ligger uden for `migrations/`).

`supabase/sql/INDEX.md` udpeger for hver funktion hvilken fil der svarer til den
kørende udgave.
