# AGENTS.md

## Cursor Cloud specific instructions

### Project overview

PadelMakker is a Danish padel sports PWA (React + Vite + Tailwind CSS) that uses Supabase as its backend (auth, database, API). It is deployed on Vercel.

### Running the dev server

```bash
npm run dev
```

The dev server starts on `http://localhost:5173/` by default. Use `--host 0.0.0.0` to expose on all interfaces.

### Building

```bash
npm run build
```

### Linting & type-checking

- **ESLint** (flat config: `eslint.config.js`): `npm run lint` — includes `eslint-plugin-react` and `eslint-plugin-react-hooks`. JavaScript and TypeScript under the repo are linted; `dist/` and `node_modules/` are ignored.
- **TypeScript**: `tsconfig.json` has `checkJs: false` and `noEmit: true`; use `npm run typecheck` (`tsc --noEmit`) for `.ts`/`.tsx` only.

Prettier is not configured.

### Testing

- **Unit tests:** `npm run test:unit`
- **Notification/RPC drift audit:** `npm run audit:notifications` (fails on high-severity static findings, e.g. legacy SQL overloads in `supabase/sql/`)
- **E2E (Playwright):** `npm run test:e2e` — public flows always; logged-in dashboard tests when `VITE_SUPABASE_*` + `PLAYWRIGHT_TEST_EMAIL`/`PASSWORD` are set (see `tests/e2e/README.md`)
- **Pre-release bundle:** `npm run test:release` (lint, typecheck, unit, audit, build, e2e)

CI runs lint, typecheck, unit, `audit:notifications`, and `build` on every PR. E2E runs in a separate workflow; add GitHub secrets for authenticated E2E.

No Jest/Vitest beyond Node’s built-in test runner.

### Phone SMS verification (Twilio)

New signups require a **verified phone number** (SMS OTP via Supabase Auth).

1. Enable **Phone** under **Authentication → Providers**.
2. Configure **Twilio** in Phone settings **or** deploy `supabase/functions/send-auth-sms` and wire the **Send SMS** auth hook (see `supabase/sql/phone_sms_twilio_setup.md`).
3. Edge function secrets: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_MESSAGING_SERVICE_SID` (or `TWILIO_PHONE_NUMBER`), `SEND_SMS_HOOK_SECRET`.

Flow: `/opret` → `/opret/bekraeft-telefon` (SMS) → `/opret/bekraeft-email` → login → dashboard.

### Google login (OAuth)

Enable **Google** in Supabase Dashboard → **Authentication** → **Providers**.

Under **Authentication** → **URL configuration**, add redirect URLs:

- `http://localhost:5173/login` and `http://localhost:5173/opret` (local dev)
- `https://<your-production-domain>/login` and `https://<your-production-domain>/opret`

