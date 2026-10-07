// Supabase Edge Function: email-unsubscribe
//
// Framelding af PadelMakker-mails med ET klik, uden login.
//
// Hvorfor uden login: den bruger, der helst vil af med mailen, er praecis den
// bruger, der ikke gider logge ind. Kan de ikke komme af med den, trykker de
// "spam" i stedet - og faar padelmakker.dk nok spam-markeringer, sorterer
// Gmail og Outlook ALLE domaenets mails fra, ogsaa "nulstil kodeord" og
// "bekraeft din konto". Frameldingen beskytter altsaa selve muligheden for at
// sende mail overhovedet.
//
// GET  = send videre til padelmakker.dk/afmeld, hvor der er en knap.
//        Mailscannere og link-previews henter GET automatisk, saa GET maa
//        ALDRIG afmelde noget af sig selv - saa ville folk blive afmeldt,
//        uden at have roert linket.
// POST = afmeld. Det er ogsaa det, Gmail/Outlook sender ved deres egen
//        "afmeld"-knap (RFC 8058 one-click), og vores egen side (JSON).
//
// Ingen JWT: funktionen deployes med --no-verify-jwt. Token'et ER adgangen.
// Der er intet at hente paa den: den fortaeller ikke, hvem token'et hoerer
// til, og den kan kun slaa mails FRA, aldrig til.
//
// Secrets:
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY  (saettes automatisk af Supabase)
//   SITE_URL                                 (valgfri; default www.padelmakker.dk)

import { createClient } from "npm:@supabase/supabase-js@2";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function siteUrl() {
  return String(Deno.env.get("SITE_URL") || "https://www.padelmakker.dk").replace(/\/+$/, "");
}

/** Token fra ?t= eller ?token= — begge former, saa et aeldre link ogsaa virker. */
function readToken(req: Request): string {
  const url = new URL(req.url);
  const raw = String(url.searchParams.get("t") || url.searchParams.get("token") || "").trim();
  return UUID_RE.test(raw) ? raw : "";
}

/*
 * Siden selv ligger paa padelmakker.dk/afmeld. Supabase viser ikke HTML fra
 * *.supabase.co som en side (den sendes som ren tekst), saa en bruger saa raa
 * kode i stedet for en knap (ejeren 7. okt. 2026). GET sender derfor bare
 * videre til vores egen side, som kalder POST herunder.
 */
function afmeldPage(token: string) {
  const base = `${siteUrl()}/afmeld`;
  return token ? `${base}?t=${encodeURIComponent(token)}` : base;
}

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, authorization, apikey, x-client-info",
};

/** Svar til vores egen side (JSON) eller til Gmail/Outlooks one-click (tekst). */
function reply(wantsJson: boolean, status: number, ok: boolean, error = "") {
  if (wantsJson) {
    return new Response(JSON.stringify(ok ? { ok: true } : { ok: false, error }), {
      status,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  }
  return new Response(ok ? "Du er afmeldt." : "Afmeldingen mislykkedes.", {
    status,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
}

/** Token fra POST-body: one-click sender form-data, vores egen knap gør også. */
async function readPostedToken(req: Request): Promise<string> {
  const fromQuery = readToken(req);
  if (fromQuery) return fromQuery;
  try {
    const ct = String(req.headers.get("content-type") || "");
    if (ct.includes("application/json")) {
      const body = await req.json();
      const raw = String(body?.token || body?.t || "").trim();
      return UUID_RE.test(raw) ? raw : "";
    }
    const form = await req.formData();
    const raw = String(form.get("token") || form.get("t") || "").trim();
    return UUID_RE.test(raw) ? raw : "";
  } catch {
    return "";
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (req.method === "GET") {
    const token = readToken(req);
    // Bevidst ingen afmelding her - se noten oeverst om mailscannere.
    return new Response(null, {
      status: 303,
      headers: { Location: afmeldPage(token), "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" },
    });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const wantsJson = String(req.headers.get("content-type") || "").includes("application/json");
  const token = await readPostedToken(req);
  if (!token) return reply(wantsJson, 404, false, "unknown_token");

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) {
    console.error("email-unsubscribe: SUPABASE_URL eller SUPABASE_SERVICE_ROLE_KEY mangler");
    return reply(wantsJson, 500, false, "server");
  }

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const { data, error } = await admin.rpc("email_unsubscribe_by_token", { p_token: token });

  if (error) {
    // Fejlen maa ikke ende som en tavs 200. Sker det her, holder mailene ikke
    // op, og naeste skridt for brugeren er spam-knappen.
    console.error("email-unsubscribe rpc:", error.message);
    return reply(
      wantsJson,
      500,
      false,
      "server",
    );
  }

  if (!data?.ok) {
    console.warn("email-unsubscribe:", data?.error || "ukendt svar");
    return reply(wantsJson, 404, false, "unknown_token");
  }

  return reply(wantsJson, 200, true);
});
