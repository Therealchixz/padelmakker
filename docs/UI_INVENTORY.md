# UI-migrationsinventar

Genereret som reference for UI-konsistens. Opdater ved større refactors.

## Modaler → `AppModal`

| Fil | Status |
|-----|--------|
| `src/components/AppModal.jsx` | Kilde |
| `src/dashboard/HomeTab.jsx` | Bruger AppModal |
| `src/dashboard/PlayerProfileModal.jsx` | Migreret |
| `src/dashboard/ResultModal.jsx` | Migreret |
| `src/dashboard/TeamSelectModal.jsx` | Migreret |
| `src/components/ConfirmDialog.jsx` | Egen dialog (behold) |
| `src/dashboard/LigaTab.jsx` | Delvise overlays — evaluer ved behov |

## Hex i JSX (reducer gradvist)

Prioritet (dashboard): `ProfilTab`, `MakkereTab`, `PlayerProfileModal`, `KampeTab`, `RankingTab`, `LigaOpenCard`.

Tilladt i `variables.css` og `responsive.css`. Undgå i `src/**/*.jsx` og `src/**/*.tsx`.

## Tjek nye hex

```bash
npm run check:ui-hex
```
