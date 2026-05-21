# PadelMakker — stor smoke-test (produktion)

**Formål:** Verificere at kerneflows virker efter deploy — især UX-gennemgangen (navigation, fejl-UI, søger kamp/makker, auth).

**Tid:** ca. 45–90 min (én tester) · ca. 25 min hvis I springer valgfrie punkter over.

**Miljø:** Produktions-URL (Vercel). Hard refresh (Ctrl+F5) eller inkognito før start.

**Konti:** Mindst **2 rigtige brugere** (fx dig + makker) med profil, region og ELO. Valgfrit: ny test-email til oprettelse.

**Enheder:** Test **mobil** (iPhone/Android eller DevTools) + **desktop** — mange UX-ændringer er mobil-specifikke.

**Status:** ☐ ikke testet · ✅ OK · ❌ fejl (notér URL + kort beskrivelse)

---

## 0. Forberedelse

| # | Tjek | Status | Noter |
|---|------|--------|-------|
| 0.1 | Seneste commit på `main` er deployet (Vercel grøn) | | |
| 0.2 | `VITE_SUPABASE_*` sat på prod (data loader, ikke kun UI) | | |
| 0.3 | To testbrugere kan logge ind | | Bruger A / Bruger B |
| 0.4 | Notér build/commit-hash eller deploy-tid | | |

---

## 1. Offentlige sider (udlogget)

| # | Handling | Forventet | Status | Noter |
|---|----------|-----------|--------|-------|
| 1.1 | Åbn `/` | Forside loader | | |
| 1.2 | `/login` | Login-side, Google + email | | |
| 1.3 | `/opret` | Onboarding starter (hvis ikke logget ind) | | |
| 1.4 | `/faq`, `/privatlivspolitik`, `/handelsbetingelser` | Juridisk side loader; **Til forsiden** | | |
| 1.5 | `/xyz-ukendt` | **404** + «Gå til forsiden» (udlogget) | | |
| 1.6 | `/events` | Offentlige events (hvis I bruger den) | | valgfri |

---

## 2. Login & adgangskode

| # | Handling | Forventet | Status | Noter |
|---|----------|-----------|--------|-------|
| 2.1 | Forkert adgangskode | Dansk fejl (ikke rå `Invalid login credentials`) | | |
| 2.2 | **Enter** i email/adgangskode-felt | Submitter login | | |
| 2.3 | Link **Opret profil** → `/opret` | | | |
| 2.4 | Korrekt login | Redirect til dashboard/onboarding | | |
| 2.5 | **Google-login** (hvis aktiveret) | Redirect tilbage, session OK | | valgfri |
| 2.6 | Glemt adgangskode | Mail-flow / dansk fejl ved fejl | | valgfri |

---

## 3. Oprettelse & telefon (kun hvis I tester ny konto)

| # | Handling | Forventet | Status | Noter |
|---|----------|-----------|--------|-------|
| 3.1 | `/opret` → udfyld → telefon-trin | SMS sendes / dansk fejl | | |
| 3.2 | Forkert OTP | Dansk fejl, kan sende igen | | |
| 3.3 | Korrekt OTP | Info om **logout før email**; videre til email-bekræftelse | | |
| 3.4 | Efter email-flow → login → dashboard | | | |

---

## 4. Dashboard-navigation

### 4A Desktop

| # | Handling | Forventet | Status | Noter |
|---|----------|-----------|--------|-------|
| 4A.1 | Faner: Hjem, Find makker, Book Bane, Kampe, Ranking, Liga, Beskeder | Alle åbner uden hvid skærm | | |
| 4A.2 | Konto-menu → Profil | Profil-fane åbner | | |
| 4A.3 | `/dashboard/ukendt-tab` | Redirect til **/dashboard/hjem** | | |
| 4A.4 | `/dashboard/kamp-filter` og `/dashboard/makker-filter` | Filter-sider loader | | |

### 4B Mobil (bund-navigation + Mere)

| # | Handling | Forventet | Status | Noter |
|---|----------|-----------|--------|-------|
| 4B.1 | Primær: Hjem, Find makker, Book Bane, Kampe | Virker | | |
| 4B.2 | **Mere** indeholder Ranking, Beskeder, Profil — **ikke Liga** | Liga kun via Kampe | | |
| 4B.3 | Badge på Kampe/Beskeder (hvis data) | Tal vises | | valgfri |
| 4B.4 | Profil under Mere | | | |

