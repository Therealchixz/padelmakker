# Baner — oversigt og udvidelse

PadelMakker **Book bane** viser ledige tider, når centrets kalender er **offentlig** (uden PadelMakker-login). Booking sker altid hos udbyderen.

## Integrationstyper

| Type | Ledige tider i app | Klik på ledig tid | Konfiguration |
|------|-------------------|-------------------|---------------|
| `halbooking` | Ja | Halbooking (bane + tid) | `padelmakker-server/halbookingVenuesAllowlist.js` + `src/lib/banerVenues.js` |
| `matchi` | Ja | MATCHi med dato | `padelmakker-server/matchiAllowlist.js` + `banerVenues.js` |
| `bookli` | Ja | Bookli | `padelmakker-server/bookliAllowlist.js` + `banerVenues.js` |
| `playtomic` | Ja | Playtomic med dato | `padelmakker-server/playtomicAllowlist.js` + `banerVenues.js` |
| `link` | Nej | Ekstern klubside | Kun `banerVenues.js` |

## Regioner i appen

Centre grupperes under landsdele i `src/lib/banerRegions.js` (se også `docs/baner-regioner.md`):

- Nordjylland, **Vestjylland**, Østjylland, Sønderjylland (sydjylland), Fyn, Sjælland, Hovedstaden, Bornholm

**Midtjylland** er ikke en overskrift — Aarhus/Randers/Silkeborg ligger under **Østjylland**, Herning/Holstebro/Lemvig under **Vestjylland** (DST).

**Bemærk:** Odense og Vissenbjerg ligger på **Fyn**, ikke Sønderjylland. «Syddanmark» bruges ikke som regionnavn i appen.

**Østjylland:** Der findes mange padelklubber i Danmark (Randers, Horsens, Djursland, Grenå, Hadsten osv.). I appen vises kun centre hvor vi har **verificeret** åben Halbooking/MATCHi/Bookli-integration — ikke fordi der kun findes én klub.

## Eksterne kataloger (ikke integreret i appen)

PadelMakker scraper ikke disse sider — de bruges til manuelt at finde nye centre og booking-systemer:

