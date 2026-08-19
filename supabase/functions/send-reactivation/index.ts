// Supabase Edge Function: send-reactivation
// Ugentlig cron. Finder sovende brugere (0 kampe) med åbne kampe nær deres by
// via get_due_reactivation_nudges(), sender in-app + Web Push.
//
// Auth: x-cron-secret (samme som send-reminders / app_config.reminder_cron_secret).
// Body (optional): { "dryRun": true }

import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3";

type DueRow = {
  user_id: string;
  city_label: string | null;
  open_count: number;
  week_start: string;
};

const KIND = "open_matches_weekly";
const NOTIF_TYPE = "open_matches_weekly";

function buildContent(row: DueRow): { title: string; body: string } {
  const city = String(row.city_label || "dit område").trim();
  const count = Math.max(0, Number(row.open_count) || 0);
  const noun = count === 1 ? "kamp" : "kampe";
  return {
    title: `Åbne kampe nær ${city} 🎾`,
    body: `Der er ${count} åbne ${noun} denne uge — find din første kamp.`,
  };
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

    const pushBucket =
      prefs && typeof prefs === "object" && prefs.push && typeof prefs.push === "object"
        ? (prefs.push as Record<string, boolean>)
        : null;
    if (pushBucket && pushBucket.opdagelse === false) continue;

    const { data: subs } = await admin
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth")
      .eq("user_id", row.user_id);
    if (!subs || subs.length === 0) continue;

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

  return jsonResponse({ due: rows.length, notified, pushed });
});
