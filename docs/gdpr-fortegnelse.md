# Fortegnelse over behandlingsaktiviteter

**Dataansvarlig:** PadelMakker, CVR 46403193 · kontakt@padelmakker.dk
**Tjeneste:** https://www.padelmakker.dk
**Sidst gennemgået:** 23. september 2026

GDPR art. 30 kræver, at en dataansvarlig fører en fortegnelse over sine
behandlinger. Undtagelsen for virksomheder under 250 ansatte gælder **ikke**
her, fordi behandlingen er løbende og ikke lejlighedsvis. Fortegnelsen er
typisk det første Datatilsynet beder om at se.

Dette dokument er udfyldt ud fra hvad koden og databasen faktisk gør, ikke ud
fra en skabelon. Når noget ændres i appen, skal det ændres her.

---

## 1. Oprettelse og login

| | |
|---|---|
| **Formål** | Give brugeren en konto og holde den sikker |
| **Retsgrundlag** | Art. 6, stk. 1, litra b (opfylde aftalen) |
| **Kategorier af registrerede** | Brugere af appen, mindst 16 år |
| **Personoplysninger** | E-mail, adgangskode (hashet hos Supabase Auth), telefonnummer, login-metode (e-mail eller Google), sessioner |
| **Hvor** | `auth.users` (Supabase), `public.profiles.email` |
| **Modtagere** | Supabase (hosting/auth), Twilio (SMS-kode), Google (kun ved Google-login), Cloudflare (Turnstile) |
| **Sletning** | Ved kontosletning, jf. pkt. 9 |

## 2. Profil og matchning

| | |
|---|---|
| **Formål** | Vise spilleren for andre spillere og foreslå relevante makkere og kampe |
| **Retsgrundlag** | Art. 6, stk. 1, litra b |
| **Personoplysninger** | Navn, fødselsdato, region, by, koordinater for byen, niveau, spillestil, banehalvdel, tilgængelighed, bio, avatar |
| **Hvor** | `public.profiles` |
| **Modtagere** | Andre brugere af appen ser navn, niveau, by, region, spillestil, bio og avatar |
| **Bemærk** | Koordinaterne er byens, ikke enhedens. Appen beder ikke om GPS-position. |

## 3. Kampe, resultater og rangering

| | |
|---|---|
| **Formål** | Afvikle kampe, Americano-turneringer og ligaer, og beregne ELO |
| **Retsgrundlag** | Art. 6, stk. 1, litra b |
| **Personoplysninger** | Deltagelse, resultater, ELO-historik, holdnavne |
| **Hvor** | `matches`, `match_participants`, `elo_history`, `americano_*`, `leagues`, `league_teams`, `play_intents` |
| **Modtagere** | Andre deltagere i den pågældende kamp/turnering |

## 4. Beskeder i appen og push

| | |
|---|---|
| **Formål** | Give besked om kampinvitationer, resultater, makkeranmodninger m.m. |
| **Retsgrundlag** | Art. 6, stk. 1, litra b for selve beskeden; litra a (samtykke) for browser-push, fordi browseren beder om tilladelse |
| **Personoplysninger** | Beskedtekst, tidsstempler, push-abonnement (endpoint og nøgler) |
| **Hvor** | `notifications`, `push_subscriptions` |
| **Modtagere** | Browserens push-tjeneste (Google/Apple/Mozilla, afhængigt af enhed) |
| **Framelding** | I appen eller i browserens indstillinger |

## 5. E-mails om nye makkere og kampe

| | |
|---|---|
| **Formål** | Fortælle brugeren, at en spiller i hans område søger makker eller har oprettet en kamp, der passer |
| **Retsgrundlag** | Art. 6, stk. 1, litra b og litra f (berettiget interesse i at tjenesten er brugbar) |
| **Personoplysninger** | E-mailadresse, navn, region, niveau; log over hvornår der sidst blev sendt |
| **Hvor** | `email_send_log`, `email_unsubscribe_tokens`; afsendelse i edge-funktionerne `send-discovery-email` og `send-reactivation` |
| **Modtagere** | Resend (e-mailleverandør) |
| **Begrænsninger i systemet** | Højst én mail per bruger per døgn (`claim_email_send_slot`), højst 8 modtagere per søgning, aldrig den samme spiller to gange inden for syv dage |
| **Framelding** | Afmeldingslink med ét klik i hver mail (RFC 8058, virker uden login) samt Profil → Notifikationer |
| **Oplyst hvornår** | På oprettelsessiden, før kontoen oprettes |

> **Vurdering det er værd at skrive ned:** disse mails er servicebeskeder om
> appens kernefunktion, ikke reklame for andre produkter. Markedsføringslovens
> § 10 rammer henvendelser "med henblik på direkte markedsføring". Grænsen er
> ikke knivskarp, og påmindelsen til inaktive brugere (`send-reactivation`)
> ligger tættere på grænsen end opdagelses-mailen. Derfor: ét-kliks framelding,
> tydelig afsender, og oplysning før oprettelsen. Vil man være helt uden for
> diskussion, skal afkrydsningsfeltet til mails være **ikke** afkrydset på
> forhånd — det koster rækkevidde, og det er en forretningsbeslutning.

