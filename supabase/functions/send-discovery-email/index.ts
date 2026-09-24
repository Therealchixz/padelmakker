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

/** Dato i København som YYYY-MM-DD, `offsetDays` dage fra nu. */
function copenhagenDate(offsetDays = 0): string {
  const d = new Date(Date.now() + offsetDays * 24 * 60 * 60 * 1000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Copenhagen" }).format(d);
}

/**
 * Sendes mailen nu, eller venter den til den daglige opsummering kl. 17
 * (send-discovery-digest)? Kun kampe i dag eller i morgen haster: en åben kamp
 * skal have fire spillere hurtigt. Alt andet samles, så den anden nyhed samme
 * dag ikke går tabt i dagsspærren.
 */
function sendsImmediately(type: string, matchDate: string | null): boolean {
  if (type !== "match_watch_match" || !matchDate) return false;
  const d = String(matchDate).slice(0, 10);
  return d === copenhagenDate(0) || d === copenhagenDate(1);
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

    let matchDate: string | null = null;
    if (type === "match_watch_match" && matchId) {
      const { data: matchRow } = await admin.from("matches").select("date").eq("id", matchId).maybeSingle();
      matchDate = matchRow?.date ? String(matchRow.date) : null;
    }
    if (!sendsImmediately(type, matchDate)) {
      // Nyheden ligger allerede som in-app notifikation og kommer med i
      // dagens opsummering kl. 17.
      return jsonResponse(req, { ok: true, sent: 0, skipped: "digest" });
    }

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
    // ?kilde=opdagelse: appen gemmer mærket, når personen er logget ind
    // (log_app_return), så vi kan se, om mailen får folk tilbage.
    const link = `${deepLink(type, matchId, entityId, siteUrl)}?kilde=opdagelse`;
    const prefsLink = `${siteUrl}/dashboard/notifikationer?kilde=opdagelse`;
    // Framelding med ET klik, uden login. Erstatter den gamle "skriv til os
    // og bed om at blive fjernet" - den slags foerer til spam-knappen i
    // stedet, og nok spam-markeringer faar Gmail og Outlook til at sortere
    // ALLE mails fra padelmakker.dk fra, ogsaa kodeord-nulstilling.
    const unsubBase = `${Deno.env.get("SUPABASE_URL")}/functions/v1/email-unsubscribe`;
    const buttonLabel = ctaLabel(type);

    let sent = 0;
    let skippedByCap = 0;
    for (const userId of optedInIds) {
      const { data: authUser, error: authErr } = await admin.auth.admin.getUserById(userId);
      const toEmail = String(authUser?.user?.email || "").trim();
      if (authErr || !toEmail) continue;

      // Uden et frameldingslink sender vi ikke. En mail, man ikke kan komme
      // af med, er vaerre end ingen mail: den koster os afsenderens omdoemme.
      const { data: unsubToken, error: tokenErr } = await admin.rpc(
        "email_unsub_token_for",
        { p_user_id: userId },
      );
      if (tokenErr || !unsubToken) {
        console.error(
          "send-discovery-email: intet frameldingstoken for bruger, springer over:",
          tokenErr?.message || "tomt token",
        );
        continue;
      }
      const unsubLink = `${unsubBase}?t=${encodeURIComponent(String(unsubToken))}`;

      // Hoejst én opdagelses-mail per person per uge.
      //
      // Notifikations-funktionen spaerrer kun for gentagelser om den SAMME
      // person i 7 dage - fem forskellige makkere paa én dag er inden for
      // reglerne. Fem mails paa en dag til en, der ikke har aabnet appen i et
      // halvt aar, er praecis det, der faar folk til at trykke spam.
      //
      // Spaerren ligger i databasen, fordi denne funktion kaldes fra browseren
      // og kan koere flere gange samtidig. Reservationen lykkes kun én gang.
      const { data: slotOk, error: slotErr } = await admin.rpc("claim_email_send_slot", {
        p_user_id: userId,
        p_kind: "discovery",
      });
      if (slotErr) {
        console.error("send-discovery-email slot:", slotErr.message);
        continue;
      }
      if (slotOk !== true) {
        skippedByCap += 1;
        continue;
      }

      const textBody =
        `${title}\n\n${body}\n\n${buttonLabel}: ${link}\n\n` +
        `Du får denne mail, fordi du har en profil på PadelMakker, og besked om nye\n` +
        `makkere og kampe er slået til på din konto.\n` +
        `Afmeld med ét klik: ${unsubLink}\n` +
        `Eller administrér i appen: ${prefsLink}\n\n` +
        `PadelMakker · CVR 46403193 · ${siteUrl}/privatlivspolitik`;

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
          <p style="margin:0 0 6px;font-size:12px;color:#666">
            Du får denne mail, fordi du har en profil på PadelMakker, og besked om nye
            makkere og kampe er slået til på din konto.
            <a href="${escapeHtml(unsubLink)}" style="color:#0B6E4F">Afmeld</a>
            ·
            <a href="${escapeHtml(prefsLink)}" style="color:#0B6E4F">Administrér i appen</a>
          </p>
          <p style="margin:0;font-size:11px;color:#888">
            PadelMakker · CVR 46403193 ·
            <a href="${escapeHtml(siteUrl)}/privatlivspolitik" style="color:#888">Privatlivspolitik</a>
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
            // RFC 8058: naar begge headere er sat, viser Gmail og Outlook deres
            // EGEN afmeld-knap i toppen af mailen og sender et POST hertil.
            // Det er den knap, folk faktisk finder - alternativet er spam-knappen.
            "List-Unsubscribe": `<${unsubLink}>`,
            "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
          },
        }),
      });

      if (!resendResponse.ok) {
        const errText = await resendResponse.text();
        console.error("send-discovery-email resend:", resendResponse.status, errText.slice(0, 280));
        // Giv ugens reservation tilbage. Ellers har brugeren brugt sin uge paa
        // en mail, der aldrig kom frem, og faar ingenting i syv dage.
        const { error: releaseErr } = await admin.rpc("release_email_send_slot", {
          p_user_id: userId,
          p_kind: "discovery",
        });
        if (releaseErr) {
          console.error("send-discovery-email release:", releaseErr.message);
        }
        continue;
      }
      sent += 1;

      // Markér som mailet, så den ikke også kommer i opsummeringen kl. 17.
      let markQuery = admin
        .from("notifications")
        .update({ emailed_at: new Date().toISOString() })
        .eq("user_id", userId)
        .eq("type", type)
        .gte("created_at", sinceIso)
        .is("emailed_at", null);
      markQuery = type === "match_watch_match" && matchId
        ? markQuery.eq("match_id", matchId)
        : markQuery.eq("entity_id", entityId || "");
      const { error: markErr } = await markQuery;
      if (markErr) console.error("send-discovery-email mark emailed:", markErr.message);
    }

    return jsonResponse(req, {
      ok: true,
      sent,
      candidates: optedInIds.length,
      skipped_by_weekly_cap: skippedByCap,
    });
  } catch (error) {
    console.error("send-discovery-email uventet fejl:", error);
    return jsonResponse(req, { error: "Intern fejl" }, 500);
  }
});
