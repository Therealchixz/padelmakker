// Supabase Edge Function: send-reminders
// Cron-driven. Finds due match/tournament reminders (+ result nudges) via the
// public.get_due_reminders() SQL function, writes an in-app notification, and
// sends Web Push — reusing the same VAPID setup as send-push.
//
// Auth: caller MUST present the shared secret (x-cron-secret header) that is
// stored server-side in public.app_config — so only the scheduled job can
// trigger mass sends. verify_jwt is disabled because this custom check is used.
//
// Body (optional): { "dryRun": true } → returns what WOULD be sent, no writes.
//
// Secrets required (already set for send-push): VAPID_PUBLIC_KEY,
// VAPID_PRIVATE_KEY, VAPID_SUBJECT, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.

import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3";

type DueRow = {
  kind: "reminder_24h" | "reminder_1h" | "result_nudge";
  entity_type: "match" | "americano";
  entity_id: string;
  user_id: string;
  match_id: string | null;
  label: string | null;
  fmt: string | null;
  start_at: string;
};

function hhmmCph(iso: string): string {
  try {
    return new Intl.DateTimeFormat("da-DK", {
      timeZone: "Europe/Copenhagen",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return "";
  }
}

function tournamentLabel(fmt: string | null): string {
  return String(fmt || "").toLowerCase() === "mexicano" ? "Mexicano" : "Americano";
}

function buildContent(row: DueRow): { title: string; body: string } {
  const hhmm = hhmmCph(row.start_at);
  const onCourt = row.label ? ` på ${row.label}` : "";
  if (row.kind === "result_nudge") {
    return {
      title: "Husk at indtaste resultat 🎾",
      body: `Indtast resultatet fra din kamp${onCourt}.`,
    };
  }
  if (row.entity_type === "americano") {
    const fmt = tournamentLabel(row.fmt);
    const name = row.label || fmt;
    return row.kind === "reminder_24h"
      ? { title: `${fmt} i morgen 🎾`, body: `${name} er i morgen kl. ${hhmm}.` }
      : { title: `${fmt} om 1 time 🎾`, body: `${name} starter kl. ${hhmm}.` };
  }
  return row.kind === "reminder_24h"
    ? { title: "Kamp i morgen 🎾", body: `Din padelkamp${onCourt} er i morgen kl. ${hhmm}.` }
    : { title: "Kamp om 1 time 🎾", body: `Din padelkamp${onCourt} starter kl. ${hhmm}.` };
}

function notifTypeFor(row: DueRow): string {
  if (row.kind === "result_nudge") return "result_nudge";
  return row.entity_type === "americano" ? "tournament_reminder" : "match_reminder";
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

  // Service client (auto-injected env) for DB access + auth-secret lookup.
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey);

  // Shared-secret auth: only the scheduled job knows the secret in app_config.
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
    /* no body → live run */
  }

  const { data: due, error: dueErr } = await admin.rpc("get_due_reminders");
  if (dueErr) {
    console.error("get_due_reminders failed:", dueErr.message);
    return jsonResponse({ error: "Internal error" }, 500);
  }
  const rows = (due || []) as DueRow[];

  if (dryRun) {
    return jsonResponse({
      dryRun: true,
      due: rows.length,
      sample: rows.slice(0, 20).map((r) => ({
        kind: r.kind,
        entity_type: r.entity_type,
        user_id: r.user_id,
        ...buildContent(r),
      })),
    });
  }

  if (rows.length === 0) {
    return jsonResponse({ sent: 0, notified: 0, due: 0 });
  }

  webpush.setVapidDetails(
    Deno.env.get("VAPID_SUBJECT") || "mailto:hej@padelmakker.dk",
    Deno.env.get("VAPID_PUBLIC_KEY")!,
    Deno.env.get("VAPID_PRIVATE_KEY")!,
  );

  let notified = 0;
  let pushed = 0;

  for (const row of rows) {
    // Atomic claim — first writer wins, prevents double-send across overlapping runs.
    const { error: claimErr } = await admin.from("reminder_log").insert({
      entity_type: row.entity_type,
      entity_id: row.entity_id,
      kind: row.kind,
      user_id: row.user_id,
    });
    if (claimErr) {
      // 23505 = already claimed → skip silently; anything else → log + skip.
      if (claimErr.code !== "23505") console.warn("claim failed:", claimErr.message);
      continue;
    }

    const { title, body } = buildContent(row);
    const isAmericano = row.entity_type === "americano";
    const matchId = isAmericano ? null : row.match_id;
    const entityType = isAmericano ? "americano" : null;
    const entityId = isAmericano ? row.entity_id : null;

    // In-app notification (service role bypasses RLS).
    const { error: notifErr } = await admin.from("notifications").insert({
      user_id: row.user_id,
      type: notifTypeFor(row),
      title,
      body,
      match_id: matchId,
      entity_type: entityType,
      entity_id: entityId,
      read: false,
    });
    if (notifErr) {
      console.warn("notification insert failed:", notifErr.message);
    } else {
      notified++;
    }

    // Respect the user's push prefs for the 'kampe' channel.
    const { data: prof } = await admin
      .from("profiles")
      .select("notification_prefs")
      .eq("id", row.user_id)
      .maybeSingle();
    const prefs = (prof?.notification_prefs ?? null) as Record<string, unknown> | null;
    // Master push level: 'off' suppresses push (in-app only). Reminders count as
    // "important", so 'important' still pushes them.
    const pushLevel = typeof prefs?.pushLevel === "string" ? prefs.pushLevel : "all";
    if (pushLevel === "off") {
      continue; // in-app only
    }
    const pushBucket =
      prefs && typeof prefs === "object" && prefs.push && typeof prefs.push === "object"
        ? (prefs.push as Record<string, boolean>)
        : null;
    if (pushBucket && pushBucket.kampe === false) {
      continue; // in-app only
    }

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
      matchId,
      entityType,
      entityId,
      type: notifTypeFor(row),
      channel: "kampe",
      level: "normal",
      silent: false,
      renotify: false,
      tag: `pm:reminder:${row.entity_id}:${row.kind}`,
      unreadCount,
    });

    const expired: string[] = [];
    await Promise.all(
      subs.map(async (sub) => {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            payload,
            { TTL: 1800, urgency: "normal" },
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
