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

  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const msg = data?.message || res.statusText
    throw new Error(`Twilio fejl: ${msg}`)
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

    const messageBody = `Din PadelMakker-kode er: ${otp}. Den udløber om 10 minutter.`
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
