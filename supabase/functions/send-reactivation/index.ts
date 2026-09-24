// Supabase Edge Function: send-reactivation
// Ugentlig cron. Finder sovende brugere (0 kampe) med noget at komme tilbage
// til naer deres by via get_due_reactivation_nudges(), og sender in-app besked
// plus Web Push ELLER e-mail.
//
// Hvorfor e-mail: funktionen har koert hver dag i maanedsvis og naaet NUL
// mennesker. Den kraevede en push-abonnering, og push kraever at appen er
// installeret som PWA - det har 2 ud af 98 gjort. For alle andre er mail den
// eneste kanal, der findes.
//
// Auth: x-cron-secret (samme som send-reminders / app_config.reminder_cron_secret).
// Body (optional): { "dryRun": true }

import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3";

type DueRow = {
  user_id: string;
  city_label: string | null;
  open_count: number;
  seeking_count: number;
  has_push: boolean;
  week_start: string;
};

const KIND = "open_matches_weekly";
const NOTIF_TYPE = "open_matches_weekly";

function plural(n: number, ental: string, flertal: string) {
  return n === 1 ? ental : flertal;
}

/**
 * Teksten afhaenger af, hvad der faktisk ER at komme tilbage til.
 *
 * Foer naevnte den kun aabne kampe. Der er nul af dem lige nu, mens 17
 * spillere soeger makker - saa paamindelsen havde aldrig noget at sige.
 */
function buildContent(row: DueRow): { title: string; body: string } {
  const city = String(row.city_label || "dit område").trim();
  const kampe = Math.max(0, Number(row.open_count) || 0);
  const makkere = Math.max(0, Number(row.seeking_count) || 0);

  if (kampe > 0 && makkere > 0) {
    return {
      title: `Der sker noget nær ${city} 🎾`,
      body: `${kampe} åbne ${plural(kampe, "kamp", "kampe")} og `
        + `${makkere} ${plural(makkere, "spiller der søger makker", "spillere der søger makker")}.`,
    };
  }

  if (makkere > 0) {
    return {
      title: `${makkere} søger makker nær ${city} 🎾`,
      body: `${makkere} ${plural(makkere, "spiller leder", "spillere leder")} efter en makker i dit område `
        + `— se hvem, og skriv til dem.`,
    };
  }

  return {
    title: `Åbne kampe nær ${city} 🎾`,
    body: `Der er ${kampe} åbne ${plural(kampe, "kamp", "kampe")} denne uge — find din første kamp.`,
  };
}

/**
 * Sender paamindelsen som e-mail. Bruger samme framelding med ét klik som
 * opdagelses-mailen: uden et link ud sender vi ikke - en mail man ikke kan
 * komme af med, ender som spam-markering, og nok af dem faar hele domaenets
 * mails filtreret fra.
 */
