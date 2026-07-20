// Supabase Edge Function: send-discovery-email
// Sender valgfri e-mail når et makker-/kamp-match er fundet (backup når PWA-push mangler).
//
// Secrets (samme Resend-setup som report-feedback):
//   RESEND_API_KEY
//   FEEDBACK_FROM_EMAIL (fallback: PadelMakker <kontakt@padelmakker.dk>)
//   DISCOVERY_FROM_EMAIL (valgfri override — gerne noreply@ på verified domain)
//   SITE_URL (valgfri; default https://www.padelmakker.dk)
//   CORS_ALLOWED_ORIGINS (valgfri)
//
// Auth: JWT (verify_jwt). Kun tilladt hvis der lige er oprettet en matching in-app notifikation.

import { createClient } from "npm:@supabase/supabase-js@2";

const defaultAllowedOrigins = [
  "https://padelmakker.dk",
  "https://www.padelmakker.dk",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
];

const ALLOWED_TYPES = new Set(["makker_suggestion", "match_watch_match"]);
const MAX_RECIPIENTS = 8;
const NOTIF_WINDOW_MINUTES = 15;

function normalizeOrigin(value: string | null) {
  return String(value || "").trim().replace(/\/+$/, "");
}

function getAllowedOrigins() {
  const fromEnv = String(Deno.env.get("CORS_ALLOWED_ORIGINS") || "")
    .split(",")
    .map((s) => normalizeOrigin(s))
    .filter(Boolean);
  return new Set([...defaultAllowedOrigins, ...fromEnv]);
}

function corsHeaders(req: Request) {
  const origin = normalizeOrigin(req.headers.get("Origin"));
  const allowed = getAllowedOrigins();
  const allowOrigin = origin && allowed.has(origin) ? origin : defaultAllowedOrigins[0];
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

function jsonResponse(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), "Content-Type": "application/json" },
  });
}

function escapeHtml(value: string) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function wantsDiscoveryEmail(prefs: unknown): boolean {
  if (!prefs || typeof prefs !== "object") return false;
  const email = (prefs as { email?: unknown }).email;
  if (!email || typeof email !== "object") return false;
  return (email as { opdagelse?: unknown }).opdagelse === true;
}

/** Deep links ind i dashboard (ikke /app = install-guide). */
function deepLink(type: string, matchId: string | null, entityId: string | null, siteUrl: string) {
  if (type === "match_watch_match" && matchId) {
    return `${siteUrl}/dashboard/kampe/2v2/${encodeURIComponent(matchId)}`;
  }
  if (type === "makker_suggestion") {
    // Notifikationer-fanen — klarere end makkere-listen når man kommer fra mail.
    return `${siteUrl}/dashboard/notifikationer`;
  }
  return `${siteUrl}/dashboard/notifikationer`;
}

