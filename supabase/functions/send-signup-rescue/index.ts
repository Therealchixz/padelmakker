// Supabase Edge Function: send-signup-rescue
// Engangsmail til dem, der begyndte at oprette sig, men ikke blev færdige
// (ejeren 3. nov. 2026). Teksten og hvem der får den: content.ts.
//
// Kører IKKE af sig selv - der er intet cron-job. Den startes manuelt, når
// ejeren har set udkastet og sagt ja.
//
// Spærrer (som send-winback):
//   - højst én mail om dagen i alt (claim_email_send_slot, nøgle "discovery")
//   - højst én af denne mail pr. person (nøgle "signup_rescue", 365 dage)
//   - ingen mail uden frameldingslink; afmeldte springes over
//
// Auth: x-cron-secret (app_config.reminder_cron_secret).
// Body (valgfri):
//   { "dryRun": true }   tæller pr. gruppe og viser udkast, sender intet
//   { "limit": 100 }     højst så mange mails i denne kørsel
//   { "testTo": "x@y.dk", "testGroup": "phone_email" }
//                        én prøve til den adresse (opdigtet navn); rører ikke de rigtige modtagere

import { createClient } from "npm:@supabase/supabase-js@2";
import { copenhagenDateLabel } from "../send-discovery-digest/content.ts";
import {
  buildSignupRescueEmail,
  rescueEmailAddress,
  rescueGroupFor,
  type RescueGroup,
  type RescueProfile,
  type RescueUser,
} from "./content.ts";

