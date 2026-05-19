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

No test framework is configured (no Jest, Vitest, or similar).

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