## 6. Dokumentation for accept

| | |
|---|---|
| **Formål** | Kunne påvise, at brugeren har accepteret betingelser og privatlivspolitik (art. 7, stk. 1) |
| **Retsgrundlag** | Art. 6, stk. 1, litra c (retlig forpligtelse) |
| **Personoplysninger** | Bruger-id, tidspunkt, hvilken version der blev accepteret, hvor (opret / opret-google) |
| **Hvor** | `public.consent_log`, skrevet af databasetrigger `on_auth_user_consent_recorded` |
| **Bemærk** | Rækken kan ikke ændres eller slettes af den konto, den handler om. Brugeren kan læse sin egen. |

## 7. Sikkerhed, drift og misbrugsforebyggelse

| | |
|---|---|
| **Formål** | Holde tjenesten kørende, finde fejl, forhindre misbrug |
| **Retsgrundlag** | Art. 6, stk. 1, litra f |
| **Personoplysninger** | IP-adresse, browser/enhed, tidsstempler, serverlogs, captcha-vurdering |
| **Hvor** | Logs hos Supabase og Vercel; Cloudflare Turnstile |
| **Opbevaring** | Typisk op til 90 dage |

## 8. Blokering og anmeldelse af brugere

| | |
|---|---|
| **Formål** | Lade brugere blokere hinanden og lade os håndtere henvendelser om misbrug |
| **Retsgrundlag** | Art. 6, stk. 1, litra f |
| **Hvor** | `blocked_users`, feedback via `report-feedback` |

## 9. Sletning af konto

Brugeren beder om sletning via **Profil → Slet konto**, som åbner en mail til
kontakt@padelmakker.dk. Vi svarer og sletter som udgangspunkt inden for 30
dage (art. 12, stk. 3 giver én måned).

> **Åbent punkt, skal besluttes:** tabellen `deleted_players_archive` gemmer
> ved sletning e-mail, navn og et fuldt øjebliksbillede af profil og
> auth-konto (`profile_snapshot`, `auth_snapshot`), så en fejlagtig sletning
> kan fortrydes. Der er i dag **ingen udløbsdato** på de rækker, og der kører
> intet job, der rydder dem. Det står i modstrid med, at privatlivspolitikken
> lover sletning inden for 30 dage. Vælg én af to:
>
> 1. Behold arkivet som fortrydelsesvindue, men **sæt en frist** (fx 30 dage)
>    og kør en automatisk oprydning — og skriv fristen i politikken.
> 2. Drop øjebliksbillederne og gem kun det minimum, der skal til for at kunne
>    dokumentere, at en sletning fandt sted.
>
> Indtil ét af de to er gjort, er der en reel uoverensstemmelse mellem, hvad
> politikken lover, og hvad databasen gør.

## 10. Databehandlere

| Leverandør | Rolle | Placering | Databehandleraftale |
|---|---|---|---|
| Supabase | Database, auth, filer, edge functions | EU/EØS-region valgt | Skal bekræftes i Supabase-dashboardet |
| Vercel | Hosting af webappen | Globalt CDN | Skal bekræftes i Vercel-dashboardet |
| Resend | Udsendelse af e-mail | Se Resends vilkår; EU-region kan vælges | Skal bekræftes hos Resend |
| Twilio | SMS-koder | — | Via Supabase Auth |
| Cloudflare | Turnstile (captcha) | — | Skal bekræftes |
| Google | Google-login | — | Selvstændig dataansvarlig for deres del |

En databehandleraftale (art. 28) skal være indgået **skriftligt** med hver af
dem. Alle fire første har en standardaftale, men den skal som regel aktivt
accepteres i deres kontrolpanel — den følger ikke automatisk med, fordi man
opretter en konto. Gem en kopi eller et skærmbillede med dato.

## 11. Overførsel til tredjelande

Supabase er valgt med EU-hosting. Vercel og Resend kan behandle data uden for
EU/EØS; begge oplyser at de bruger EU-Kommissionens standardkontrakt­bestemmelser
(SCC). Kontrollér og notér status ved næste gennemgang.

---

## Hvad der mangler, og som kun ejeren kan gøre

1. Bekræft og gem databehandleraftalerne, jf. pkt. 10.
2. Tag stilling til `deleted_players_archive`, jf. pkt. 9.
3. Slå **leaked password protection** til i Supabase (Authentication →
   Policies). Den er slået fra i dag. Art. 32 kræver passende sikkerhed, og
   det er ét klik.
4. Få en jurist til at læse privatlivspolitikken og vurderingen i pkt. 5
   igennem. Dette dokument er skrevet af en udvikler, ikke en advokat.
