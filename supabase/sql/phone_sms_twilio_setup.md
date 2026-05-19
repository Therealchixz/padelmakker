# Telefon-SMS med Twilio (PadelMakker)

## 1. Supabase Auth

- **Authentication → Providers → Phone**: slå phone signup til.
- **Authentication → Attack Protection**: Turnstile (valgfri, matcher `VITE_TURNSTILE_SITE_KEY`).

## 2. Twilio (to muligheder)

### A) Built-in (nemmest)

**Authentication → Phone → SMS provider → Twilio**

- Account SID, Auth Token, Message Service SID

### B) Edge Function hook (kode i repo)

1. Deploy `supabase/functions/send-auth-sms`.
2. Secrets: `TWILIO_*`, `SEND_SMS_HOOK_SECRET` (fra hook UI).
3. **Authentication → Auth Hooks → Send SMS** → HTTPS →  
   `https://<project-ref>.supabase.co/functions/v1/send-auth-sms`

## 3. App-flow

1. Opret profil med **obligatorisk** telefon.
2. SMS-kode på `/opret/bekraeft-telefon`.
3. E-mail-bekræftelse på `/opret/bekraeft-email`.
4. Dashboard (telefon skal være bekræftet).
