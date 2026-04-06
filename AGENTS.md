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

No ESLint or Prettier is configured. TypeScript is present (`tsconfig.json`) with `checkJs: false` and `noEmit: true`, so `npx tsc --noEmit` can be used for type-checking `.ts`/`.tsx` files only.

### Testing

No test framework is configured (no Jest, Vitest, or similar).

### Supabase dependency

The app requires two environment variables for full functionality:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Without these, the app loads the UI with placeholder Supabase credentials and data operations will fail. The UI itself renders fully without a Supabase connection.

### Key directories

- `src/padelmakker-platform.jsx` — Main application component (large single-file component)
- `src/lib/supabase.js` — Supabase client setup
- `src/lib/AuthContext.jsx` — Authentication context provider
- `src/api/base44Client.js` — CRUD entity helpers for Supabase tables
- `src/components/PadelMatchResultInput.tsx` — Match result input component (TypeScript)

### Git: ny kode → ny PR

Ved hver ny kodeændring: **ny branch fra opdateret `main`**, commit, push til `origin`, og **opret en ny pull request** mod `main`. Genbrug ikke en branch/PR der allerede er merged (GitHub tillader ikke at pushe til den samme merge igen). Hvis push fejler lokalt: `git pull origin main`, ny branch, og flyt ændringerne dertil (eller bed agenten om en ny PR).
