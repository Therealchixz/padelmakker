---
name: PadelMakker
description: Find en makker og spil i aften. Klubhuset om aftenen, på papir, blæk og ler.
colors:
  ink: "#1B1A17"
  ink-raised: "#26241F"
  ink-deep: "#0F0E0C"
  paper: "#F3EEE4"
  surface: "#FBF8F2"
  surface-alt: "#F7F2E9"
  surface-muted: "#EAE3D6"
  border: "#D9D1C2"
  text-mid: "#4A463E"
  text-light: "#6B655A"
  clay: "#C8553D"
  accent-solid: "#C0503A"
  accent: "#A8432D"
  accent-bg: "#F6E4DC"
  on-accent: "#FFFFFF"
  ball: "#E9B44C"
  court: "#2F5D4E"
  court-bg: "#E2EBE5"
  danger: "#DC2626"
typography:
  display:
    fontFamily: "Anton, 'Arial Narrow', Impact, sans-serif"
    fontSize: "clamp(56px, 19vw, 96px)"
    fontWeight: 400
    lineHeight: 0.9
    letterSpacing: "0.005em"
  headline:
    fontFamily: "Anton, 'Arial Narrow', Impact, sans-serif"
    fontSize: "clamp(34px, 9vw, 64px)"
    fontWeight: 400
    lineHeight: 0.92
    letterSpacing: "0.005em"
  number:
    fontFamily: "Anton, 'Arial Narrow', Impact, sans-serif"
    fontSize: "30px"
    fontWeight: 400
    lineHeight: 1
    letterSpacing: "0.005em"
    fontFeature: "tnum"
  title:
    fontFamily: "'Instrument Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif"
    fontSize: "22px"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  section:
    fontFamily: "'Instrument Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif"
    fontSize: "17px"
    fontWeight: 700
    letterSpacing: "-0.01em"
  body:
    fontFamily: "'Instrument Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.4
  label:
    fontFamily: "'Instrument Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif"
    fontSize: "12px"
    fontWeight: 600
    letterSpacing: "0.01em"
  data:
    fontFamily: "'IBM Plex Mono', ui-monospace, 'SFMono-Regular', Menlo, monospace"
    fontSize: "12px"
    fontWeight: 500
    fontFeature: "tnum"
rounded:
  sm: "8px"
  md: "10px"
  control: "12px"
  lg: "16px"
  xl: "18px"
  sheet: "24px"
  pill: "999px"
spacing:
  space-1: "8px"
  space-2: "12px"
  space-3: "16px"
  space-4: "20px"
  control-h: "44px"
components:
  button-primary:
    backgroundColor: "{colors.accent-solid}"
    textColor: "{colors.on-accent}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "10px 16px"
    height: "44px"
  button-primary-hover:
    backgroundColor: "{colors.accent}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "10px 16px"
    height: "44px"
  button-landing-cta:
    backgroundColor: "{colors.accent-solid}"
    textColor: "{colors.on-accent}"
    rounded: "{rounded.lg}"
    padding: "18px 20px"
    height: "60px"
  button-spil:
    backgroundColor: "{colors.accent-solid}"
    textColor: "{colors.on-accent}"
    typography: "{typography.number}"
    rounded: "{rounded.pill}"
    size: "68px"
  chip:
    backgroundColor: "{colors.surface-alt}"
    textColor: "{colors.text-mid}"
    rounded: "{rounded.pill}"
    padding: "3px 10px"
  chip-active:
    backgroundColor: "{colors.accent-solid}"
    textColor: "{colors.on-accent}"
  segmented-control:
    backgroundColor: "{colors.surface-muted}"
    rounded: "{rounded.control}"
    padding: "3px"
  segmented-control-active:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "9px"
  card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.lg}"
    padding: "12px 14px"
  card-ink:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    rounded: "{rounded.lg}"
    padding: "14px"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "10px 14px"
    height: "44px"
---

# Design System: PadelMakker

## Overview

**Creative North Star: "Klubhuset om aftenen"**

PadelMakker ligner et padel-klubhus, når lyset tændes over banen: varmt papir, sort blæk og den røde lerfarve fra banekanten. Ejeren valgte retningen 4. nov. 2026 (Claude Design-prototypen "PadelMakker Prototype v4"), og den bygges i trin; dele af appen bærer stadig den ældre stil under v4-laget.

To registre deler samme materialer. De offentlige sider (forside, Om, FAQ, ELO, Events) taler højt: forsiden står altid på blæk, med det rigtige banefoto i fuld bredde og store Anton-versaler. Appen efter login er roligere: papirflader, Instrument Sans, tynde linjer mellem rækker og lerfarve kun der, hvor man skal trykke. Tal er altid rigtige; eksempeldata mærkes "Eksempel".