---

## 5. Hjem

| # | Handling | Forventet | Status | Noter |
|---|----------|-----------|--------|-------|
| 5.1 | Aktivitetsfeed loader | Rækker eller tom tekst «ingen aktivitet» — **ikke** evig skeleton | | |
| 5.2 | Slå én chip fra (fx Kampe) | Feed filtreres | | |
| 5.3 | Slå alle chips fra | «Ingen aktiviteter matcher…» + **Vis alle typer** (eller chip **Alle**) | | |
| 5.4 | Klik **Alle** / Vis alle typer | Alle typer vises igen | | |
| 5.5 | Klik på **søger kamp** / **søger makker** i feed | Korrekt tab/destination | | |
| 5.6 | **Detaljer** på søger-aktivitet | Spillermodal med **kun** den kanal (kamp *eller* makker) | | |
| 5.7 | ELO-graf / hurtige genveje (hvis synlige) | Ingen JS-fejl | | valgfri |
| 5.8 | *(Valgfri)* Slå net fra → reload | Fejlkort + **Prøv igen** (ikke forveksles med tom feed) | | |

---

## 6. Find makker

| # | Handling | Forventet | Status | Noter |
|---|----------|-----------|--------|-------|
| 6.1 | Liste loader | Kort med spillere eller tom tilstand | | |
| 6.2 | **Mit makker-filter**-genvej → rediger → **Gem** | Tilbage til Find makker (ikke fanget på filter-side) | | |
| 6.3 | Toggle **Søger makker** / synlighed | Toast; status opdateres | | |
| 6.4 | ELO på kort vs. profil-modal | Samme tal (ca.) | | |
| 6.5 | Lang bio | Vis mere / Vis mindre | | valgfri |
| 6.6 | Åbn spillermodal | Navn, ELO, evt. søger-makker-blok | | |
| 6.7 | Send besked / invitér (hvis relevant) | Besked eller toast | | valgfri |
| 6.8 | *(Valgfri)* Simuler load-fejl | Fejlkort + **Prøv igen** | | |

---

## 7. Kampe — 2v2 (padel)

| # | Handling | Forventet | Status | Noter |
|---|----------|-----------|--------|-------|
| 7.1 | Format **Padel** valgt | Kampe-liste loader | | |
| 7.2 | **Søger kamp**-kort øverst | Toggle + link **Mit kamp-filter** | | |
| 7.3 | Filter-side: region, niveau, **tidsrum**, spilledage | Gem OK; tilbage til Kampe | | |
| 7.4 | **Ingen** «Kun åbne kampe» i offentlig/søger-visning | | | |
| 7.5 | Status-tabs (åbne / mine / afsluttede) | Skifter liste | | |
| 7.6 | **Regler for 2v2** fold-ud | Under tabs; ikke i vejen for liste | | |
| 7.7 | Opret kamp | Kamp vises; du på hold 1 | | |
| 7.8 | Anden bruger **tilmelder** | Opretter får notifikation | | bruger B |
| 7.9 | **Råb op for spiller** på åben kamp | Toast med ELO-vindue/region; modtagere får notifikation | | |
| 7.10 | Indtast kampresultat | ELO opdateres / resultat gemt | | |
| 7.11 | *(Valgfri)* Load-fejl | Fejlkort + Prøv igen | | |

---

## 8. Kampe — Americano & Liga

| # | Handling | Forventet | Status | Noter |
|---|----------|-----------|--------|-------|
| 8.1 | Skift til **Americano** | Turneringer loader; opret/deltag | | valgfri |
| 8.2 | Skift til **Liga** (i Kampe) | Liga-embed loader | | |
| 8.3 | Mobil: Liga **ikke** i Mere-menu | Kun via Kampe → Liga | | mobil |
| 8.4 | Desktop: separat **Liga**-fane virker stadig | | desktop |

---

## 9. Profil