async function sendReactivationEmail(
  userId: string,
  title: string,
  body: string,
): Promise<"sent" | "skipped" | "failed"> {
  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  if (!resendApiKey) {
    console.error("send-reactivation: RESEND_API_KEY mangler");
    return "failed";
  }

  // Egen klient her, saa hjaelperen er selvstaendig og ikke skal have en
  // gennemtypet klient sendt ind udefra.
  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  const { data: authUser, error: authErr } = await admin.auth.admin.getUserById(userId);
  const toEmail = String(authUser?.user?.email || "").trim();
  if (authErr || !toEmail) return "skipped";

  const { data: unsubToken, error: tokenErr } = await admin.rpc("email_unsub_token_for", {
    p_user_id: userId,
  });
  if (tokenErr || !unsubToken) {
    console.error(
      "send-reactivation: intet frameldingstoken, springer over:",
      tokenErr?.message || "tomt token",
    );
    return "skipped";
  }

  // Samme daglige spaerre som opdagelses-mailen, og BEVIDST samme noegle:
  // paa /opret lover vi "hoejst én om dagen". Havde paamindelsen sin egen
  // spaerre, kunne den samme dag laegge en mail nummer to oveni, og loeftet
  // ville vaere usandt. Nu er det loeftet, der bestemmer.
  const { data: slotOk, error: slotErr } = await admin.rpc("claim_email_send_slot", {
    p_user_id: userId,
    p_kind: "discovery",
  });
  if (slotErr) {
    console.error("send-reactivation slot:", slotErr.message);
    return "failed";
  }
  if (slotOk !== true) return "skipped";

  const siteUrl = String(Deno.env.get("SITE_URL") || "https://www.padelmakker.dk").replace(/\/+$/, "");
  const unsubLink = `${Deno.env.get("SUPABASE_URL")}/functions/v1/email-unsubscribe`
    + `?t=${encodeURIComponent(String(unsubToken))}`;
  // ?kilde=paamindelse: se log_app_return - maaler om mailen faar folk tilbage.
  const link = `${siteUrl}/dashboard/makkere?kilde=paamindelse`;
  const fromEmail =
    Deno.env.get("DISCOVERY_FROM_EMAIL") ||
    Deno.env.get("FEEDBACK_FROM_EMAIL") ||
    "PadelMakker <kontakt@padelmakker.dk>";

  const esc = (v: string) =>
    v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  const textBody =
    `${title}\n\n${body}\n\nSe hvem: ${link}\n\n`
    + `Du får denne mail, fordi du har en profil på PadelMakker, og besked om nye\n`
    + `makkere og kampe er slået til på din konto.\n`
    + `Afmeld med ét klik: ${unsubLink}\n\n`
    + `PadelMakker · CVR 46403193 · ${siteUrl}/privatlivspolitik`;

  const htmlBody = `
    <div style="font-family:system-ui,Segoe UI,Arial,sans-serif;line-height:1.5;color:#111;max-width:560px">
      <p style="margin:0 0 4px;font-size:13px;color:#666">PadelMakker</p>
      <h1 style="margin:0 0 12px;font-size:18px;font-weight:700">${esc(title)}</h1>
      <p style="margin:0 0 16px">${esc(body)}</p>
      <p style="margin:0 0 24px">
        <a href="${esc(link)}" style="display:inline-block;padding:10px 16px;background:#0B6E4F;color:#fff;text-decoration:none;border-radius:8px;font-weight:600">
          Se hvem der søger
        </a>
      </p>
      <p style="margin:0 0 6px;font-size:12px;color:#666">
        Du får denne mail, fordi du har en profil på PadelMakker, og besked om nye makkere
        og kampe er slået til på din konto.
        <a href="${esc(unsubLink)}" style="color:#0B6E4F">Afmeld</a>
      </p>
      <p style="margin:0;font-size:11px;color:#888">
        PadelMakker · CVR 46403193 ·
        <a href="${esc(siteUrl)}/privatlivspolitik" style="color:#888">Privatlivspolitik</a>
      </p>
    </div>
  `.trim();

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${resendApiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: fromEmail,
      to: [toEmail],
      subject: title,
      text: textBody,
      html: htmlBody,
      headers: {
        // RFC 8058: giver Gmail og Outlook deres egen afmeld-knap i toppen.
        "List-Unsubscribe": `<${unsubLink}>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      },
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error("send-reactivation resend:", res.status, errText.slice(0, 280));
    // Pladsen blev taget foer afsendelsen. Uden denne ville en fejlet mail
    // blokere morgendagens rigtige mail.
    const { error: releaseErr } = await admin.rpc("release_email_send_slot", {
      p_user_id: userId,
      p_kind: "discovery",
    });
    if (releaseErr) console.error("send-reactivation release:", releaseErr.message);
    return "failed";
  }
  return "sent";
}

function jsonResponse(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
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
  try {
    const body = await req.json();
    dryRun = body?.dryRun === true;
  } catch {
    /* no body */
  }

  const { data: due, error: dueErr } = await admin.rpc("get_due_reactivation_nudges");
  if (dueErr) {
    console.error("get_due_reactivation_nudges failed:", dueErr.message);
    return jsonResponse({ error: "Internal error" }, 500);
  }
  const rows = (due || []) as DueRow[];

  if (dryRun) {
    return jsonResponse({
      dryRun: true,
      due: rows.length,
      sample: rows.slice(0, 20).map((r) => ({
        user_id: r.user_id,
        open_count: r.open_count,
        seeking_count: r.seeking_count,
        kanal: r.has_push ? "push" : "mail",
        city_label: r.city_label,
        ...buildContent(r),
      })),
    });
  }

  if (rows.length === 0) {
    return jsonResponse({ sent: 0, notified: 0, pushed: 0, due: 0 });
  }

  webpush.setVapidDetails(
    Deno.env.get("VAPID_SUBJECT") || "mailto:hej@padelmakker.dk",
    Deno.env.get("VAPID_PUBLIC_KEY")!,
    Deno.env.get("VAPID_PRIVATE_KEY")!,
  );

  let notified = 0;
  let pushed = 0;
  let mailed = 0;

  for (const row of rows) {
    const { error: claimErr } = await admin.from("reactivation_log").insert({
      user_id: row.user_id,
      kind: KIND,
      week_start: row.week_start,
    });
    if (claimErr) {
      if (claimErr.code !== "23505") console.warn("reactivation claim failed:", claimErr.message);
      continue;
    }

    const { title, body } = buildContent(row);

    const { error: notifErr } = await admin.from("notifications").insert({
      user_id: row.user_id,
      type: NOTIF_TYPE,
      title,
      body,
      match_id: null,
      entity_type: null,
      entity_id: null,
      read: false,
    });
    if (notifErr) {
      console.warn("notification insert failed:", notifErr.message);
    } else {
      notified++;
    }

    const { data: prof } = await admin
      .from("profiles")
      .select("notification_prefs")
      .eq("id", row.user_id)
      .maybeSingle();
    const prefs = (prof?.notification_prefs ?? null) as Record<string, unknown> | null;
    const pushLevel = typeof prefs?.pushLevel === "string" ? prefs.pushLevel : "all";
    if (pushLevel === "off") continue;

    const reactivationFreq =
      typeof prefs?.reactivationOpenMatches === "string" ? prefs.reactivationOpenMatches : "weekly";
    if (reactivationFreq === "off") continue;

    const { data: subs } = await admin
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth")
      .eq("user_id", row.user_id);

    // Uden push: send mail i stedet. Det er hele pointen med denne aendring -
    // 96 af 98 brugere har ikke push, og for dem fandtes paamindelsen ikke.
    if (!subs || subs.length === 0) {
      const emailPrefs = (prefs?.email ?? null) as Record<string, unknown> | null;
      if (emailPrefs?.opdagelse !== true) continue;
      const outcome = await sendReactivationEmail(row.user_id, title, body);
      if (outcome === "sent") mailed++;
      continue;
    }

    let unreadCount: number | null = null;
    try {
      const { count } = await admin
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", row.user_id)
        .eq("read", false);
      if (typeof count === "number") unreadCount = count;
    } catch { /* ignore */ }

    const payload = JSON.stringify({
      title,
      body,
      matchId: null,
      entityType: null,
      entityId: null,
      type: NOTIF_TYPE,
      channel: "opdagelse",
      level: "normal",
      silent: true,
      renotify: false,
      tag: `pm:reactivation:${row.week_start}`,
      unreadCount,
    });

    const expired: string[] = [];
    await Promise.all(
      subs.map(async (sub) => {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            payload,
            { TTL: 86400, urgency: "low" },
          );
          pushed++;
        } catch (err: unknown) {
          const status = (err as { statusCode?: number }).statusCode;
          if (status === 404 || status === 410) expired.push(sub.endpoint);
          else console.warn("push failed:", err);
        }
      }),
    );
    if (expired.length) {
      await admin.from("push_subscriptions").delete().in("endpoint", expired);
    }
  }

  return jsonResponse({ due: rows.length, notified, pushed, mailed });
});