Appen skal føles som en app på telefonen: 44 px trykflader, øjeblikkelig trykrespons (skalering ved `:active`), hover kun med mus, og bevægelse der står stille ved "reducér bevægelse".

**Key Characteristics:**
- Papir, blæk og ler i stedet for navy; én klar handlingsfarve.
- Anton-versaler til det, man skal se på afstand: offentlige overskrifter, store tal, navne.
- IBM Plex Mono kun til data: tider, antal, niveauer, sidetal.
- Rækker med hårfine linjer frem for kort i kort.
- Lys og mørk tilstand via `[data-theme="dark"]`; forsiden er altid mørk.

## Colors

En varm, næsten monokrom base af papir og blæk, hvor lerfarven bærer al handling og boldgul kun signalerer, at noget er live.

### Primary
- **Ler, udfyldt** (`accent-solid`): fyld bag hvid tekst: primærknapper, Spil-knappen, tællere, aktive chips, trin-numre. Hvid tekst giver 4,7:1. Samme værdi i mørk tilstand.
- **Ler, tekst** (`accent`): links, ikoner i genveje, fokusring og aktive værdier. Bliver lysere i mørk tilstand (`#E8836B`), så den kan læses på mørke kort.
- **Banekant-ler** (`clay`): accent-ord og handling på forsidens blæk (fx tredje linje i forsidens overskrift).
- **Ler-skær** (`accent-bg`): rolig baggrund bag ler-tekst.

### Secondary
- **Boldgul** (`ball`): kun live-signaler på blæk: "live"-prikken og tallinjen på forsiden, statistik på det omvendte profilkort. Fokusringen på forsiden er også boldgul.

### Tertiary
- **Banegrøn** (`court`, `court-bg`): succes og "stærkt match"; i mørk tilstand `#7FBFA4` på `#14261F`.

### Neutral
- **Blæk** (`ink`): brødtekst i lys tilstand, forsidens grund, omvendte kort (invitationer, profilkort på Mere, ranglistens placering).
- **Hævet blæk** (`ink-raised`) og **dyb blæk** (`ink-deep`): flader oven på blæk; ranglisten i mørk tilstand.
- **Papir** (`paper`): sidebaggrund (`--pm-bg`) i lys tilstand og tekst på blæk.
- **Kort-papir** (`surface`), **lyst papir** (`surface-alt`), **dæmpet papir** (`surface-muted`): kort og felter, hover på rækker, bunden i delte vælgere.
- **Hårlinje** (`border`): kanter og linjer mellem rækker. På forsiden er linjerne papir ved 14 % gennemsigtighed.
- **Mellemtekst** (`text-mid`) og **lys tekst** (`text-light`): sekundær tekst og pladsholdere; begge holder 4,5:1 på alle overflader.
- Mørk tilstand: baggrund `#141311`, kort `#1F1D19`, tekst `#F3EEE4`, kanter `#3A362F`.

### Named Rules
**Reglen om to slags ler.** Udfyldte flader med hvid tekst bruger `--pm-accent-solid`; tekst, ikoner og kanter bruger `--pm-accent`. Byt dem aldrig: den lyse mørk-tilstands-accent giver kun 2,5:1 under hvid tekst.

**Reglen om ingen hex i JSX.** Farver i JSX/TSX skrives som `var(--pm-*)` eller `theme.*`. `scripts/check-ui-hex.mjs` fejler bygget (`STRICT=1`); eneste undtagelse er steder uden CSS-variabler (Leaflet, brand-SVG) med en begrundet `// ui-hex-allow`.

**Reglen om rød til fejl.** Tællere og ulæst-mærker er ler. Rød (`danger`) er forbeholdt fejl og advarsler.

**Reglen om én betydning pr. farve (6. nov. 2026).** Ler betyder "tryk her" (knapper, Spil, aktiv fane, ulæst). Grøn betyder vundet eller plus. Et tab er ikke en fejl: "Tabt", minus-ELO og tabende hold står i neutralt blæk på `surface-muted` (`--pm-loss`, `--pm-loss-bg`), aldrig i rød eller ler. Resultater (sæt-score) står i blæk, ikke ler. Holdene i kampkort er neutrale; kun vinderholdet får en grøn tone.

**Farvekortet for hele appen (gennemgået 6. nov. 2026).**

| Farve | Betyder | Eksempler |
|---|---|---|
| Ler (`accent`, `accent-solid`) | Tryk her | Knapper, links, valgt/aktiv tilstand, kontakter, ulæst-tællere og -prikker |
| Grøn (`green`) | Godt / åbent | Vundet, plus-ELO, ledige pladser, aktiv søgning, optjente mærker, afsluttet runde |
| Okker (`amber`, `warm`) | Afventer | Venter på bekræftelse, udløbet, blokeret tid. Gul-brun, så den ikke ligner ler |
| Rød (`danger`, `red`) | Fejl / farligt | Fejlbeskeder, slet- og forlad-knapper, admin-advarsler, påkrævet felt |
| Blæk og papir (`text`, `surface-muted`) | Data og alt andet | Tal, ELO, point, score, grafer, "dig"-rækker, tabt, fuld, neutrale mærker og ikonfelter |

