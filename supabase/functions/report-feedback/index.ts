// Supabase Edge Function: report-feedback
// Modtager bug/fejl-rapporter fra appen og sender dem til kontaktmail via Resend.
//
// Secrets der skal sættes i Supabase:
//   RESEND_API_KEY           - API key fra Resend
//   FEEDBACK_TO_EMAIL        - modtager (default: kontakt@padelmakker.dk)
//   FEEDBACK_FROM_EMAIL      - afsender, fx "PadelMakker <kontakt@padelmakker.dk>"
//   CORS_ALLOWED_ORIGINS     - valgfri kommasepareret liste over tilladte origins
//   SUPABASE_URL             - automatisk
//   SUPABASE_SERVICE_ROLE_KEY- automatisk

import { createClient } from "npm:@supabase/supabase-js@2";

const defaultAllowedOrigins = [
  "https://padelmakker.dk",
  "https://www.padelmakker.dk",
];

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
  const corsHeaders = corsHeadersForRequest(req);
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
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

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRole) {
      return new Response(JSON.stringify({ error: "Supabase secrets mangler" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceRole);
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : "";
    if (!token) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: { user }, error: authError } = await adminClient.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload = await req.json();
    const topic = String(payload?.topic || "").trim();
    const message = String(payload?.message || "").trim();
    const pageUrl = String(payload?.pageUrl || "").trim();
    const routePath = String(payload?.routePath || "").trim();
    const userAgent = String(payload?.userAgent || "").trim();
    const displayName = String(payload?.displayName || "").trim();
    const userEmail = String(payload?.userEmail || "").trim() || user.email || "";
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
    const subject = `PadelMakker feedback${subjectSuffix}`;

    const textBody =
      `Ny bug/fejl-indberetning\n\n` +
      `Bruger: ${displayName || "(ukendt)"}\n` +
      `Email: ${userEmail || "(ukendt)"}\n` +
      `User ID: ${user.id}\n` +
      `Tid: ${submittedAt}\n` +
      `Side: ${pageUrl || "(ukendt)"}\n` +
      `Route: ${routePath || "(ukendt)"}\n` +
      `User-Agent: ${userAgent || "(ukendt)"}\n` +
      `Titel: ${topic || "(ingen)"}\n\n` +
      `Besked:\n${message}`;

    const htmlBody = `
      <h2>Ny bug/fejl-indberetning</h2>
      <p><strong>Bruger:</strong> ${escapeHtml(displayName || "(ukendt)")}</p>
      <p><strong>Email:</strong> ${escapeHtml(userEmail || "(ukendt)")}</p>
      <p><strong>User ID:</strong> ${escapeHtml(user.id)}</p>
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
      console.error("report-feedback resend fejl:", errText);
      return new Response(JSON.stringify({ error: "Kunne ikke sende email" }), {
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
