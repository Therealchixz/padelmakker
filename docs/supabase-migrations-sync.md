# Supabase migration-historik (repo ↔ prod)

Prod (`hzmrsqrerkoftcppfklu`) har mange migrationer kørt via Dashboard/SQL Editor før filer lå i `supabase/migrations/`.

## Synkroniseret (maj 2026)

- `node scripts/sync-remote-migration-stubs.mjs` opretter stub-filer for alle versioner i `schema_migrations` på remote.
- Filer med rigtig SQL beholdes/kopieres (fx `notifications_kampe_entity_focus`, invite-fixes).
- Lokale filer med **forkerte** versionsnumre fjernes (fx `20260521120000_*` → prod bruger `20260520193927_*`).

## CI

`apply-supabase-migrations.yml` kører `supabase link` + `db push --linked`. Den fejler hvis:

- Remote har versioner der **mangler** lokalt → kør stub-scriptet igen efter nye manuelle migrationer på prod.
- Lokalt har versioner der **ikke** findes på remote → fjern eller kør dem på prod først.

## Nye ændringer fremover

1. `npm run db:migration:new <navn>`
2. SQL i den nye fil + evt. `supabase/sql/`
3. `apply_migration` via Supabase MCP på prod
4. Commit + push → CI `db push` anvender kun **nye** filer
