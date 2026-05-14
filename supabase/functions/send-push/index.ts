// Supabase Edge Function: send-push
// Sends browser push notifications to all devices for a target user.
//
// Secrets required in Supabase Dashboard -> Edge Functions -> Secrets:
//   VAPID_PUBLIC_KEY
//   VAPID_PRIVATE_KEY
//   VAPID_SUBJECT (e.g. "mailto:hej@padelmakker.dk")
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY

import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3";

const defaultAllowedOrigins = [
  "https://padelmakker.dk",
  "https://www.padelmakker.dk",
];

const PUSH_LEVELS = new Set(["critical", "normal", "quiet"]);
const PUSH_URGENCIES = new Set(["high", "normal", "low", "very-low"]);

type PushPolicy = {
  channel: string;
  level: "critical" | "normal" | "quiet";
  sendPush: boolean;
  silent: boolean;
  urgency: "high" | "normal" | "low" | "very-low";
  cooldownSeconds: number;
  aggregate: boolean;
  renotify: boolean;
};

const DEFAULT_PUSH_POLICY: PushPolicy = Object.freeze({
  channel: "system",
  level: "normal",
  sendPush: true,
  silent: true,
  urgency: "normal",
  cooldownSeconds: 30,
  aggregate: false,
  renotify: false,
});

const PUSH_POLICY_BY_TYPE: Record<string, Partial<PushPolicy>> = Object.freeze({
  match_cancelled: {
    channel: "kampe",
    level: "critical",
    sendPush: true,
    silent: false,
    urgency: "high",
    cooldownSeconds: 20,
    renotify: true,
  },
  result_submitted: {
    channel: "resultat",
    level: "critical",
    sendPush: true,
    silent: false,
    urgency: "high",
    cooldownSeconds: 20,
    renotify: true,
  },
  match_invite: {
    channel: "invitation",
    level: "critical",
    sendPush: true,
    silent: false,
    urgency: "high",
    cooldownSeconds: 30,
    renotify: true,
  },
  result_confirmed: {
    channel: "resultat",
    level: "normal",
    sendPush: true,
    silent: true,
    urgency: "normal",
    cooldownSeconds: 45,
  },
  match_join: {
    channel: "kampe",
    level: "normal",
    sendPush: true,
    silent: true,
    urgency: "normal",
    cooldownSeconds: 45,
  },
  match_full: {
    channel: "kampe",
    level: "normal",
    sendPush: true,
    silent: true,
    urgency: "normal",
    cooldownSeconds: 60,
  },
  match_chat: {
    channel: "chat",
    level: "normal",
    sendPush: true,
    silent: true,
    urgency: "normal",
    cooldownSeconds: 90,
    aggregate: true,
  },
  seeking_player: {
    channel: "kampe",
    level: "normal",
    sendPush: true,
    silent: true,
    urgency: "low",
    cooldownSeconds: 300,
  },
  team_invite: {
    channel: "liga",
    level: "normal",
    sendPush: true,
    silent: true,
    urgency: "normal",
    cooldownSeconds: 60,
  },
  elo_change: {
    channel: "elo",
    level: "quiet",
    sendPush: false,
    silent: true,
    urgency: "low",
    cooldownSeconds: 0,
  },
  welcome: {
    channel: "system",
    level: "quiet",
    sendPush: false,
    silent: true,
    urgency: "low",
    cooldownSeconds: 0,
  },
  system_flag: {
    channel: "admin",
    level: "quiet",
    sendPush: false,
    silent: true,
    urgency: "low",
    cooldownSeconds: 0,
  },
});

function normalizeOrigin(value: string | null) {
  return String(value || "").trim().replace(/\/+$/, "");
}

function normalizeType(type: unknown) {
  return String(type || "").trim().toLowerCase();
}

function sanitizeCooldownSeconds(value: unknown, fallback: number) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(3600, Math.round(n)));
}

function sanitizeTopicToken(raw: string) {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-_]+|[-_]+$/g, "")
    .slice(0, 32);
}

function topicForPush({
  channel,
  type,
  matchId,
}: {
  channel: string;
  type: string;
  matchId: string | null;
}) {
  const base = matchId ? `${channel}-${matchId}` : `${channel}-${type || "event"}`;
  const topic = sanitizeTopicToken(base);
  return topic || "pm-notif";
}

function ttlForLevel(level: PushPolicy["level"]) {
  if (level === "critical") return 3600;
  if (level === "quiet") return 300;
  return 1800;
}

function allowedOrigins() {
  const raw = Deno.env.get("CORS_ALLOWED_ORIGINS") || "";
  const parsed = raw
    .split(",")
    .map((v) => normalizeOrigin(v))
    .filter(Boolean);
  return parsed.length ? parsed : defaultAllowedOrigins;
}