Blå og lilla er udfaset i appen (undtagen "din placering"-prikken på kortet). Data og pynt får aldrig ler.

## Typography

**Display Font:** Anton (med 'Arial Narrow', Impact)
**Body Font:** Instrument Sans (med -apple-system, Segoe UI, Arial)
**Label/Mono Font:** IBM Plex Mono (med ui-monospace, Menlo)

**Character:** En smal, råbende plakatskrift over en venlig, moderne grotesk; mono'en giver tal og tider resultattavlens præcision.

### Hierarchy
- **Display** (Anton 400, clamp(56px, 19vw, 96px), 0.9, versaler): forsidens hovedoverskrift, linje for linje.
- **Headline** (Anton 400, clamp(34px, 9vw, 64px), 0.92, versaler): sektionsoverskrifter på offentlige sider; ark-titler i appen (Spil-valget 30px).
- **Number** (Anton 400, 22–30px, 1, faste cifferbredder): ELO, placering, datoer i kampkort, tider på Hjem. Navne på profilkort (26px, versaler).
- **Title** (Instrument Sans 700, 22px, 1.2, -0.02em): sidetitlen i den fælles toplinje.
- **Section** (Instrument Sans 700, 17px, -0.01em): sektionsoverskrifter i appen, almindelig skrivemåde.
- **Body** (Instrument Sans 400, 13–15px, ca. 1.4): tekst og rækker; prosa på offentlige sider holdes på 60ch.
- **Label** (Instrument Sans 600, 12px): feltetiketter og grupperubrikker (13px/700 på Mere).
- **Data** (IBM Plex Mono 500, 10–12px, faste cifferbredder): tider, antal, niveauer, tællere.

### Named Rules
**Anton-reglen.** Anton findes i én vægt (400) og sættes altid med versaler og `font-synthesis: none`. Den bruges kun til offentlige overskrifter (under `.pm-brand`), store tal og navne; aldrig til brødtekst, knapper eller almindelige app-overskrifter.

**Mono-reglen.** IBM Plex Mono er kun til data. Hvis teksten ikke er et tal, en tid eller et niveau, er den Instrument Sans.

## Layout

Mobil først, med ét skift ved 768/769px. På telefonen fylder indholdet bredden med 16–18px margen; under det sidder bundmenuen Hjem · Kampe · Spil · Makkere · Mere med den runde Spil-knap i midten. Fra 769px bliver Spil en pille i fanebåndet, og genvejsgitteret på Mere går fra 3 til 6 kolonner. Forsiden bruger en indholdsbredde på 1180px og en margen på clamp(20px, 5vw, 48px), med skift ved 720px og 960px.

Rytmen er 8 / 12 / 16 / 20px (`space-1`–`space-4`). Alle trykflader er mindst 44px høje (`--pm-control-h`); tætte chips må være 40px men får en usynlig 44×44 trykflade (`.pm-hit-44`). Rækker i lister er 52–60px. Felter bruger 16px tekst på berøringsskærme, så iPhone ikke zoomer.

Hver hovedside i appen åbner med den fælles toplinje (`ScreenHeader`): titlen som `<h1>` til venstre, sidens egne knapper til højre og på mobil notifikationsklokken yderst.

## Elevation & Depth

Næsten fladt. Dybde kommer af tone (papir mod kort-papir mod dæmpet papir, og omvendte blæk-kort) og af hårfine linjer, ikke af skygger. v4-kort har ingen skygge i hvile; skyggerne er bløde, varmtonede og små.

### Shadow Vocabulary
- **Valgt segment** (`box-shadow: 0 1px 3px rgba(27, 26, 23, 0.12)`): det aktive felt i en delt vælger.
- **Primærknap** (`--pm-shadow-btn`): en lerfarvet antydning under udfyldte knapper.
- **Spil-knappen** (`box-shadow: 0 6px 16px color-mix(in srgb, var(--pm-accent-solid) 35%, transparent)`): eneste svævende element i menuen.
- **Menu og modal** (`--pm-menu-shadow`, `--pm-modal-shadow`): lag over siden.
- **Forsidens CTA og telefonbilleder** (`0 10px 30px rgba(0,0,0,0.28)`, `0 24px 60px rgba(0,0,0,0.45)`): kun på blæk.

### Named Rules
**Reglen om ingen løft.** Hover ændrer farve eller kant, aldrig position: ingen `translateY` ved hover. Tryk giver en lille skalering (0.94–0.98) på 120ms.