const CVR = "46403193";
const DAILY_MIN_INTERVAL = "23 hours";
const ONCE_MIN_INTERVAL = "365 days";
const KIND = "signup_rescue";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "");

  const provided = req.headers.get("x-cron-secret") || "";
  const { data: cfg } = await admin.from("app_config").select("value").eq("key", "reminder_cron_secret").maybeSingle();
  if (!cfg?.value || provided.length < 16 || provided !== cfg.value) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  let dryRun = false;
  let limit = 100;
  let testTo = "";
  let testGroup: RescueGroup = "google_sms";
  try {
    const body = await req.json();
    dryRun = body?.dryRun === true;
    if (typeof body?.testTo === "string" && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(body.testTo.trim())) {
      testTo = body.testTo.trim();
    }
    if (body?.testGroup === "phone_email" || body?.testGroup === "email_sms" || body?.testGroup === "google_sms") {
      testGroup = body.testGroup;
    }
    if (Number.isFinite(Number(body?.limit)) && Number(body.limit) > 0) {
      limit = Math.min(300, Math.floor(Number(body.limit)));
    }
  } catch {
    /* ingen krop */
  }

  const siteUrlTest = String(Deno.env.get("SITE_URL") || "https://www.padelmakker.dk").replace(/\/+$/, "");
  if (testTo) {
    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey) return jsonResponse({ error: "RESEND_API_KEY mangler" }, 500);
    const from = Deno.env.get("DISCOVERY_FROM_EMAIL") || Deno.env.get("FEEDBACK_FROM_EMAIL") || "PadelMakker <kontakt@padelmakker.dk>";
    const email = buildSignupRescueEmail(
      testGroup,
      { id: "test" },
      { id: "test", full_name: "Mette Eksempel" },
      { siteUrl: siteUrlTest, unsubLink: `${siteUrlTest}/afmeld`, cvr: CVR, todayLabel: copenhagenDateLabel() },
    );
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from, to: [testTo], reply_to: "kontakt@padelmakker.dk",
        subject: `[PRØVE] ${email.subject}`, text: email.text, html: email.html,
      }),
    });
    return jsonResponse({ ok: res.ok, test: true, group: testGroup, status: res.status });
  }

  // Alle konti (få hundrede) + deres profiler.
  const users: RescueUser[] = [];
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) {
      console.error("send-signup-rescue listUsers:", error.message);
      return jsonResponse({ error: "Kunne ikke hente brugere" }, 500);
    }
    users.push(...(data.users as unknown as RescueUser[]));
    if (data.users.length < 200) break;
  }
  const { data: profileRows, error: profErr } = await admin
    .from("profiles")
    .select("id, full_name, name, birth_year, play_style, availability, city, latitude, phone_verification_exempt, is_banned, role, notification_prefs")
    .in("id", users.map((u) => u.id));
  if (profErr) {
    console.error("send-signup-rescue profiles:", profErr.message);
    return jsonResponse({ error: "Kunne ikke hente profiler" }, 500);
  }
  const profileById = new Map((profileRows as RescueProfile[]).map((p) => [p.id, p]));

  const targets = users
    .map((u) => ({ user: u, profile: profileById.get(u.id) || null }))
    .map((t) => ({ ...t, group: rescueGroupFor(t.user, t.profile) }))
    .filter((t): t is typeof t & { group: RescueGroup } => t.group !== null)
    .slice(0, limit);

  const siteUrl = String(Deno.env.get("SITE_URL") || "https://www.padelmakker.dk").replace(/\/+$/, "");
  const unsubBase = `${Deno.env.get("SUPABASE_URL")}/functions/v1/email-unsubscribe`;
  const todayLabel = copenhagenDateLabel();
  const build = (t: (typeof targets)[number], unsubLink: string) =>
    buildSignupRescueEmail(t.group, t.user, t.profile, { siteUrl, unsubLink, cvr: CVR, todayLabel });

  if (dryRun) {
    const byGroup: Record<string, number> = {};
    const previews: Record<string, { subject: string; preheader: string; html: string }> = {};
    for (const t of targets) {
      byGroup[t.group] = (byGroup[t.group] || 0) + 1;
      if (!previews[t.group]) {
        const e = build(t, `${unsubBase}?t=UDKAST`);
        previews[t.group] = { subject: e.subject, preheader: e.preheader, html: e.html };
      }
    }
    return jsonResponse({ ok: true, dryRun: true, would_send: targets.length, by_group: byGroup, previews });
  }

  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  if (!resendApiKey) return jsonResponse({ error: "RESEND_API_KEY mangler" }, 500);
  const fromEmail = Deno.env.get("DISCOVERY_FROM_EMAIL") || Deno.env.get("FEEDBACK_FROM_EMAIL") || "PadelMakker <kontakt@padelmakker.dk>";

  const release = async (userId: string, kind: string) => {
    const { error } = await admin.rpc("release_email_send_slot", { p_user_id: userId, p_kind: kind });
    if (error) console.error(`send-signup-rescue release ${kind}:`, error.message);
  };

  let sent = 0, failed = 0, skippedDaily = 0, skippedAlready = 0, skippedNoToken = 0;
  const sentByGroup: Record<string, number> = {};
  for (const t of targets) {
    const userId = t.user.id;
    const toEmail = rescueEmailAddress(t.user);

    const { data: unsubToken, error: tokenErr } = await admin.rpc("email_unsub_token_for", { p_user_id: userId });
    if (tokenErr || !unsubToken) {
      skippedNoToken += 1;
      continue;
    }
    const unsubLink = `${unsubBase}?t=${encodeURIComponent(String(unsubToken))}`;
    const email = build(t, unsubLink);

    const { data: dailyOk, error: dailyErr } = await admin.rpc("claim_email_send_slot", {
      p_user_id: userId, p_kind: "discovery", p_min_interval: DAILY_MIN_INTERVAL,
    });
    if (dailyErr) { console.error("send-signup-rescue daily slot:", dailyErr.message); continue; }
    if (dailyOk !== true) { skippedDaily += 1; continue; }
    const { data: onceOk, error: onceErr } = await admin.rpc("claim_email_send_slot", {
      p_user_id: userId, p_kind: KIND, p_min_interval: ONCE_MIN_INTERVAL,
    });
    if (onceErr || onceOk !== true) {
      if (onceErr) console.error("send-signup-rescue once slot:", onceErr.message);
      else skippedAlready += 1;
      await release(userId, "discovery");
      continue;
    }

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: fromEmail,
        to: [toEmail],
        reply_to: "kontakt@padelmakker.dk",
        subject: email.subject,
        text: email.text,
        html: email.html,
        headers: { "List-Unsubscribe": `<${unsubLink}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
      }),
    });
    if (!res.ok) {
      console.error("send-signup-rescue resend:", res.status, (await res.text()).slice(0, 280));
      await release(userId, "discovery");
      await release(userId, KIND);
      failed += 1;
    } else {
      sent += 1;
      sentByGroup[t.group] = (sentByGroup[t.group] || 0) + 1;
    }
    await sleep(600);
  }

  return jsonResponse({
    ok: true, sent, failed, targets: targets.length, sent_by_group: sentByGroup,
    skipped_daily_cap: skippedDaily, skipped_already_sent: skippedAlready, skipped_no_unsub_token: skippedNoToken,
  });
});