| Katalog | URL | Indhold |
|---------|-----|---------|
| **WannaSport** | [wannasport.com/dnk/da](https://www.wannasport.com/dnk/da) | By-/regionsliste med padel og booking-links |
| **Padellife** | [Oversigt over padelbaner i Danmark](https://padellife.dk/blogs/tips-og-tricks/oversigt-over-padelbaner-i-danmark) | Redaktionel liste: København, Sjælland, Fyn, Syd-/Midt-/Nordjylland, Bornholm |

Padellife nævner fx Randers (Padel Lounge, Rocket Padel), Grenå, Horsens og mange Match Padel-afdelinger — tilføjelse i appen kræver stadig probe af Halbooking/MATCHi/Bookli (se `discover-padel-venues.mjs`).

## Grund-søgning (scripts)

```bash
node scripts/discover-padel-venues.mjs
```

Skriver `scripts/output/padel-venue-discovery.json` (probe af MATCHi-slugs + Halbooking `proc_baner.asp`). **WannaSport** og **Padellife** har ingen åben API; begge bruges til manuelt krydstjek.

Enkelt Halbooking-center:

```bash
node scripts/probe-halbooking-omraede.mjs "https://<klub>.halbooking.dk/newlook/proc_baner.asp"
```

PadelMaster (uden `soeg_omraede`-dropdown) virker med `omraede: ''` — se `scripts/probe-padelmaster.mjs`.

## Centre i produktion (maj 2026)

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
| Padel Nord | matchi | `matchi_padelnord` (2445) |
| Padel99 | matchi | `matchi_padel99` |
| Skagen Padelcenter | matchi | `matchi_skagen_padelcenter` |
| Aars Tennis & Padel | link | `aarstennisklub_booking` |
| Gug Tennis & Padel | link | `gug_tennis_padel_booking` |

### Østjylland

| Titel | Type | id |
|-------|------|-----|
| Padel8500 Grenå | matchi | `matchi_padel8500` (2229) |
| PadelMaster Hadsten | halbooking | `padelmaster_hadsten` |

### Midtjylland

| Titel | Type | id |
|-------|------|-----|
| Match Padel Aarhus | halbooking | `match_padel_aarhus` (område 1) |
| Padel Land | matchi | `matchi_padelland` (2072) |
| ViPadel Aarhus | matchi | `matchi_vipadelaarhus` (1062) |
| Match Padel Silkeborg | halbooking | `match_padel_silkeborg` (19) |
| ØBG Silkeborg | halbooking | `oebg_silkeborg_halbooking` |
| Padel Lounge Herning | halbooking | `padel_lounge_herning` |

### Fyn

| Titel | Type | id |
|-------|------|-----|
| Match Padel Odense | halbooking | `match_padel_odense` (14) |
| Vissenbjerg Padel | matchi | `matchi_vissenbjerg_padel` (3112) |
| Nr. Lyndelse Padeltennis | matchi | `matchi_nr_lyndelse_padel` (870) |

### Sønderjylland (sydjylland)

| Titel | Type | id |
|-------|------|-----|
| Breintholtgård Padel, Esbjerg | matchi | `matchi_breintholt_esbjerg` (2232) |
| K7 Padel, Løsning | matchi | `matchi_k7_padel_losning` (2650) |

### Sjælland

| Titel | Type | id |
|-------|------|-----|
| XPADEL Helsingør | halbooking | `xpadel_helsingor_halbooking` |
| PADELPIT Roskilde | halbooking | `padelpit_roskilde_halbooking` |
| PADELPIT Karlslunde | halbooking | `padelpit_karlslunde_halbooking` |
| Padel4alle Køge | matchi | `matchi_padel4alle` (2364) |
| Padel North Kokkedal | matchi | `matchi_padelnorth` (2810) |
| VI Padel Slagelse | matchi | `matchi_vipadelslagelse` (1925) |
| Køge Tennis og Padel | halbooking | `koge_tennis_halbooking` |
| Allerød Tennis & Padel | halbooking | `at_tennis_alleroed` |
| Tisvilde Tennis & Padel | halbooking | `tisvilde_tennis_halbooking` |
| Hillerød Tennis & Padelklub | halbooking | `htpk_hillerod_halbooking` (område 3 = padel, ikke tennis) |
| Match Padel Ballerup | halbooking | `match_padel_ballerup` (område 6) |
| Match Padel Ballerup single | halbooking | `match_padel_ballerup_single` (7) |
| Match Padel Næstved | halbooking | `match_padel_naestved` (15) |
| Match Padel Nykøbing F. | halbooking | `match_padel_nykobing_falster` (9) |
| Racket Club Taastrup | matchi | `matchi_racketclub_taastrup` (2262) |

Plus **~33 Padellife-link-centre** (Albertslund, Holbæk, Racket Club Roskilde, m.fl.) under samme region.

### Hovedstaden

| Titel | Type | id |
|-------|------|-----|
| Padel Yard Reffen | matchi | `matchi_padelyard` (917) |

## Kandidater (Padellife / WannaSport / probe — ikke i app endnu)

| Center | System | Region (forslag) |
|--------|--------|------------------|
| Match Padel København, Ballerup, Næstved, Bornholm | halbooking (matchpadel) | Hovedstaden / Sjælland / Bornholm |
| EGIF Esbjerg | halbooking (`egif.halbooking.dk`, kræver session) | Sønderjylland |
| Løkken Idrætscenter | halbooking (`lic.halbooking.dk`) | Nordjylland |
| Rocket Padel Kolding | eget system | Sønderjylland |
| Randers / Horsens / Herning padel | ofte ikke MATCHi-slug | Østjylland / Midtjylland |
| VI Padel Slagelse | matchi (`vipadelslagelse`) | Sjælland |
| Hillerød / Køge / Allerød / Tisvilde | halbooking (Padellife-links) | Sjælland |

## Tilføj nyt Halbooking-center

1. Åbn `https://<klub>.halbooking.dk/newlook/proc_baner.asp` — kalender skal vises uden login.
2. Find `soeg_omraede` i HTML (eller tom streng hvis kun ét padel-område, som PadelMaster).
3. Tilføj i `halbookingVenuesAllowlist.js`: `procBaner` + `omraede`.
4. Tilføj post i `BANER_VENUES` med `kind: 'halbooking'`, `region`, adresse.

## Tilføj nyt MATCHi-center

1. Åbn facilitet på matchi.se — «Available time slots» skal loades offentligt.
2. `facilityId` står i sidekilde (fx `facilityId=2445` i schedule-URL) eller kør `discover-padel-venues.mjs`.
3. Tilføj i `matchiAllowlist.js` + `BANER_VENUES` (`sport: '5'` for padel hos de fleste DK-anlæg).

## Tilføj nyt Playtomic-center

1. Åbn `https://playtomic.com/clubs/<slug>` — find `tenant_id` i HTML (`tenant-id="…"` / `tenant_id=`).
2. Smoke-test: `https://playtomic.com/api/clubs/availability?tenant_id=…&date=YYYY-MM-DD&sport_id=PADEL` (kun ledige slots).
3. Tilføj i `playtomicAllowlist.js` (`tenantId`, `clubSlug`, `bookingUrl`) + `BANER_VENUES` med `kind: 'playtomic'`.
4. API: `/api/playtomic-slots?venue=<id>&date=YYYY-MM-DD`.

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

## Vedligehold

- Discovery: `node scripts/discover-padel-venues.mjs`
- Probe Match Padel områder: `node scripts/probe-match-padel-omraede.mjs`
- Unit test: `node --test tests/unit/banerVenues.test.mjs`
