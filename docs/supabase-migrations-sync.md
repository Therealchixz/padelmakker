# Supabase migration-historik (repo ↔ prod)

Prod (`hzmrsqrerkoftcppfklu`) har mange migrationer kørt via Dashboard/SQL Editor før filer lå i `supabase/migrations/`.

## Synkroniseret (maj 2026)

- `node scripts/sync-remote-migration-stubs.mjs` opretter stub-filer for alle versioner i `schema_migrations` på remote.
- Filer med rigtig SQL beholdes/kopieres (fx `notifications_kampe_entity_focus`, invite-fixes).
- Lokale filer med **forkerte** versionsnumre fjernes (fx `20260521120000_*` → prod bruger `20260520193927_*`).

## Supabase Preview (rød GitHub-check)

**Supabase Preview** kommer fra **Supabase Dashboard → Integrations → GitHub**, ikke fra `apply-supabase-migrations.yml`.

Typiske årsager:

1. **Migrationer i repo som ikke er i prod-historik** (`schema_migrations`) — integrationen prøver at køre dem og fejler (eller timeout). Tjek med:
   ```bash
   SUPABASE_ACCESS_TOKEN=... node scripts/check-migration-drift.mjs --repair-hint
   ```
2. **Fejl i SQL** — åbn Supabase Dashboard → **Manage Branches** → vælg branch → **View logs** for den præcise fejl.
3. **Stub-filer uden SQL** — preview-grene der bygger schema kun fra `migrations/` får ikke tabeller fra tomme stubs; prod er OK fordi schema allerede findes. Løsning: kør `db push` på prod så alle versioner er registreret, eller hydrér stubs fra `supabase/sql/`.

Efter `db push` på prod og grøn **Apply Supabase migrations** bør Preview ofte følge med; hvis ikke, genautoriser GitHub-integrationen i dashboard.

## CI

`apply-supabase-migrations.yml` kører på **hver push til `main`** (`supabase link` + `db push --linked`). Den fejler hvis:

- Remote har versioner der **mangler** lokalt → kør stub-scriptet igen efter nye manuelle migrationer på prod.
- Lokalt har versioner der **ikke** findes på remote → fjern eller kør dem på prod først.
- Remote har MCP/dashboard-versioner uden fil i repo (`Remote migration versions not found in local`) → kør `node scripts/sync-remote-migration-stubs.mjs` eller brug stub-filer `*_mcp_remote_history_sync.sql`.

## Nye ændringer fremover

1. `npm run db:migration:new <navn>`
2. SQL i den nye fil + evt. `supabase/sql/`
3. `apply_migration` via Supabase MCP på prod
4. Commit + push → CI `db push` anvender kun **nye** filer
