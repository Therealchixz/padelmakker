# E2E (Playwright)

## Kør lokalt

```bash
npm run test:e2e
```

## Offentlige tests

`smoke.spec.ts` og `auth.spec.ts` kører uden login.

## Logget-ind tests

`logged-in.spec.ts` kræver en **færdig testbruger** (email bekræftet, telefon/undtagelse ok, onboarding færdig).

Sæt i `.env.local` eller miljø:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `PLAYWRIGHT_TEST_EMAIL`
- `PLAYWRIGHT_TEST_PASSWORD`

Uden disse variabler springes logged-in tests over (CI kan stadig være grøn).

**Opret ikke** secret `PLAYWRIGHT_BASE_URL` med `localhost:3000` — så starter CI ikke Vite, og du får `ERR_CONNECTION_REFUSED`. Brug kun de fire secrets ovenfor.

## GitHub Actions

Tilføj repo-secrets med samme navne, så E2E også tester dashboard efter login.
