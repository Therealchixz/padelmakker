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

### Supabase dependency

The app requires two environment variables for full functionality:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Without these, the app loads the UI with placeholder Supabase credentials and data operations will fail. The UI itself renders fully without a Supabase connection.

### Key directories

- `src/padelmakker-platform.jsx` — Main application shell and dashboard tabs (still large; helpers split into `src/lib/` and `src/components/EloGraph.jsx`)
- `src/lib/supabase.js` — Supabase client setup
- `src/lib/AuthContext.jsx` — Authentication context provider
- `src/api/base44Client.js` — CRUD entity helpers for Supabase tables
- `src/components/PadelMatchResultInput.tsx` — Match result input component (TypeScript)
