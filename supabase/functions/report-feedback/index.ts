// Supabase Edge Function: report-feedback
// Modtager bug/fejl-rapporter fra appen og sender dem til kontaktmail via Resend.
//
// Secrets der skal saettes i Supabase:
//   RESEND_API_KEY           - API key fra Resend
//   FEEDBACK_TO_EMAIL        - modtager (default: kontakt@padelmakker.dk)
//   FEEDBACK_FROM_EMAIL      - afsender, fx "PadelMakker <kontakt@padelmakker.dk>"
//   CORS_ALLOWED_ORIGINS     - valgfri kommasepareret liste over tilladte origins
// Funktionen validerer JWT manuelt (uanset Supabase verify_jwt setting).

import { createClient } from "npm:@supabase/supabase-js@2";

const defaultAllowedOrigins = [
  "https://padelmakker.dk",
  "https://www.padelmakker.dk",
];

const RATE_LIMIT_WINDOW_MS = 60_000;
const localRateLimitFallback = new Map<string, { windowStart: number; hits: number }>();

const feedbackCategoryLabels: Record<string, string> = {
  "bug": "Bug",
  "performance": "Performance",
  "ui": "UI / UX",
  "match-chat": "Match chat",
  "notifications": "Notifikationer",
  "other": "Andet",
};

const feedbackPriorityLabels: Record<string, string> = {
  "low": "Lav",
  "normal": "Normal",
  "high": "Hoj",
  "critical": "Kritisk",
};

function normalizeCategory(value: unknown) {
  const key = String(value || "").trim().toLowerCase();
  return feedbackCategoryLabels[key] ? key : "bug";
}

function normalizePriority(value: unknown) {
  const key = String(value || "").trim().toLowerCase();
  return feedbackPriorityLabels[key] ? key : "normal";
}

function normalizeOrigin(value: string | null) {
  return String(value || "").trim().replace(/\/+$/, "");
}

function parsePositiveInt(value: string | undefined, fallback: number) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.floor(n);
}

function parseBearerToken(authHeader: string | null) {
  const raw = String(authHeader || "").trim();
  const prefix = "Bearer ";
  if (!raw.startsWith(prefix)) return "";
  return raw.slice(prefix.length).trim();
}

function readClientIp(req: Request) {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return String(xff).split(",")[0].trim();
  const xrip = req.headers.get("x-real-ip");
  if (xrip) return String(xrip).trim();
  const cfip = req.headers.get("cf-connecting-ip");
  if (cfip) return String(cfip).trim();
  return "unknown";
}

function consumeLocalRateLimit(key: string, windowStart: number, maxHits: number) {
  const prev = localRateLimitFallback.get(key);
  if (!prev || prev.windowStart !== windowStart) {
    localRateLimitFallback.set(key, { windowStart, hits: 1 });
    return true;
  }
  const nextHits = prev.hits + 1;
  localRateLimitFallback.set(key, { windowStart, hits: nextHits });
  return nextHits <= maxHits;
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
    "Vary": "Origin",
  };
}

function escapeHtml(input: string) {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;");
}