## Shapes

Venlige, faste hjørner: 10px på knapper og felter, 12px på mindre knapper og delte vælgere (aktive segmenter 9px), 14–18px på fliser, kort og formularpaneler, 24px på ark og forsidens telefonbilleder. Chips, tags, ELO-pillen og forsidens "Log ind" er fulde piller. Avatarer, chatknap og Spil-knappen er cirkler. Lister bærer en 1,5px blæk-linje øverst og 1px hårlinjer mellem rækker; sekundære knapper i v4 er 1,5px blæk-omrids.

## Components

### Buttons
- **Shape:** let afrundet (10px); forsidens store CTA 16px; kampkortenes knapper 12px.
- **Primary:** `accent-solid` med hvid tekst, Instrument Sans 700 14px, 10px 16px, mindst 44px (`btn(true)`). Forsidens CTA er fuld bredde, 60px høj, 17px.
- **Hover / Focus:** hover kun under `(hover: hover) and (pointer: fine)`: ler bliver mørkere (`#A8432D` eller `color-mix` med 14 % sort). Fokus er en 2px outline i `accent` med 2px afstand; på forsiden boldgul med 3px afstand. Deaktiveret: 55 % gennemsigtighed.
- **Secondary:** kort-papir med hårlinje (`btn(false)`), eller i v4 gennemsigtig med 1,5px blæk-omrids. På blæk-kort: papir-knap og gennemsigtig knap med papirkant.

### Chips
- **Style:** pille, `surface-alt` med hårlinje og `text-mid`, 10–11px 700/600.
- **State:** aktiv chip er udfyldt `accent-solid` med hvid tekst.

### Cards / Containers
- **Corner Style:** 16px (fliser 14px, paneler 18px).
- **Background:** `surface` med 1px `border`; vigtige kort er omvendte (blæk med papirtekst i lys tilstand).
- **Shadow Strategy:** ingen i v4 (se Elevation & Depth).
- **Internal Padding:** 12–14px.

### Inputs / Fields
- **Style:** `surface`, 1px `border`, 10px hjørner, 14px tekst, 44px høje.
- **Focus:** kanten bliver `accent` med en 3px lerfarvet ring (`--pm-focus-ring`).

### Navigation
- **Toplinje:** `ScreenHeader`, 22px titel, mindst 48px høj.
- **Faner:** `PillTabs` som delt vælger: dæmpet papir-bund, aktivt segment er kort-papir med blæk-tekst og en lille skygge; i mørk tilstand papir ved 16 %.
- **Bundmenu (mobil):** fem kolonner med 84px midte til Spil-knappen; aktiv fane har blæk-tekst og en lerfarvet streg; tællere i ler; baggrund papir ved 94 %.
- **Ikoner:** lucide-react overalt, 18–22px; aldrig unicode-tegn som ikoner.

### Spil-knappen og Spil-valget
Den eneste store handling i appen: en 68px lerfarvet cirkel med "SPIL" i Anton, løftet 30px op over menuen med en 5px papirkant. Den åbner et ark, der glider op nedefra (260ms, `cubic-bezier(0.2, 0.8, 0.2, 1)`) med tre valg: 2v2, Americano/Mexicano, Liga. Hvert valg er en 72px række med et 44px lerfarvet ikonfelt.

## Do's and Don'ts

### Do:
- **Do** brug `--pm-accent-solid` bag hvid tekst og `--pm-accent` til tekst og links.
- **Do** sæt Anton med versaler, vægt 400 og `font-synthesis: none`, kun til offentlige overskrifter, store tal og navne.
- **Do** brug IBM Plex Mono med faste cifferbredder til tider, antal og niveauer.
- **Do** læg al hover i `@media (hover: hover) and (pointer: fine)` og giv tryk en `:active`-skalering.
- **Do** gør alle trykflader mindst 44px (`--pm-control-h`, `.pm-hit-44`).
- **Do** stop animationer og overgange under `prefers-reduced-motion: reduce`.
- **Do** brug den fælles toplinje (`ScreenHeader`) på appens hovedsider.
- **Do** test nyt UI i både lys og mørk tilstand (`[data-theme="dark"]`).

### Don't:
- **Don't** skriv hex-farver i JSX/TSX; brug `var(--pm-*)` eller `theme.*`.
- **Don't** brug navy; den gamle `--pm-navy` peger nu på blæk.
- **Don't** løft elementer ved hover (`translateY`) eller lad hover virke på berøringsskærme.
- **Don't** brug unicode-tegn eller emoji som ikoner; brug lucide-react.
- **Don't** brug rød til tællere; rød er til fejl.
- **Don't** vis opdigtede tal eller navne på offentlige sider; eksempeldata mærkes "Eksempel".
- **Don't** skift farver, skrift eller billeder uden at spørge ejeren.
