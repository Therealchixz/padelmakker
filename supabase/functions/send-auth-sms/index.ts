// Supabase Auth "Send SMS" hook — delivers OTP via Twilio.
//
// Dashboard: Authentication → Auth Hooks → Send SMS → HTTPS
// URL: https://<project-ref>.supabase.co/functions/v1/send-auth-sms
//
// Secrets (Edge Functions → Secrets):
//   TWILIO_ACCOUNT_SID
//   TWILIO_AUTH_TOKEN
//   TWILIO_MESSAGING_SERVICE_SID  (preferred) OR TWILIO_PHONE_NUMBER (E.164)
//   SEND_SMS_HOOK_SECRET          (from hook config, format v1,whsec_...)

import { Webhook } from 'npm:standardwebhooks@1.0.0'

const HOOK_SECRET_RAW = Deno.env.get('SEND_SMS_HOOK_SECRET') ?? ''
const ACCOUNT_SID = Deno.env.get('TWILIO_ACCOUNT_SID') ?? ''
const AUTH_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN') ?? ''
const MESSAGING_SERVICE_SID = Deno.env.get('TWILIO_MESSAGING_SERVICE_SID') ?? ''
const FROM_NUMBER = Deno.env.get('TWILIO_PHONE_NUMBER') ?? ''

/** Twilio Messaging error codes → dansk (docs: twilio.com/docs/api/errors) */
const TWILIO_SMS_ERROR_DA: Record<number, string> = {
  21211:
    'Telefonnummeret ser ugyldigt ud. Brug landekode, fx +45 12 34 56 78.',
  21217: 'Telefonnummeret ser ugyldigt ud. Tjek cifrene og landekoden.',
  21408:
    'SMS til dette land/område er ikke tilladt på Twilio-kontoen. Kontakt support.',
  21607:
    'SMS-afsender er ikke konfigureret korrekt (Twilio trial). Kontakt support.',
  21608:
    'Dette nummer kan ikke modtage SMS på testkontoen. Brug et verificeret nummer eller kontakt os.',
  21610: 'Dette nummer kan ikke modtage SMS (afmeldt).',
  21612: 'SMS kan ikke sendes til dette nummer med den nuværende afsender.',
  21614:
    'Nummeret ser ikke ud til at kunne modtage SMS (fx fastnet). Prøv et mobilnummer.',
  21705: 'SMS-tjenesten er ikke konfigureret korrekt. Kontakt support.',
  20429: 'For mange SMS-forsøg. Vent et øjeblik og prøv igen.',
}

function twilioUserMessage(data: { code?: number; message?: string }): string {
  const code = Number(data?.code)
  if (Number.isFinite(code) && TWILIO_SMS_ERROR_DA[code]) {
    return TWILIO_SMS_ERROR_DA[code]
  }
  const apiMsg = String(data?.message || '').trim()
  return apiMsg ? `Twilio: ${apiMsg}` : 'Kunne ikke sende SMS'
}

function hookSecret(): string {
  return HOOK_SECRET_RAW.replace(/^v1,whsec_/, '')
}

function jsonResponse(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

async function sendTwilioSms(to: string, body: string) {
  if (!ACCOUNT_SID || !AUTH_TOKEN) {
    throw new Error('Twilio credentials mangler (TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN)')
  }
  if (!MESSAGING_SERVICE_SID && !FROM_NUMBER) {
    throw new Error('Angiv TWILIO_MESSAGING_SERVICE_SID eller TWILIO_PHONE_NUMBER')
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${ACCOUNT_SID}/Messages.json`
  const params = new URLSearchParams({ To: to, Body: body })
  if (MESSAGING_SERVICE_SID) {
    params.set('MessagingServiceSid', MESSAGING_SERVICE_SID)
  } else {
    params.set('From', FROM_NUMBER)
  }

  const basic = btoa(`${ACCOUNT_SID}:${AUTH_TOKEN}`)
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params,
  })

  const data = (await res.json().catch(() => ({}))) as {
    code?: number
    message?: string
    status?: string
  }
  if (!res.ok) {
    const err = new Error(twilioUserMessage(data)) as Error & { twilioCode?: number }
    if (data?.code != null) err.twilioCode = Number(data.code)
    throw err
  }
  return data
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return jsonResponse({ error: { message: 'Method not allowed' } }, 405)
  }

  const secret = hookSecret()
  if (!secret) {
    return jsonResponse({ error: { message: 'SEND_SMS_HOOK_SECRET er ikke sat' } }, 500)
  }

  const payload = await req.text()
  const headers = Object.fromEntries(req.headers.entries())
  const wh = new Webhook(secret)

  try {
    const { user, sms } = wh.verify(payload, headers) as {
      user: { phone?: string }
      sms: { otp?: string }
    }

    const phone = String(user?.phone || '').trim()
    const otp = String(sms?.otp || '').trim()
    if (!phone || !otp) {
      return jsonResponse({ error: { message: 'Mangler telefon eller OTP' } }, 400)
    }

    const messageBody = `Din PadelMakker-kode er: ${otp}. Den udløber om kort tid.`
    const twilioResult = await sendTwilioSms(phone, messageBody)

    if (twilioResult?.status && twilioResult.status !== 'queued' && twilioResult.status !== 'sent') {
      return jsonResponse(
        {
          error: {
            message: `SMS blev ikke sendt (status: ${twilioResult.status})`,
          },
        },
        502
      )
    }

    return jsonResponse({}, 200)
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Kunne ikke sende SMS'
    console.error('[send-auth-sms]', message)
    return jsonResponse({ error: { message } }, 500)
  }
})
