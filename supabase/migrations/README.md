# Supabase migrations (produktion)

Filer her køres **automatisk** på `main` via GitHub Actions (`apply-supabase-migrations.yml`).

## Når du tilføjer database-SQL

1. Skriv SQL i `supabase/sql/<beskrivende_navn>.sql` (reference + manuel kørsel).
2. Opret tilsvarende migration:
   ```bash
   npm run db:migration:new <snake_name>
   ```
   Indsæt SQL i den nye fil under `supabase/migrations/`.
3. **Cloud Agent:** anvend straks i prod med Supabase MCP `apply_migration` (project `hzmrsqrerkoftcppfklu`) — vent ikke på merge.
4. Commit begge filer; ved merge til `main` kører CI `supabase db push` (idempotent for allerede kørte migrationer).

Historiske scripts i `supabase/sql/` uden fil i `migrations/` er **ikke** en del af auto-deploy.