function corsHeadersForRequest(req: Request) {
  const origin = normalizeOrigin(req.headers.get("origin"));
  const allowed = allowedOrigins();
  const allowOrigin = origin && allowed.includes(origin) ? origin : allowed[0];
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST,OPTIONS",
    Vary: "Origin",
  };
}

function resolveServerPushPolicy(type: unknown, clientHints: Record<string, unknown> = {}) {
  const normalizedType = normalizeType(type);
  const known = PUSH_POLICY_BY_TYPE[normalizedType] || {};
  const merged: PushPolicy = {
    ...DEFAULT_PUSH_POLICY,
    ...known,
  };

  // For unknown types we accept client hints as a fallback.
  if (!PUSH_POLICY_BY_TYPE[normalizedType]) {
    if (typeof clientHints.channel === "string" && clientHints.channel.trim()) {
      merged.channel = clientHints.channel.trim().slice(0, 32);
    }
    if (typeof clientHints.level === "string" && PUSH_LEVELS.has(clientHints.level)) {
      merged.level = clientHints.level as PushPolicy["level"];
    }
    if (typeof clientHints.silent === "boolean") {
      merged.silent = clientHints.silent;
    }
    if (typeof clientHints.urgency === "string" && PUSH_URGENCIES.has(clientHints.urgency)) {
      merged.urgency = clientHints.urgency as PushPolicy["urgency"];
    }
    if (typeof clientHints.sendPush === "boolean") {
      merged.sendPush = clientHints.sendPush;
    }
    if (typeof clientHints.aggregate === "boolean") {
      merged.aggregate = clientHints.aggregate;
    }
    if (typeof clientHints.renotify === "boolean") {
      merged.renotify = clientHints.renotify;
    }
  }

  merged.cooldownSeconds = sanitizeCooldownSeconds(
    clientHints.cooldownSeconds,
    sanitizeCooldownSeconds(merged.cooldownSeconds, DEFAULT_PUSH_POLICY.cooldownSeconds),
  );

  if (!PUSH_LEVELS.has(merged.level)) merged.level = DEFAULT_PUSH_POLICY.level;
  if (!PUSH_URGENCIES.has(merged.urgency)) merged.urgency = DEFAULT_PUSH_POLICY.urgency;
  if (!merged.sendPush) merged.silent = true;

  return {
    ...merged,
    type: normalizedType || "unknown",
  };
}

async function shouldSkipByCooldown({
  adminClient,
  targetUserId,
  type,
  matchId,
  cooldownSeconds,
}: {
  adminClient: ReturnType<typeof createClient>;
  targetUserId: string;
  type: string;
  matchId: string | null;
  cooldownSeconds: number;
}) {
  if (!cooldownSeconds || cooldownSeconds <= 0 || !type) return false;

  try {
    const sinceIso = new Date(Date.now() - cooldownSeconds * 1000).toISOString();
    let query = adminClient
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", targetUserId)
      .eq("type", type)
      .gte("created_at", sinceIso);

    query = matchId ? query.eq("match_id", matchId) : query.is("match_id", null);

    const { count, error } = await query;
    if (error) {
      console.warn("cooldown query failed:", error.message || error);
      return false;
    }

    // Notification row is already inserted in DB before send-push is called.
    // count > 1 means we already had a similar notification in cooldown window.
    return (count || 0) > 1;
  } catch (err) {
    console.warn("cooldown query failed:", err);
    return false;
  }
}

async function aggregateChatIfNeeded({
  adminClient,
  targetUserId,
  matchId,
  title,
  body,
}: {
  adminClient: ReturnType<typeof createClient>;
  targetUserId: string;
  matchId: string | null;
  title: string;
  body: string;
}) {
  if (!matchId) return { title, body };
  try {
    const { count, error } = await adminClient
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", targetUserId)
      .eq("type", "match_chat")
      .eq("match_id", matchId)
      .eq("read", false);

    if (error) {
      console.warn("chat aggregation failed:", error.message || error);
      return { title, body };
    }

    const unread = count || 0;
    if (unread <= 1) return { title, body };
    return {
      title: `${unread} nye beskeder i kamp-chat`,
      body: "Tryk for at aabne kamp-chatten.",
    };
  } catch (err) {
    console.warn("chat aggregation failed:", err);
    return { title, body };
  }
}