The app uses `signInWithOAuth` with PKCE; no extra env vars beyond `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.

### Supabase SQL og deploy (obligatorisk for agents)

**Når du tilføjer eller ændrer produktions-SQL** (`supabase/sql/` eller RPC/schema):

1. **Kør det med det samme** via Supabase MCP `apply_migration` på project `hzmrsqrerkoftcppfklu` (ikke vent på brugeren).
2. **Slå den registrerede version op** — `apply_migration` sætter sit *eget* tidsstempel:
   `select version, name from supabase_migrations.schema_migrations order by version desc limit 1;`
3. **Tilføj migrationsfilen med præcis den version**: `supabase/migrations/<version>_<name>.sql`.
   Brug **ikke** `npm run db:migration:new` efter et MCP-kald — det sætter et nyt tidsstempel, og så matcher fil og database aldrig.
4. **Verificer** at intet er i drift begge veje:
   `select count(*) from supabase_migrations.schema_migrations;` skal matche `ls supabase/migrations/*.sql | wc -l`.
5. **Commit + push** begge (`supabase/sql/` + `supabase/migrations/`).
6. **Opdatér SQL-indekset**: `npm run db:sql-index` (CI fejler ellers).

> **Hvad kører egentlig i produktionen?** `supabase/sql/` er et arkiv, ikke en
> sandhed: 56 af 137 funktioner er defineret i flere filer dér, én i syv.
> `supabase/migrations/` er det `supabase db push` udfører, så den SIDSTE
> migration der definerer en funktion, er den der kører.
> [`supabase/sql/INDEX.md`](supabase/sql/INDEX.md) udpeger for hver funktion den
> gældende migration og den arkivfil der er identisk med den. Slå op dér frem for
> at læse filer i `supabase/sql/` på må og få.
>
> **Historikken er ufuldstændig** (se INDEX.md): 49 funktioner kører i produktion
> uden nogen migration, og 6 kernetabeller — `matches`, `match_players`,
> `profiles`, `messages`, `courts`, `americano_tournaments` — ændres af
> migrations uden nogensinde at blive oprettet af en. De blev lavet i hånden før
> historikken begyndte.
>
> Konsekvensen er bevist, ikke formodet: Supabase' preview-branch på PR #365
> fejlede med `relation "matches" does not exist` på den anden migration.
> **Produktionen er ikke berørt** — den har tabellerne, og `db push` tilføjer kun
> nye migrations — men et nyt miljø (staging, gendannelse) kan ikke bygges fra
> historikken, og preview-branches fejler.
>
> Rør de usporede objekter varsomt: ændrer du et af dem, så lav en migration, så
> det ikke forbliver usporet.

> **Hvorfor det er vigtigt.** `supabase db push` afviser at køre, hvis databasen kender en version
> der ikke har en lokal fil — og en lokal fil uden en registreret version bliver *anvendt på
> produktion* ved næste push. Begge dele opstår, når SQL køres via MCP og filen bagefter navngives
> med et nyt tidsstempel. Det brækkede `apply-supabase-migrations.yml` fra 27. august til
> 19. september uden at nogen opdagede det, fordi workflowet fejler tavst i baggrunden.
> Ryddet op i 20260918234636-serien; se `scripts/check-migration-drift.mjs`.

**Rækkefølge når en migration fjerner adgang** (fx `REVOKE` på en kolonne): deploy frontend
**først**, så den ikke længere beder om feltet, og kør migrationen bagefter. Omvendt rækkefølge
får hver forespørgsel til at fejle med `permission denied for column`, mens den gamle app stadig
kører hos brugerne.

Ved merge til `main` kører GitHub Actions automatisk:

- `apply-supabase-migrations.yml` → `supabase db push` (nye migrations)
- `deploy-supabase-functions.yml` → edge functions
- Vercel → frontend (GitHub-integration; ingen ekstra step)

**Afslut PRs:** Efter grøn CI merges `auto-merge-cursor-prs.yml` PRs fra `cursor/*` til `main`. Sæt PR til **ready for review** (ikke draft). Eller tilføj label `auto-merge` på andre branches.

Krav i GitHub repo: secret `SUPABASE_ACCESS_TOKEN` (samme som edge-function deploy).

### Supabase dependency

The app requires two environment variables for full functionality:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Without these, the app loads the UI with placeholder Supabase credentials and data operations will fail. The UI itself renders fully without a Supabase connection.

### Key directories

- `src/padelmakker-platform.jsx` — App shell: auth loading, toast, routes
- `src/pages/` — Forside (`LandingPage`), login, onboarding, reset password
- `src/dashboard/` — Dashboard layout + faner (`HomeTab`, `KampeTab`, `ProfilTab`, …) og delte modaler
- `src/lib/` — Supabase, tema, ELO-hjælpere, notifikations-RPC, m.m.
- `src/components/EloGraph.jsx` — ELO-graf på profil
- `src/lib/supabase.js` — Supabase client setup
- `src/lib/AuthContext.jsx` — Authentication context provider
- `src/api/base44Client.js` — CRUD entity helpers for Supabase tables
- `src/components/PadelMatchResultInput.tsx` — Match result input component (TypeScript)
