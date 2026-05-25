# E2E (Playwright)

## Kør lokalt

```bash
npm run test:e2e
```

## Offentlige tests

`smoke.spec.ts` og `auth.spec.ts` kører uden login (14 tests).

## Logget-ind tests

`logged-in.spec.ts` kræver en **færdig testbruger** (onboarding færdig, kan åbne dashboard på padelmakker.dk).

### Miljøvariabler

| Variabel | Påkrævet | Formål |
|----------|----------|--------|
| `VITE_SUPABASE_URL` | Ja | Supabase projekt-URL |
| `VITE_SUPABASE_ANON_KEY` | Ja | anon public key |
| `PLAYWRIGHT_TEST_SERVICE_ROLE_KEY` | **Anbefalet i CI** | Login via admin magic link — ingen captcha, ingen token-rotation |
| `PLAYWRIGHT_TEST_EMAIL` | Ja (med service role / password) | Testbruger email |
| `PLAYWRIGHT_TEST_REFRESH_TOKEN` | CI fallback | Login uden captcha (udløber ved logout/rotation) |
| `PLAYWRIGHT_TEST_PASSWORD` | Lokalt / fallback | Testbruger password |

Uden auth-variabler springes logged-in tests over (CI kan stadig være grøn med 14 tests).

### Auth-rækkefølge i CI

1. **Service role + email** (hvis `PLAYWRIGHT_TEST_SERVICE_ROLE_KEY` er sat) — mest stabil
2. **Refresh token** — falder tilbage til password hvis token er udløbet
3. **Email + password** — lokalt; blokeres ofte i CI af Supabase captcha

### Fejl: "Invalid Refresh Token: Refresh Token Not Found"

Refresh token i GitHub secret er **udløbet eller tilbagekaldt** (fx efter logout eller ny login).

**Løsning A (anbefalet, engangsopsætning):** Tilføj service role som GitHub secret:

1. Supabase Dashboard → **Project Settings** → **API** → kopiér **service_role** (secret).
2. GitHub → Settings → Secrets → **New repository secret**  
   Name: `PLAYWRIGHT_TEST_SERVICE_ROLE_KEY`  
   Secret: service_role-nøglen.
3. Sørg for at `PLAYWRIGHT_TEST_EMAIL` også er sat (samme testbruger).

**Løsning B:** Forny refresh token:

```bash
# Sæt VITE_SUPABASE_* og PLAYWRIGHT_TEST_EMAIL/PASSWORD lokalt
npm run e2e:refresh-token
```

Kopiér output til GitHub secret `PLAYWRIGHT_TEST_REFRESH_TOKEN`.

**Løsning C:** Supabase Dashboard → **Authentication** → **Attack Protection** → slå **Captcha protection** fra (mindre sikkert).

### Hvorfor CI fejler med “captcha protection”

Supabase **Captcha protection** blokerer `email+password`-login fra GitHub Actions.

Brug **Løsning A** (service role) eller **Løsning B** (refresh token).

**Opret ikke** secret `PLAYWRIGHT_BASE_URL` med `localhost:3000`.

## Ingen Playwright-wizard-filer

Kør **ikke** `npm init playwright@latest` oven i vores setup. Slet hvis de findes:

- `tests/e2e/auth.setup.ts`, `tests/auth.setup.ts`
- `tests/e2e/example.spec.ts`, `tests/e2e/main.spec.ts`

## GitHub Actions

Secrets til E2E Playwright:

- `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- `PLAYWRIGHT_TEST_EMAIL`, `PLAYWRIGHT_TEST_PASSWORD`
- `PLAYWRIGHT_TEST_SERVICE_ROLE_KEY` (**anbefalet** — stabil CI)
- `PLAYWRIGHT_TEST_REFRESH_TOKEN` (fallback)
