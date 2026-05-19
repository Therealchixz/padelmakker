# Telefon-SMS med Twilio (PadelMakker)

## 1. Supabase Auth

- **Authentication → Providers → Phone**: slå phone signup til.
- **OTP expiry**: sæt til **600 sekunder (10 min)** — standard er 60 sek, hvilket giver en misvisende 60s-nedtælling i appen og for kort tid til at indtaste koden.
- **SMS rate limit / max frequency**: sæt til **600s (10 min)** mellem SMS til samme nummer, så det matcher appens «Send igen»-cooldown.
- **Authentication → Attack Protection**: Turnstile (valgfri, matcher `VITE_TURNSTILE_SITE_KEY`).
- **SMS-besked (kun built-in Twilio, ingen Send SMS-hook):** brug GoTrue-syntaks med punktum og stort C:

  ```
  Din PadelMakker-kode er: {{ .Code }}. Koden udløber om 10 minutter.
  ```

  Skabelonen `{{friendly_name}}`, `{{code}}` og `{{ttl}}` virker **ikke** — så falder Supabase tilbage til en generisk tekst som «din kode er 123456». `friendly_name` og `ttl` findes ikke som SMS-variabler; skriv navn og minutter direkte i teksten.

  Sæt **Project Settings → General → Project name** til ønsket visningsnavn hvis andre dele af Auth bruger det — det påvirker ikke SMS-body alene.

- **Send SMS-hook:** Hvis **Authentication → Auth Hooks → Send SMS** er slået til, **ignoreres** dashboard-skabelonen. Teksten kommer fra edge function `send-auth-sms` (secrets `SMS_FRIENDLY_NAME`, `SMS_OTP_TTL_MINUTES`, valgfri `SMS_OTP_MESSAGE_TEMPLATE`).

## 2. Twilio (to muligheder)

### A) Built-in (nemmest)

**Authentication → Phone → SMS provider → Twilio**

- Account SID, Auth Token, **Message Service SID** (starter med `MG...`)
- Brug **ikke** Twilio Verify Service SID (`VA...`) i Message Service / From-feltet — det giver fejl 21212 («Invalid From Number»), og appen kan vise en misvisende «ugyldigt telefonnummer»-besked selv om brugerens nummer er korrekt.

### B) Edge Function hook (kode i repo)

1. Deploy `supabase/functions/send-auth-sms` med **`verify_jwt: false`** (Auth hook kalder uden bruger-JWT).
2. Secrets: `TWILIO_*`, `SEND_SMS_HOOK_SECRET` (fra hook UI).
3. **Authentication → Auth Hooks → Send SMS** → HTTPS →  
   `https://<project-ref>.supabase.co/functions/v1/send-auth-sms`
4. Brug **enten** hook **eller** built-in Twilio i Phone-provider — ikke begge med modstridende credentials.

### SMS kommer ikke frem?

- Tjek **Twilio Console → Messaging → Logs** for fejl (trial-konti kan kun sende til verificerede numre).
- Tjek **Supabase → Logs → Auth** for `sms_send_failed`, `phone_exists` eller `Invalid From Number` (VA... i stedet for MG...).
- Nummeret `+4521162004` er allerede på en konto — andre brugere får `phone_exists` og ingen ny SMS til det nummer.

## 3. Afsender «PadelMakker» i stedet for amerikansk nummer

Supabase/appen bestemmer **ikke** afsender — det vælger Twilio ud fra jeres **Messaging Service** (`MG...`).

| Twilio-begreb | Hvad det gør | Gælder DK-SMS? |
|---------------|--------------|----------------|
| Business Profile / Branded Calling / A2P (USA) | Tillid og compliance for **amerikanske** numre | Nej — ændrer ikke afsender til +45 |
| **Alphanumeric Sender ID** (fx `PadelMakker`) | Vises som afsendernavn på understøttede lande | Ja — Danmark understøttes (dynamisk) |

### Sådan får modtagere «PadelMakker» på SMS

1. **Twilio Console → Messaging → Services** → vælg jeres service (`MG539245...`).
2. **Sender pool → Add senders → Alphanumeric Sender ID**.
3. Indtast `PadelMakker` (max **11** tegn; kun bogstaver/tal).
4. Sørg for at den **amerikanske** sender i poolen **ikke** er den eneste — ellers vælger Twilio stadig +1-nummeret til DK, hvis alfanumerisk ikke er tilføjet/konfigureret.
5. Under **Sender Selection** / geo: alfanumerisk afsender til **Denmark** (se [Twilio DK SMS guidelines](https://www.twilio.com/en-us/guidelines/dk/sms)).

**Bemærk:** Alfanumerisk afsender er **kun udgående** — brugere kan ikke svare på SMS. Det er fint til OTP-koder.

Nogle telefoner viser stadig et nummer afhængigt af teleselskab — det er normalt.

## 4. App-flow

1. Opret profil med **obligatorisk** telefon.
2. SMS-kode på `/opret/bekraeft-telefon`.
3. E-mail-bekræftelse på `/opret/bekraeft-email`.
4. Dashboard (telefon skal være bekræftet).
