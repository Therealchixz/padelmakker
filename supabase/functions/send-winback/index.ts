// Supabase Edge Function: send-winback
// Engangsmail til dem, der ikke har været inde i appen i 30 dage.
//
// Målt 24. sep. 2026: 79 af 99 brugere har ikke været inde i 30 dage, 58 af
// dem kun den dag, de oprettede sig. Mailen viser kampe og spillere på deres
// niveau i nærheden (get_winback_candidates) og det nye i appen.
//
// Kører IKKE af sig selv - der er intet cron-job. Den startes manuelt, når
// ejeren har set udkastet og sagt ja.
//
// Spærrer:
//   - højst én mail om dagen i alt (claim_email_send_slot, nøgle "discovery")
//   - højst én engangsmail pr. person om året (nøgle "winback", 365 dage)
//
// Auth: x-cron-secret (app_config.reminder_cron_secret).
// Body (valgfri):
//   { "dryRun": true }        tæller og viser udkast, sender intet
//   { "includeEmpty": true }  send også til dem uden kampe/spillere i nærheden
//   { "limit": 100 }          højst så mange mails i denne kørsel

import { createClient } from "npm:@supabase/supabase-js@2";
import {
  buildWinbackEmail,
  copenhagenDateLabel,
  type DigestMatch,
  type DigestPlayer,
} from "../send-discovery-digest/content.ts";

const CVR = "46403193";
const DAILY_MIN_INTERVAL = "23 hours";
const WINBACK_MIN_INTERVAL = "365 days";

