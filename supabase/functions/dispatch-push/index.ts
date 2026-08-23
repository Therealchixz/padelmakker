// Intern push-dispatch (cron-secret). Bruges til makker-match m.m. når
// afsenderen ikke sidder i appen — send-push kræver ellers et user-JWT.
//
// Auth: Authorization Bearer (gateway) + x-cron-secret = app_config.reminder_cron_secret
// Body: { targetUserId, title, body, type?, entityType?, entityId? }

import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3";

function jsonResponse(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function siteOrigin() {
  return (Deno.env.get("SITE_URL") || "https://www.padelmakker.dk").replace(/\/+$/, "");
}

function navigateForType(type: string) {
  const origin = siteOrigin();
  if (type === "match_proposal" || type === "match_proposal_reminder") {
    return `${origin}/dashboard/hjem`;
  }
  if (type === "makker_suggestion") return `${origin}/dashboard/makkere`;
  return `${origin}/dashboard`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
        "Access-Control-Allow-Methods": "POST,OPTIONS",
      },
    });
  }
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const provided = req.headers.get("x-cron-secret") || "";
  const { data: cfg } = await admin
    .from("app_config")
    .select("value")
    .eq("key", "reminder_cron_secret")
    .maybeSingle();
  if (!cfg?.value || provided.length < 16 || provided !== cfg.value) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  let payload: {
    targetUserId?: string;
    title?: string;
    body?: string;
    type?: string;
    entityType?: string;
    entityId?: string;
  };
  try {
    payload = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON" }, 400);
  }

  const targetUserId = String(payload.targetUserId || "").trim();
  const title = String(payload.title || "").trim();
  const body = String(payload.body || "");
  const type = String(payload.type || "makker_suggestion");
  const entityType = payload.entityType ? String(payload.entityType) : null;
  const entityId = payload.entityId ? String(payload.entityId) : null;
  if (!targetUserId || !title) {
    return jsonResponse({ error: "targetUserId and title are required" }, 400);
  }
  const isProposal = type === "match_proposal" || type === "match_proposal_reminder";
  const channel = isProposal ? "invitation" : "opdagelse";
  const level = isProposal ? "critical" : "normal";

  const { data: subs, error: subsError } = await admin
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .eq("user_id", targetUserId);
  if (subsError) {
    console.error("push_subscriptions fetch failed:", subsError.message);
    return jsonResponse({ error: "Internal error" }, 500);
  }
  if (!subs || subs.length === 0) {
    return jsonResponse({ sent: 0, skipped: "no_subscription" });
  }

  webpush.setVapidDetails(
    Deno.env.get("VAPID_SUBJECT") || "mailto:hej@padelmakker.dk",
    Deno.env.get("VAPID_PUBLIC_KEY")!,
    Deno.env.get("VAPID_PRIVATE_KEY")!,
  );

  let unreadCount: number | null = null;
  try {
    const { count } = await admin
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", targetUserId)
      .eq("read", false);
    if (typeof count === "number") unreadCount = count;
  } catch {
    /* ignore */
  }

  const tag = `pm:${channel}:${type}:${entityId || "x"}:${Date.now()}`;
  const origin = siteOrigin();
  const notification: Record<string, unknown> = {
    title,
    lang: "da-DK",
    dir: "ltr",
    body,
    navigate: navigateForType(type),
    silent: false,
    renotify: true,
    tag,
    icon: `${origin}/icon-192-v2.png`,
  };
  if (typeof unreadCount === "number" && unreadCount > 0) {
    notification.app_badge = unreadCount;
  }
  // web_push: 8030 = Declarative Web Push. iOS viser låseskærmen selv hvis
  // service workeren er død eller ITP har slettet den.
  const pushPayload = JSON.stringify({
    web_push: 8030,
    notification,
    title,
    body,
    matchId: null,
    entityType,
    entityId,
    type,
    channel,
    level,
    silent: false,
    renotify: true,
    tag,
    unreadCount,
  });

  let sent = 0;
  const expired: string[] = [];
  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          pushPayload,
          { TTL: 3600, urgency: "high" },
        );
        sent++;
      } catch (err: unknown) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) expired.push(sub.endpoint);
        else console.warn("push send failed:", err);
      }
    }),
  );
  if (expired.length) {
    await admin.from("push_subscriptions").delete().in("endpoint", expired);
  }

  return jsonResponse({ sent });
});
