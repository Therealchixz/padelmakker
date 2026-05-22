# Baner — oversigt og udvidelse

PadelMakker **Book bane** viser ledige tider, når centrets kalender er **offentlig** (uden PadelMakker-login). Booking sker altid hos udbyderen.

## Integrationstyper

| Type | Ledige tider i app | Klik på ledig tid | Konfiguration |
|------|-------------------|-------------------|---------------|
| `halbooking` | Ja | Halbooking (bane + tid) | `padelmakker-server/halbookingVenuesAllowlist.js` + `src/lib/banerVenues.js` |
| `matchi` | Ja | MATCHi med dato | `padelmakker-server/matchiAllowlist.js` + `banerVenues.js` |
| `bookli` | Ja | Bookli | `padelmakker-server/bookliAllowlist.js` + `banerVenues.js` |
| `link` | Nej | Ekstern klubside | Kun `banerVenues.js` |

## Regioner i appen

Centre grupperes under overskrifter defineret i `BANER_REGION_ORDER` i `src/lib/banerVenues.js`:

- Nordjylland, Østjylland, Midtjylland, Fyn, Sønderjylland (sydjylland), Sjælland, Hovedstaden, Bornholm

**Bemærk:** Odense og Vissenbjerg ligger på **Fyn**, ikke Sønderjylland. «Syddanmark» bruges ikke som regionnavn i appen.

Nye centre skal have `region` sat til én af disse (eller de vises under «Øvrige» til sidst).

## Centre i produktion (2026)

### Nordjylland

| Titel | Type | id |
|-------|------|-----|
| Skansen Padel | halbooking | `skansen_ntsc` |
| Padel Lounge Aalborg | halbooking | `padel_lounge_aalborg` |
| Match Padel Aalborg | halbooking | `match_padel_aalborg` (område 5) |
| PadelPadel Aalborg | bookli | `padelpadel_aalborg` |
| HimmerLand padel | halbooking | `himmerland_halbooking` |
| Sportshallen Frederikshavn | halbooking | `sportshallen_frederikshavn_halbooking` |
| Match Padel Lemvig | halbooking | `match_padel_lemvig` (område 8) |
| Match Padel Hobro | halbooking | `match_padel_hobro` (område 11) |
| Padel Nord | matchi | `matchi_padelnord` (facility 2445) |
| Padel99 | matchi | `matchi_padel99` |
| Skagen Padelcenter | matchi | `matchi_skagen_padelcenter` |
| Aars Tennis & Padel | link | `aarstennisklub_booking` |
| Gug Tennis & Padel | link | `gug_tennis_padel_booking` |

### Østjylland

| Titel | Type | id |
|-------|------|-----|
| Padel8500 | matchi | `matchi_padel8500` (facility 2229) |

### Midtjylland

| Titel | Type | id |
|-------|------|-----|
| Match Padel Aarhus | halbooking | `match_padel_aarhus` (område 1) |
| Padel Land | matchi | `matchi_padelland` (2072) |
| ViPadel Aarhus | matchi | `matchi_vipadelaarhus` (1062) |
| Match Padel Silkeborg | halbooking | `match_padel_silkeborg` (område 19) |

### Fyn

| Titel | Type | id |
|-------|------|-----|
| Match Padel Odense | halbooking | `match_padel_odense` (område 14) |
| Vissenbjerg Padel | matchi | `matchi_vissenbjerg_padel` (3112) |

### Sønderjylland (sydjylland)

| Titel | Type | id |
|-------|------|-----|
| Breintholtgård Padel, Esbjerg | matchi | `matchi_breintholt_esbjerg` (2232) |
| K7 Padel, Løsning | matchi | `matchi_k7_padel_losning` (2650) |

**Kandidater** (ikke Halbooking/MATCHi i appen endnu): EGIF Esbjerg (`egif.halbooking.dk`), Rocket Padel Kolding, Bel Air PadelCourt Esbjerg.

## Tilføj nyt Halbooking-center

1. Åbn `https://<klub>.halbooking.dk/newlook/proc_baner.asp` i browser — kalender skal vises uden login.
2. Find `soeg_omraede` i HTML (dropdown for padel-område) — se `scripts/probe-match-padel-omraede.mjs` for Match Padel.
3. Tilføj i `halbookingVenuesAllowlist.js`: `procBaner` + `omraede`.
4. Tilføj post i `BANER_VENUES` med `kind: 'halbooking'`, `region`, adresse.

## Tilføj nyt MATCHi-center

1. Åbn facilitet på matchi.se — «Available time slots» skal loades offentligt.
2. `facilityId` står i sidekilde (fx `facilityId=2445` i schedule-URL).
3. Tilføj i `matchiAllowlist.js` + `BANER_VENUES` (`sport: '5'` for padel hos de fleste DK-anlæg).

## Match Padel — alle Halbooking-områder

Fra `matchpadel.halbooking.dk` (probe marts 2026):

| omraede | Lokation |
|---------|----------|
| 5 | Aalborg |
| 1 | Aarhus |
| 14 | Odense |
| 19 | Silkeborg C |
| 4 | Silkeborg Syd (Them) |
| 8 | Lemvig |
| 11 | Hobro |
| 6/7 | Ballerup |
| 3/20 | København (Kløver / Studio) |
| 9/15 | Nykøbing F / Næstved |
| 10/13/17/18 | Bornholm |

Kun udvalgte er i appen endnu — flere kan tilføjes med samme `procBaner`-URL og nyt `id` per by.

## Kandidater (ikke i app endnu)

| Center | System | Region (forslag) |
|--------|--------|------------------|
| XPADEL Helsingør | halbooking (`xpadel.halbooking.dk`) | Sjælland |
| PADELPIT Roskilde/Karlslunde | halbooking | Sjælland |
| PadelMaster Grenå | halbooking (`padelmaster.halbooking.dk`) | Østjylland |
| Vissenbjerg Padel | matchi | Syddanmark/Fyn |

## Vedligehold

- Probe Match Padel områder: `node scripts/probe-match-padel-omraede.mjs`
- Unit test: `node --test tests/unit/banerVenues.test.mjs`