| # | Handling | Forventet | Status | Noter |
|---|----------|-----------|--------|-------|
| 9.1 | Profil loader | Navn, avatar, ELO | | |
| 9.2 | Kort **Søger kamp** / **Søger makker** | Link til filter; korrekt TTL-tekst (24 t / 7 d) | | |
| 9.3 | Rediger profil → gem | Ændring vises | | |
| 9.4 | **Tilgængelighed/spilledage** kun i filter-sider — ikke duplikeret i profil-redigering | | |
| 9.5 | Notifikationsindstillinger / kamp-watch / makker-watch | Kan slå til/fra | | valgfri |
| 9.6 | Log ud → login igen | Session OK | | |

---

## 10. Ranking

| # | Handling | Forventet | Status | Noter |
|---|----------|-----------|--------|-------|
| 10.1 | **Alle tider** / uge / måned | Liste loader | | |
| 10.2 | Skift **2v2** ↔ **Americano ELO** | Liste opdateres | | |
| 10.3 | Klik spiller | Spillermodal | | |
| 10.4 | Din placering vises | | | valgfri |
| 10.5 | *(Valgfri)* Load-fejl | Fejlkort + Prøv igen | | |

---

## 11. Beskeder

| # | Handling | Forventet | Status | Noter |
|---|----------|-----------|--------|-------|
| 11.1 | Samtaleliste loader | | | |
| 11.2 | Åbn samtale → send besked | Modtager ser den (bruger B) | | |
| 11.3 | Mobil: tilbage fra samtale | Bund-menu kommer tilbage | | mobil |
| 11.4 | *(Valgfri)* Load-fejl | Fejlkort + toast + Prøv igen | | |

---

## 12. Book Bane

| # | Handling | Forventet | Status | Noter |
|---|----------|-----------|--------|-------|
| 12.1 | Baner/venues loader | Kort eller liste | | |
| 12.2 | Klik bane / link | Intet crash | | valgfri |

---

## 13. Notifikationer (klokke)

| # | Handling | Forventet | Status | Noter |
|---|----------|-----------|--------|-------|
| 13.1 | Klokke viser ulæste | | | |
| 13.2 | Klik notifikation (kamp, makker, besked) | Deep link til rigtig fane | | |
| 13.3 | Admin-notifikation → `?adminSub=reports` | Admin åbner reports (kun admin) | | kun admin |

---

## 14. Juridisk & 404 (indlogget)

| # | Handling | Forventet | Status | Noter |
|---|----------|-----------|--------|-------|
| 14.1 | `/faq` (logget ind) | **← Til dashboard** | | |
| 14.2 | `/privatlivspolitik` (logget ind) | Til dashboard | | |
| 14.3 | `/noget-random` | 404 + **Gå til dashboard** | | |

---

## 15. Admin (kun admin-bruger)

| # | Handling | Forventet | Status | Noter |
|---|----------|-----------|--------|-------|
| 15.1 | Admin-fane / panel åbner | | | |
| 15.2 | Underfaner (reports, result_errors, …) | Loader | | |
| 15.3 | Notifikation → admin reports | Korrekt underfane | | |

---

## 16. PWA / performance (valgfri)

| # | Handling | Forventet | Status | Noter |
|---|----------|-----------|--------|-------|
| 16.1 | `/app` install-guide | | | |
| 16.2 | Ingen vedvarende «Indlæser…» > 15 s på hovedfaner | | | |
| 16.3 | Cookie-banner | Kan acceptere uden at blokere app | | |

---

## 17. Krydstjek UX-gennemgang (hurtig)

| Tema | OK? | Noter |
|------|-----|-------|
| Danske fejltekster (login, telefon) | | |
| Fejl-UI med retry (Hjem, Ranking, Makkere, Kampe, Beskeder, spillermodal) | | |
| Filter gem → tilbage til oprindelse | | |
| Søger kamp ≠ Råb op (forståeligt i UI) | | |
| Makker-niveau: ét interval, ikke «Samme niveau» + ekstra linje | | |
| Hjem: «Vis alle typer» ikke «filtre» | | |

---

## 18. Afslutning

| | |
|--|--|
| **Testet af** | |
| **Dato** | |
| **Commit/deploy** | |
| **Enheder** | Desktop / iOS / Android |
| **Samlet resultat** | ☐ Grøn · ☐ Gul (småting) · ☐ Rød (blokerende) |

### Blokerende fejl (hvis nogen)

1. 
2. 
3. 

### Gul / nice-to-have

1. 
2. 

---

*Sidst opdateret i forbindelse med UX-bølge 1–3 på `main`.*
