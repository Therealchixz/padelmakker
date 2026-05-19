# Telefon-SMS med Twilio (PadelMakker)

## 1. Supabase Auth

- **Authentication → Providers → Phone**: slå phone signup til.
- **OTP expiry**: sæt til **600 sekunder (10 min)** — standard er 60 sek, hvilket giver en misvisende 60s-nedtælling i appen og for kort tid til at indtaste koden.
- **SMS rate limit / max frequency**: sæt til **600s (10 min)** mellem SMS til samme nummer, så det matcher appens «Send igen»-cooldown.
- **Authentication → Attack Protection**: Turnstile (valgfri, matcher `VITE_TURNSTILE_SITE_KEY`).

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

## 3. App-flow

1. Opret profil med **obligatorisk** telefon.
2. SMS-kode på `/opret/bekraeft-telefon`.
3. E-mail-bekræftelse på `/opret/bekraeft-email`.
4. Dashboard (telefon skal være bekræftet).