type Candidate = {
  user_id: string;
  first_name: string | null;
  region: string | null;
  match_ids: string[] | null;
  player_ids: string[] | null;
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

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
  let includeEmpty = false;
  let limit = 100;
  try {
    const body = await req.json();
    dryRun = body?.dryRun === true;
    includeEmpty = body?.includeEmpty === true;
    if (Number.isFinite(Number(body?.limit)) && Number(body.limit) > 0) {
      limit = Math.min(500, Math.floor(Number(body.limit)));
    }
  } catch {
    /* ingen krop */
  }

  const { data: candidates, error: candErr } = await admin.rpc("get_winback_candidates", {
    p_inactive_days: 30,
  });
  if (candErr) {
    console.error("send-winback candidates:", candErr.message);
    return jsonResponse({ error: "Kunne ikke hente modtagere" }, 500);
  }
  const all = (candidates || []) as Candidate[];

  // Detaljer til kortene: kampene, deres opretter og spillerne. Hentes samlet.
  const matchIds = new Set<string>();
  const profileIds = new Set<string>();
  for (const row of all) {
    for (const id of row.match_ids || []) matchIds.add(id);
    for (const id of row.player_ids || []) profileIds.add(id);
  }
  const matchesById: Record<string, DigestMatch> = {};
  if (matchIds.size) {
    const { data: matchRows, error: matchErr } = await admin
      .from("matches")
      .select("id, date, time, time_end, court_name, court_id, level_range, current_players, max_players, price_per_person, creator_id")
      .in("id", [...matchIds]);
    if (matchErr) console.error("send-winback matches:", matchErr.message);
    for (const m of (matchRows || []) as DigestMatch[]) {
      matchesById[m.id] = m;
      if (m.creator_id) profileIds.add(m.creator_id);
    }
  }
  const playersById: Record<string, DigestPlayer> = {};
  if (profileIds.size) {
    const { data: profileRows, error: profileErr } = await admin
      .from("profiles")
      .select("id, full_name, name, level, area, court_side")
      .in("id", [...profileIds]);
    if (profileErr) console.error("send-winback profiles:", profileErr.message);
    for (const p of (profileRows || []) as DigestPlayer[]) playersById[p.id] = p;
  }

  const siteUrl = String(Deno.env.get("SITE_URL") || "https://www.padelmakker.dk").replace(/\/+$/, "");
  const unsubBase = `${Deno.env.get("SUPABASE_URL")}/functions/v1/email-unsubscribe`;
  const todayLabel = copenhagenDateLabel();
  const details = { matches: matchesById, players: playersById, todayLabel };

  const build = (row: Candidate, unsubLink: string) =>
    buildWinbackEmail(
      { matchIds: row.match_ids || [], playerIds: row.player_ids || [] },
      { siteUrl, unsubLink, cvr: CVR, kilde: "winback" },
      { ...details, recipientName: row.first_name },
    );

  const drafts = all.map((row) => ({ row, email: build(row, `${unsubBase}?t=UDKAST`) }));
  const withItems = drafts.filter((d) => d.email.matchCount + d.email.playerCount > 0);
  const targets = (includeEmpty ? drafts : withItems).slice(0, limit);

  if (dryRun) {
    const firstWith = withItems[0]?.email;
    const firstWithout = drafts.find((d) => d.email.matchCount + d.email.playerCount === 0)?.email;
    return jsonResponse({
      ok: true,
      dryRun: true,
      reachable: all.length,
      with_items: withItems.length,
      with_match: drafts.filter((d) => d.email.matchCount > 0).length,
      with_player: drafts.filter((d) => d.email.playerCount > 0).length,
      without_items: drafts.length - withItems.length,
      would_send: targets.length,
      subjects: targets.slice(0, 20).map((d) => d.email.subject),
      preview_with_items: firstWith ? { subject: firstWith.subject, preheader: firstWith.preheader, html: firstWith.html } : null,
      preview_without_items: firstWithout
        ? { subject: firstWithout.subject, preheader: firstWithout.preheader, html: firstWithout.html }
        : null,
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

  const release = async (userId: string, kind: string) => {
    const { error } = await admin.rpc("release_email_send_slot", { p_user_id: userId, p_kind: kind });
    if (error) console.error(`send-winback release ${kind}:`, error.message);
  };

  let sent = 0;
  let skippedDaily = 0;
  let skippedAlready = 0;
  let failed = 0;
  for (const { row } of targets) {
    const userId = row.user_id;
    const { data: authUser, error: authErr } = await admin.auth.admin.getUserById(userId);
    const toEmail = String(authUser?.user?.email || "").trim();
    if (authErr || !toEmail) continue;

    // Uden et frameldingslink sender vi ikke.
    const { data: unsubToken, error: tokenErr } = await admin.rpc("email_unsub_token_for", { p_user_id: userId });
    if (tokenErr || !unsubToken) {
      console.error("send-winback: intet frameldingstoken:", tokenErr?.message || "tomt token");
      continue;
    }
    const unsubLink = `${unsubBase}?t=${encodeURIComponent(String(unsubToken))}`;
    const email = build(row, unsubLink);

    // Løftet "højst én mail om dagen" gælder også her.
    const { data: dailyOk, error: dailyErr } = await admin.rpc("claim_email_send_slot", {
      p_user_id: userId,
      p_kind: "discovery",
      p_min_interval: DAILY_MIN_INTERVAL,
    });
    if (dailyErr) {
      console.error("send-winback daily slot:", dailyErr.message);
      continue;
    }
    if (dailyOk !== true) {
      skippedDaily += 1;
      continue;
    }
    const { data: onceOk, error: onceErr } = await admin.rpc("claim_email_send_slot", {
      p_user_id: userId,
      p_kind: "winback",
      p_min_interval: WINBACK_MIN_INTERVAL,
    });
    if (onceErr || onceOk !== true) {
      if (onceErr) console.error("send-winback once slot:", onceErr.message);
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
      console.error("send-winback resend:", res.status, errText.slice(0, 280));
      await release(userId, "discovery");
      await release(userId, "winback");
      failed += 1;
    } else {
      sent += 1;
    }
    // Resend tillader et par mails i sekundet; hold god afstand.
    await sleep(600);
  }

  return jsonResponse({
    ok: true,
    sent,
    failed,
    targets: targets.length,
    skipped_daily_cap: skippedDaily,
    skipped_already_sent: skippedAlready,
  });
});
