// Supabase Edge Function: report-feedback
// Modtager bug/fejl-rapporter fra appen og sender dem til kontaktmail via Resend.
//
// Secrets der skal sættes i Supabase:
//   RESEND_API_KEY           - API key fra Resend
//   FEEDBACK_TO_EMAIL        - modtager (default: kontakt@padelmakker.dk)
//   FEEDBACK_FROM_EMAIL      - afsender, fx "PadelMakker <kontakt@padelmakker.dk>"
//   CORS_ALLOWED_ORIGINS     - valgfri kommasepareret liste over tilladte origins
// Denne funktion deployes med --no-verify-jwt, da nogle projekter kører ES256 JWT.

const defaultAllowedOrigins = [
  "https://padelmakker.dk",
  "https://www.padelmakker.dk",
];

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

  if (origin && !allowed.includes(origin)) {
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
    const userEmail = String(payload?.userEmail || "").trim();
    const userId = String(payload?.userId || "").trim();
    const submittedAt = String(payload?.submittedAt || "").trim() || new Date().toISOString();

    if (message.length < 10 || message.length > 3000) {
      return new Response(JSON.stringify({ error: "message skal være mellem 10 og 3000 tegn" }), {
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