function ctaLabel(type: string) {
  if (type === "match_watch_match") return "Se kampen";
  if (type === "makker_suggestion") return "Se notifikation";
  return "Åbn PadelMakker";
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders(req) });
  }
  if (req.method !== "POST") {
    return jsonResponse(req, { error: "Method not allowed" }, 405);
  }

  try {
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) {
      return jsonResponse(req, { error: "Unauthorized" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    if (!supabaseUrl || !serviceKey) {
      return jsonResponse(req, { error: "Server misconfigured" }, 500);
    }

    const userClient = createClient(supabaseUrl, anonKey || serviceKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user?.id) {
      return jsonResponse(req, { error: "Unauthorized" }, 401);
    }

    const payload = await req.json().catch(() => ({}));
    const type = String(payload?.type || "").trim();
    const title = String(payload?.title || "").trim().slice(0, 120);
    const body = String(payload?.body || "").trim().slice(0, 400);
    const matchId = payload?.matchId ? String(payload.matchId).trim() : null;
    const entityType = payload?.entityType ? String(payload.entityType).trim() : null;
    const entityId = payload?.entityId ? String(payload.entityId).trim() : null;
    const rawIds = Array.isArray(payload?.targetUserIds) ? payload.targetUserIds : [];
    const targetUserIds = [...new Set(
      rawIds.map((id: unknown) => String(id || "").trim()).filter(Boolean),
    )].slice(0, MAX_RECIPIENTS);

    if (!ALLOWED_TYPES.has(type) || !title || !body || targetUserIds.length === 0) {
      return jsonResponse(req, { error: "Ugyldigt payload" }, 400);
    }

    const admin = createClient(supabaseUrl, serviceKey);
    const sinceIso = new Date(Date.now() - NOTIF_WINDOW_MINUTES * 60_000).toISOString();

    let query = admin
      .from("notifications")
      .select("user_id")
      .eq("type", type)
      .in("user_id", targetUserIds)
      .gte("created_at", sinceIso);

    if (type === "match_watch_match" && matchId) {
      query = query.eq("match_id", matchId);
    } else if (type === "makker_suggestion" && entityId) {
      query = query.eq("entity_type", entityType || "profile").eq("entity_id", entityId);
    } else {
      return jsonResponse(req, { error: "Mangler entity" }, 400);
    }

    const { data: recentNotifs, error: notifErr } = await query;
    if (notifErr) {
      console.error("send-discovery-email notif lookup:", notifErr.message);
      return jsonResponse(req, { error: "Kunne ikke verificere notifikation" }, 500);
    }

    const eligibleIds = new Set(
      (recentNotifs || []).map((n: { user_id: string }) => n.user_id).filter(Boolean),
    );
    if (eligibleIds.size === 0) {
      return jsonResponse(req, { ok: true, sent: 0, skipped: "no_recent_notifications" });
    }

    const { data: profiles, error: profErr } = await admin
      .from("profiles")
      .select("id, notification_prefs")
      .in("id", [...eligibleIds]);
    if (profErr) {
      console.error("send-discovery-email prefs:", profErr.message);
      return jsonResponse(req, { error: "Kunne ikke hente præferencer" }, 500);
    }

    const optedInIds = (profiles || [])
      .filter((p: { id: string; notification_prefs: unknown }) => wantsDiscoveryEmail(p.notification_prefs))
      .map((p: { id: string }) => p.id);

    if (optedInIds.length === 0) {
      return jsonResponse(req, { ok: true, sent: 0, skipped: "no_email_opt_in" });
    }

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      return jsonResponse(req, { error: "RESEND_API_KEY mangler" }, 500);
    }

    const fromEmail =
      Deno.env.get("DISCOVERY_FROM_EMAIL") ||
      Deno.env.get("FEEDBACK_FROM_EMAIL") ||
      "PadelMakker <kontakt@padelmakker.dk>";
    const siteUrl = String(Deno.env.get("SITE_URL") || "https://www.padelmakker.dk").replace(/\/+$/, "");
    const link = deepLink(type, matchId, entityId, siteUrl);
    const prefsLink = `${siteUrl}/dashboard/notifikationer`;
    const unsubMailto =
      "mailto:kontakt@padelmakker.dk?subject=" +
      encodeURIComponent("Afmeld makker/kamp-mails") +
      "&body=" +
      encodeURIComponent("Hej — afmeld venligst e-mail om nye makkere/kampe for denne konto.");
    const buttonLabel = ctaLabel(type);

    let sent = 0;
    for (const userId of optedInIds) {
      const { data: authUser, error: authErr } = await admin.auth.admin.getUserById(userId);
      const toEmail = String(authUser?.user?.email || "").trim();
      if (authErr || !toEmail) continue;

      const textBody =
        `${title}\n\n${body}\n\n${buttonLabel}: ${link}\n\n` +
        `Du får denne mail, fordi du har slået e-mail til for nye makkere/kampe i PadelMakker.\n` +
        `Slå fra her: ${prefsLink}\n` +
        `Eller svar/afmeld: ${unsubMailto.replace(/^mailto:/, "")}`;

      const htmlBody = `
        <div style="font-family:system-ui,Segoe UI,Arial,sans-serif;line-height:1.5;color:#111;max-width:560px">
          <p style="margin:0 0 4px;font-size:13px;color:#666">PadelMakker</p>
          <h1 style="margin:0 0 12px;font-size:18px;font-weight:700">${escapeHtml(title)}</h1>
          <p style="margin:0 0 16px">${escapeHtml(body)}</p>
          <p style="margin:0 0 24px">
            <a href="${escapeHtml(link)}" style="display:inline-block;padding:10px 16px;background:#0B6E4F;color:#fff;text-decoration:none;border-radius:8px;font-weight:600">
              ${escapeHtml(buttonLabel)}
            </a>
          </p>
          <p style="margin:0 0 8px;font-size:12px;color:#666">
            Du får denne mail, fordi du har slået e-mail til for nye makkere/kampe.
            <a href="${escapeHtml(prefsLink)}" style="color:#0B6E4F">Administrér i appen</a>
            ·
            <a href="${escapeHtml(unsubMailto)}" style="color:#0B6E4F">Afmeld via e-mail</a>
          </p>
        </div>
      `.trim();

      const resendResponse = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: fromEmail,
          to: [toEmail],
          subject: title,
          text: textBody,
          html: htmlBody,
          headers: {
            // Mailto-afmelding (ingen one-click POST-endpoint endnu — undgå List-Unsubscribe-Post).
            "List-Unsubscribe": `<${unsubMailto}>`,
          },
        }),
      });

      if (!resendResponse.ok) {
        const errText = await resendResponse.text();
        console.error("send-discovery-email resend:", resendResponse.status, errText.slice(0, 280));
        continue;
      }
      sent += 1;
    }

    return jsonResponse(req, { ok: true, sent, candidates: optedInIds.length });
  } catch (error) {
    console.error("send-discovery-email uventet fejl:", error);
    return jsonResponse(req, { error: "Intern fejl" }, 500);
  }
});