Deno.serve(async (req: Request) => {
  const origin = normalizeOrigin(req.headers.get("origin"));
  const allowed = allowedOrigins();
  const corsHeaders = corsHeadersForRequest(req);
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Reject browser calls from unknown origins.
  if (origin && !allowed.includes(origin)) {
    return new Response(JSON.stringify({ error: "Origin not allowed" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const {
      targetUserId,
      title,
      body,
      matchId,
      type,
      channel,
      level,
      silent,
      urgency,
      cooldownSeconds,
      aggregate,
      renotify,
      sendPush,
    } = await req.json();

    if (!targetUserId || !title) {
      return new Response(JSON.stringify({ error: "targetUserId and title are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const bearerPrefix = "Bearer ";
    const jwt = authHeader.startsWith(bearerPrefix) ? authHeader.slice(bearerPrefix.length) : "";
    if (!jwt) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: { user }, error: authError } = await adminClient.auth.getUser(jwt);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const normalizedMatchId = matchId ? String(matchId) : null;
    const callerId = user.id;
    if (String(targetUserId) !== String(callerId)) {
      if (!normalizedMatchId) {
        return new Response(JSON.stringify({ error: "Forbidden: matchId is required for cross-user push" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const [{ data: callerInMatch }, { data: isCreator }, { data: targetInMatch }] = await Promise.all([
        adminClient
          .from("match_players")
          .select("id")
          .eq("match_id", normalizedMatchId)
          .eq("user_id", callerId)
          .maybeSingle(),
        adminClient
          .from("matches")
          .select("id")
          .eq("id", normalizedMatchId)
          .eq("creator_id", callerId)
          .maybeSingle(),
        adminClient
          .from("match_players")
          .select("id")
          .eq("match_id", normalizedMatchId)
          .eq("user_id", targetUserId)
          .maybeSingle(),
      ]);
      const callerAuthorized = !!(callerInMatch || isCreator);
      const targetIsInMatch = !!targetInMatch;
      if (!callerAuthorized || !targetIsInMatch) {
        return new Response(JSON.stringify({ error: "Forbidden: no access to this match notification" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const policy = resolveServerPushPolicy(type, {
      channel,
      level,
      silent,
      urgency,
      cooldownSeconds,
      aggregate,
      renotify,
      sendPush,
    });

    if (!policy.sendPush) {
      return new Response(JSON.stringify({ sent: 0, skipped: "quiet_policy" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const cooldownSkip = await shouldSkipByCooldown({
      adminClient,
      targetUserId: String(targetUserId),
      type: policy.type,
      matchId: normalizedMatchId,
      cooldownSeconds: policy.cooldownSeconds,
    });
    if (cooldownSkip) {
      return new Response(JSON.stringify({ sent: 0, skipped: "cooldown" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: subs, error: subsError } = await adminClient
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth")
      .eq("user_id", targetUserId);

    if (subsError) {
      console.error("push_subscriptions fetch failed:", subsError.message);
      return new Response(JSON.stringify({ error: subsError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!subs || subs.length === 0) {
      return new Response(JSON.stringify({ sent: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    webpush.setVapidDetails(
      Deno.env.get("VAPID_SUBJECT") || "mailto:hej@padelmakker.dk",
      Deno.env.get("VAPID_PUBLIC_KEY")!,
      Deno.env.get("VAPID_PRIVATE_KEY")!,
    );

    let unreadCount: number | null = null;
    try {
      const { count } = await adminClient
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", targetUserId)
        .eq("read", false);
      if (typeof count === "number") unreadCount = count;
    } catch (countErr) {
      console.warn("unread count failed:", countErr);
    }

    let effectiveTitle = String(title);
    let effectiveBody = String(body || "");
    if (policy.aggregate && policy.type === "match_chat") {
      const aggregated = await aggregateChatIfNeeded({
        adminClient,
        targetUserId: String(targetUserId),
        matchId: normalizedMatchId,
        title: effectiveTitle,
        body: effectiveBody,
      });
      effectiveTitle = aggregated.title;
      effectiveBody = aggregated.body;
    }

    const pushTag = normalizedMatchId
      ? `pm:${policy.channel}:${normalizedMatchId}`
      : `pm:${policy.channel}:${policy.type}`;

    const payload = JSON.stringify({
      title: effectiveTitle,
      body: effectiveBody,
      matchId: normalizedMatchId,
      type: policy.type,
      channel: policy.channel,
      level: policy.level,
      silent: policy.silent,
      renotify: policy.renotify,
      tag: pushTag,
      unreadCount,
    });

    const pushOptions = {
      TTL: ttlForLevel(policy.level),
      urgency: policy.urgency,
      topic: topicForPush({
        channel: policy.channel,
        type: policy.type,
        matchId: normalizedMatchId,
      }),
    } as const;

    let sent = 0;
    const expiredEndpoints: string[] = [];

    await Promise.all(
      subs.map(async (sub) => {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            payload,
            pushOptions,
          );
          sent++;
        } catch (err: unknown) {
          const status = (err as { statusCode?: number }).statusCode;
          if (status === 404 || status === 410) {
            expiredEndpoints.push(sub.endpoint);
          } else {
            console.warn("push send failed:", err);
          }
        }
      }),
    );

    if (expiredEndpoints.length > 0) {
      await adminClient
        .from("push_subscriptions")
        .delete()
        .in("endpoint", expiredEndpoints);
    }

    return new Response(JSON.stringify({ sent }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("send-push unexpected error:", e);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