Deno.serve(async (req: Request) => {
  const origin = normalizeOrigin(req.headers.get("origin"));
  const allowed = allowedOrigins();
  const corsHeaders = corsHeadersForRequest(req);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (!origin || !allowed.includes(origin)) {
    return new Response(JSON.stringify({ error: "Origin not allowed" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(JSON.stringify({ error: "SUPABASE_URL/SERVICE_ROLE mangler" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const jwt = parseBearerToken(req.headers.get("authorization"));
    if (!jwt) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: { user }, error: authError } = await adminClient.auth.getUser(jwt);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const rateLimitMaxPerWindow = parsePositiveInt(Deno.env.get("FEEDBACK_RATE_LIMIT_MAX"), 5);
    const windowStart = Math.floor(Date.now() / RATE_LIMIT_WINDOW_MS);
    const userKey = `feedback:user:${user.id}`;
    const ipKey = `feedback:ip:${readClientIp(req)}`;

    for (const key of [userKey, ipKey]) {
      const { data: allowedByRpc, error: rateErr } = await adminClient.rpc("check_rate_limit", {
        p_key: key,
        p_window_start: windowStart,
        p_max: rateLimitMaxPerWindow,
      });

      if (rateErr) {
        const allowedByFallback = consumeLocalRateLimit(key, windowStart, rateLimitMaxPerWindow);
        if (!allowedByFallback) {
          return new Response(JSON.stringify({ error: "For mange foresporgsler. Prov igen om et ojeblik." }), {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        continue;
      }

      if (allowedByRpc !== true) {
        return new Response(JSON.stringify({ error: "For mange foresporgsler. Prov igen om et ojeblik." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const payload = await req.json();
    const category = normalizeCategory(payload?.category);
    const priority = normalizePriority(payload?.priority);
    const categoryLabel = feedbackCategoryLabels[category];
    const priorityLabel = feedbackPriorityLabels[priority];
    const topic = String(payload?.topic || "").trim();
    const message = String(payload?.message || "").trim();
    const pageUrl = String(payload?.pageUrl || "").trim();
    const routePath = String(payload?.routePath || "").trim();
    const userAgent = String(payload?.userAgent || "").trim();
    const displayName = String(payload?.displayName || "").trim();
    const userEmail = String(user.email || "").trim();
    const userId = String(user.id || "").trim();
    const submittedAt = String(payload?.submittedAt || "").trim() || new Date().toISOString();

    if (message.length < 10 || message.length > 3000) {
      return new Response(JSON.stringify({ error: "message skal vaere mellem 10 og 3000 tegn" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      return new Response(JSON.stringify({ error: "RESEND_API_KEY mangler" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const toEmail = Deno.env.get("FEEDBACK_TO_EMAIL") || "kontakt@padelmakker.dk";
    const fromEmail = Deno.env.get("FEEDBACK_FROM_EMAIL") || "PadelMakker <kontakt@padelmakker.dk>";
    const subjectSuffix = topic ? ` - ${topic.slice(0, 120)}` : "";
    const subject = `PadelMakker feedback [${priorityLabel}] [${categoryLabel}]${subjectSuffix}`;

    const textBody =
      `Ny bug/fejl-indberetning\n\n` +
      `Kategori: ${categoryLabel}\n` +
      `Prioritet: ${priorityLabel}\n` +
      `Bruger: ${displayName || "(ukendt)"}\n` +
      `Email: ${userEmail || "(ukendt)"}\n` +
      `User ID: ${userId || "(ukendt)"}\n` +
      `Tid: ${submittedAt}\n` +
      `Side: ${pageUrl || "(ukendt)"}\n` +
      `Route: ${routePath || "(ukendt)"}\n` +
      `User-Agent: ${userAgent || "(ukendt)"}\n` +
      `Titel: ${topic || "(ingen)"}\n\n` +
      `Besked:\n${message}`;

    const htmlBody = `
      <h2>Ny bug/fejl-indberetning</h2>
      <p><strong>Kategori:</strong> ${escapeHtml(categoryLabel)}</p>
      <p><strong>Prioritet:</strong> ${escapeHtml(priorityLabel)}</p>
      <p><strong>Bruger:</strong> ${escapeHtml(displayName || "(ukendt)")}</p>
      <p><strong>Email:</strong> ${escapeHtml(userEmail || "(ukendt)")}</p>
      <p><strong>User ID:</strong> ${escapeHtml(userId || "(ukendt)")}</p>
      <p><strong>Tid:</strong> ${escapeHtml(submittedAt)}</p>
      <p><strong>Side:</strong> ${escapeHtml(pageUrl || "(ukendt)")}</p>
      <p><strong>Route:</strong> ${escapeHtml(routePath || "(ukendt)")}</p>
      <p><strong>User-Agent:</strong> ${escapeHtml(userAgent || "(ukendt)")}</p>
      <p><strong>Titel:</strong> ${escapeHtml(topic || "(ingen)")}</p>
      <hr />
      <p><strong>Besked</strong></p>
      <pre style="white-space:pre-wrap;font-family:system-ui,Segoe UI,Arial,sans-serif">${escapeHtml(message)}</pre>
    `.trim();

    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [toEmail],
        subject,
        text: textBody,
        html: htmlBody,
        ...(userEmail ? { reply_to: userEmail } : {}),
      }),
    });

    if (!resendResponse.ok) {
      const errText = await resendResponse.text();
      let resendMsg = "";
      try {
        const parsed = JSON.parse(errText);
        resendMsg = String(parsed?.message || parsed?.error || "").trim();
      } catch {
        resendMsg = errText.trim();
      }
      const safeMsg = resendMsg.replace(/\s+/g, " ").slice(0, 280);
      console.error("report-feedback resend fejl:", resendResponse.status, safeMsg || errText);
      return new Response(JSON.stringify({
        error: safeMsg ? `Kunne ikke sende email: ${safeMsg}` : "Kunne ikke sende email",
      }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = await resendResponse.json();
    return new Response(JSON.stringify({ ok: true, id: result?.id || null }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("report-feedback uventet fejl:", error);
    return new Response(JSON.stringify({ error: "Intern fejl" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
