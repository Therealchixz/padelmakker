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
| `PLAYWRIGHT_TEST_REFRESH_TOKEN` | **Ja i CI** (anbefalet) | Login uden captcha fra GitHub |
| `PLAYWRIGHT_TEST_EMAIL` | Lokalt / fallback | Testbruger email |
| `PLAYWRIGHT_TEST_PASSWORD` | Lokalt / fallback | Testbruger password |

Uden auth-variabler springes logged-in tests over (CI kan stadig være grøn med 14 tests).

### Hvorfor CI fejler med “captcha protection”

Supabase **Captcha protection** blokerer `email+password`-login fra GitHub Actions (det er **ikke** localhost:3000).

**Løsning A (anbefalet):** Tilføj `PLAYWRIGHT_TEST_REFRESH_TOKEN` som GitHub secret:

1. Log ind på [padelmakker.dk](https://www.padelmakker.dk) med testbrugeren i Chrome.
2. F12 → **Application** → **Local Storage** → dit domæne.
3. Find nøglen `sb-<projekt-id>-auth-token`, åbn værdien (JSON).
4. Kopiér feltet **`refresh_token`** (lang streng).
5. GitHub → Settings → Secrets → **New repository secret**  
   Name: `PLAYWRIGHT_TEST_REFRESH_TOKEN`  
   Secret: refresh_token-værdien.

**Løsning B:** Supabase Dashboard → **Authentication** → **Attack Protection** → slå **Captcha protection** fra (kun hvis I accepterer det i prod).

**Opret ikke** secret `PLAYWRIGHT_BASE_URL` med `localhost:3000`.

## Ingen Playwright-wizard-filer

Kør **ikke** `npm init playwright@latest` oven i vores setup. Slet hvis de findes:

- `tests/e2e/auth.setup.ts`, `tests/auth.setup.ts`
- `tests/e2e/example.spec.ts`, `tests/e2e/main.spec.ts`

## GitHub Actions

Secrets til E2E Playwright:

- `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- `PLAYWRIGHT_TEST_EMAIL`, `PLAYWRIGHT_TEST_PASSWORD`
- `PLAYWRIGHT_TEST_REFRESH_TOKEN` (**vigtig for grøn CI med login-tests**)
