# PadelMakker — UI-retningslinjer

Kort reference for visuel konsistens. **UX-flows ændres ikke her** — kun markup, CSS og tokens.

## Lag (brug i denne rækkefølge)

1. **Tokens** — [`src/styles/variables.css`](../src/styles/variables.css) (`--pm-*`)
2. **JS-hjælpere** — [`src/lib/platformTheme.js`](../src/lib/platformTheme.js): `theme`, `btn()`, `inputStyle`, `labelStyle`, `heading()`, `tag()`
3. **CSS-klasser** — [`src/responsive.css`](../src/responsive.css): `pm-ui-card`, `pm-state-card`, …
4. **Delte komponenter** — `AppModal`, `SeekingCallout`, `PageSectionTitle`

## Knapper

| Situation | Brug |
|-----------|------|
| Primær handling (gem, log ind, opret) | `btn(true)` eller `btn(true, { size: 'lg' })` |
| Sekundær (annuller, luk) | `btn(false)` |
| Lille filter-chip / toggle i liste | `className="pm-ui-btn-chip"` (+ `pm-ui-btn-chip-active`) |
| Fuld bredde i formular | `style={{ ...btn(true), width: '100%' }}` |

Undgå håndsat `padding` / `borderRadius` på nye knapper.

## Kort og tilstande

| Situation | Brug |
|-----------|------|
| Standard indholdskort | `pm-ui-card` (+ `pm-ui-card-pad` for padding) |
| Klikbart kort | `pm-ui-card pm-ui-card-interactive` |
| Indlæser | `pm-state-card pm-state-card--loading` + `pm-spinner` |
| Tom liste | `pm-state-card pm-state-card--empty` |
| Fejl + retry | `pm-state-card pm-state-card--error` |
| Advarsel / søger-synlighed | `pm-state-card pm-state-card--warning` eller `SeekingCallout` |

## Modaler

Brug [`AppModal`](../src/components/AppModal.jsx):

```jsx
<AppModal open={open} onClose={onClose} ariaLabel="…" maxWidthPreset="sm">
  <div className="pm-modal-body">…</div>
</AppModal>
```

Presets: `sm` (380px), `md` (520px), `lg` (640px).

**Migrér væk fra:** `position: fixed; inset: 0` + egen panel-div.

## Farver

- **Aldrig** nye hardcodede `#RRGGBB` i JSX/TSX (brug `theme.*` eller `var(--pm-*)`).
- Gul «søger»-accent = `--pm-warning-bg` / `--pm-warm` (se `SeekingCallout`).
- Match-score badges i Find makker: `tag(theme.warmBg, theme.warm)`.

## Typografi

| Niveau | Størrelse | Brug |
|--------|-----------|------|
| Sidetitel | `heading('clamp(20px,4.5vw,24px)')` | Faner |
| Sektionslabel | `PageSectionTitle` eller `.pm-page-section-title` | «Seneste aktivitet» |
| Brødtekst | 13–14px | `theme.textMid` |
| Caption | 11–12px | `theme.textLight` |

## Auth og offentlige sider

- Smal form: wrapper `pm-auth-narrow`
- Panel: `pm-auth-panel` (kort med skygge)
- Inputs: `inputStyle` + `labelStyle`

## Dark mode

Alt nyt UI skal virke med `[data-theme="dark"]` via tokens — test Profil, Hjem og Kampe efter større ændringer.

## Inventar

Se [`docs/UI_INVENTORY.md`](UI_INVENTORY.md) for modal-kandidater og hex-filer under migration.
