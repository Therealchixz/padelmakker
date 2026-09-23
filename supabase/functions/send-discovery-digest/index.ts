// Supabase Edge Function: send-discovery-digest
// Daglig opsummering kl. 17 dansk tid: nye kampe og makkere, der passer.
//
// Hvorfor: der sendes højst én mail om dagen (claim_email_send_slot, nøgle
// "discovery"). Før blev hver opdagelse sendt med det samme, så den ANDEN
// opdagelse samme dag aldrig nåede frem til de brugere, der kun har mail
// (96 af 98 — push kræver installeret PWA). Nu samles de i én mail.
//
// Kampe der spilles i dag eller i morgen sendes stadig med det samme af
// send-discovery-email; alt andet venter til her.
//
// Cron: kører kl. 15 og 16 UTC og sender kun, når klokken er 17 i København,
// så tidspunktet holder både sommer- og vintertid.
//
// Auth: x-cron-secret (samme som send-reminders / app_config.reminder_cron_secret).
// Body (valgfri): { "dryRun": true } returnerer hvad der VILLE blive sendt.
//                 { "force": true }  ignorerer klokkeslæt-tjekket (manuel kørsel).

import { createClient } from "npm:@supabase/supabase-js@2";
import { buildDigestEmail, copenhagenHour, DIGEST_LOCAL_HOUR, type DigestItem } from "./content.ts";

const CVR = "46403193";
// Lidt under et døgn, så cron-kørslen kl. 17 i morgen ikke rammer spærren med
// få sekunder. Det er stadig højst én mail pr. kalenderdag.
const DIGEST_MIN_INTERVAL = "23 hours";

type Candidate = { user_id: string; items: DigestItem[] };

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey);

  const provided = req.headers.get("x-cron-secret") || "";
  const { data: cfg } = await admin
    .from("app_config")
    .select("value")
    .eq("key", "reminder_cron_secret")
    .maybeSingle();
  if (!cfg?.value || provided.length < 16 || provided !== cfg.value) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  let dryRun = false;
  let force = false;
  try {
    const body = await req.json();
    dryRun = body?.dryRun === true;
    force = body?.force === true;
  } catch {
    /* ingen krop → almindelig kørsel */
  }

  const hour = copenhagenHour();
  if (!force && hour !== DIGEST_LOCAL_HOUR) {
    return jsonResponse({ ok: true, sent: 0, skipped: "not_digest_hour", copenhagen_hour: hour });
  }

  const { data: candidates, error: candErr } = await admin.rpc("get_discovery_digest_candidates");
  if (candErr) {
    console.error("send-discovery-digest candidates:", candErr.message);
    return jsonResponse({ error: "Kunne ikke hente kandidater" }, 500);
  }
  const rows = (candidates || []) as Candidate[];

  const siteUrl = String(Deno.env.get("SITE_URL") || "https://www.padelmakker.dk").replace(/\/+$/, "");
  const unsubBase = `${Deno.env.get("SUPABASE_URL")}/functions/v1/email-unsubscribe`;

  if (dryRun) {
    return jsonResponse({
      ok: true,
      dryRun: true,
      candidates: rows.map((r) => ({ user_id: r.user_id, items: (r.items || []).length })),
    });
  }

  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  if (!resendApiKey) {
    return jsonResponse({ error: "RESEND_API_KEY mangler" }, 500);
  }
  const fromEmail =
    Deno.env.get("DISCOVERY_FROM_EMAIL") ||
    Deno.env.get("FEEDBACK_FROM_EMAIL") ||
    "PadelMakker <kontakt@padelmakker.dk>";

  let sent = 0;
  let skippedByCap = 0;
  for (const row of rows) {
    const userId = row.user_id;
    const { data: authUser, error: authErr } = await admin.auth.admin.getUserById(userId);
    const toEmail = String(authUser?.user?.email || "").trim();
    if (authErr || !toEmail) continue;

    // Uden et frameldingslink sender vi ikke.
    const { data: unsubToken, error: tokenErr } = await admin.rpc("email_unsub_token_for", {
      p_user_id: userId,
    });
    if (tokenErr || !unsubToken) {
      console.error("send-discovery-digest: intet frameldingstoken, springer over:", tokenErr?.message || "tomt token");
      continue;
    }
    const unsubLink = `${unsubBase}?t=${encodeURIComponent(String(unsubToken))}`;

    const email = buildDigestEmail(row.items || [], { siteUrl, unsubLink, cvr: CVR });
    if (!email) continue;

    // Samme daglige spærre som alle andre mails (nøglen "discovery"). Har
    // brugeren allerede fået en mail i dag, venter nyhederne til i morgen —
    // de er ikke markeret som sendt, så de kommer med næste gang.
    const { data: slotOk, error: slotErr } = await admin.rpc("claim_email_send_slot", {
      p_user_id: userId,
      p_kind: "discovery",
      p_min_interval: DIGEST_MIN_INTERVAL,
    });
    if (slotErr) {
      console.error("send-discovery-digest slot:", slotErr.message);
      continue;
    }
    if (slotOk !== true) {
      skippedByCap += 1;
      continue;
    }

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: fromEmail,
        to: [toEmail],
        subject: email.subject,
        text: email.text,
        html: email.html,
        headers: {
          "List-Unsubscribe": `<${unsubLink}>`,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        },
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("send-discovery-digest resend:", res.status, errText.slice(0, 280));
      // Giv dagens plads tilbage, så en fejlet mail ikke koster en hel dag.
      const { error: releaseErr } = await admin.rpc("release_email_send_slot", {
        p_user_id: userId,
        p_kind: "discovery",
      });
      if (releaseErr) console.error("send-discovery-digest release:", releaseErr.message);
      continue;
    }

    // Markér som sendt, så samme nyhed ikke kommer igen i morgen.
    const { error: markErr } = await admin
      .from("notifications")
      .update({ emailed_at: new Date().toISOString() })
      .in("id", email.itemIds)
      .eq("user_id", userId);
    if (markErr) console.error("send-discovery-digest mark emailed:", markErr.message);
    sent += 1;
  }

  return jsonResponse({ ok: true, sent, candidates: rows.length, skipped_by_daily_cap: skippedByCap });
});
