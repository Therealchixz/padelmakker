# UI-migrationsinventar

Opdater ved større refactors. Senest: smoke-test OK på prod; hex i JSX er ryddet.

## Modaler → `AppModal`

| Fil | Status |
|-----|--------|
| `src/components/AppModal.jsx` | Kilde |
| `src/dashboard/HomeTab.jsx` | Bruger AppModal |
| `src/dashboard/PlayerProfileModal.jsx` | Migreret |
| `src/dashboard/ResultModal.jsx` | Migreret |
| `src/dashboard/TeamSelectModal.jsx` | Migreret |
| `src/dashboard/InviteToMatchModal.jsx` | Migreret |
| `src/components/PendingResultConfirmModal.jsx` | Migreret |
| `src/components/BanNoticeModal.jsx` | Migreret |
| `src/components/ConfirmDialog.jsx` | Egen dialog (behold) |
| `src/dashboard/LigaTab.jsx` | Delvise overlays — evaluer ved behov |
| `src/dashboard/AdminTab.jsx` | Rediger/slet-spiller via AppModal |
| `src/components/Admin*Editor.jsx` | Admin — lav prioritet |

## Hex i JSX

**Status:** OK (`npm run check:ui-hex`). Undtagelse: `OAuthButtons.jsx` (Google brand).

CI kører med `STRICT=1`. Lokalt: `STRICT=1 npm run check:ui-hex` før PR.

## Næste UI-bølger (valgfrit)

1. ~~**Beskeder**~~ — `pm-besked-*` CSS, `pm-ui-card`, state-kort (færdig)
2. ~~**Baner**~~ — `pm-baner-*` CSS, `pm-help-box`, tids-chips via tokens (færdig)
3. ~~**Admin**~~ — `pm-admin-*` CSS, PillTabs, `pm-ui-card`, AppModal for rediger/slet (færdig)
4. **LigaTab** + admin-resultateditorer → `AppModal` (lav prioritet)
5. **PillTabs** andre steder med gamle `btn()`-filterrækker
