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
// GET  = vis en side med en knap. Mailscannere og link-previews henter GET
//        automatisk, saa GET maa ALDRIG afmelde noget af sig selv - saa ville
//        folk blive afmeldt, uden at have roert linket.
// POST = afmeld. Det er ogsaa det, Gmail/Outlook sender ved deres egen
//        "afmeld"-knap (RFC 8058 one-click).
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

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function page(title: string, body: string, status = 200) {
  const html = `<!doctype html>
<html lang="da">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex" />
<title>${escapeHtml(title)} · PadelMakker</title>
<style>
  :root { color-scheme: light dark; --bg:#f6f7f9; --card:#fff; --text:#111; --muted:#666; --line:#e4e6ea; --accent:#1a7f4b; }
  @media (prefers-color-scheme: dark) {
    :root { --bg:#14161a; --card:#1d2026; --text:#f2f3f5; --muted:#a2a8b3; --line:#2c3037; --accent:#39b46f; }
  }
  * { box-sizing: border-box; }
  body { margin:0; background:var(--bg); color:var(--text);
         font-family: system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif;
         display:flex; align-items:center; justify-content:center; min-height:100vh; padding:24px 16px; }
  .card { background:var(--card); border:1px solid var(--line); border-radius:14px;
          padding:28px 24px; max-width:460px; width:100%; }
  h1 { font-size:20px; margin:0 0 12px; letter-spacing:-0.3px; }
  p { font-size:15px; line-height:1.55; color:var(--muted); margin:0 0 14px; }
  .brand { font-size:13px; color:var(--muted); margin:0 0 18px; }
  button { font:inherit; font-weight:600; font-size:15px; cursor:pointer;
           background:var(--accent); color:#fff; border:0; border-radius:10px;
           padding:13px 18px; width:100%; min-height:48px; }
  a { color:var(--accent); }
  .later { display:block; text-align:center; margin-top:16px; font-size:14px; }
</style>
</head>
<body><div class="card"><p class="brand">PadelMakker</p>${body}</div></body>
</html>`;
  return new Response(html, {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      // Linket maa ikke laegge sig i en soegemaskine eller en delt cache.
      "Referrer-Policy": "no-referrer",
    },
  });
}

function confirmPage(token: string) {
  return page(
    "Afmeld mails",
    `<h1>Vil du afmelde?</h1>
     <p>Så holder vi op med at sende dig mail, når nogen søger makker i dit område.
        Du kan stadig bruge appen som før, og du kan altid slå det til igen inde i PadelMakker.</p>
     <form method="POST">
       <input type="hidden" name="token" value="${escapeHtml(token)}" />
       <button type="submit">Ja, afmeld mig</button>
     </form>
     <a class="later" href="${siteUrl()}">Nej, tag mig tilbage til PadelMakker</a>`,
  );
}

function donePage() {
  return page(
    "Afmeldt",
    `<h1>Du er afmeldt</h1>
     <p>Du får ikke flere mails fra os om nye makkere. Der kan nå at være én undervejs,
        som allerede var sendt.</p>
     <p>Fortrudt? Du kan slå det til igen under Notifikationer i appen.</p>
     <a class="later" href="${siteUrl()}">Tilbage til PadelMakker</a>`,
  );
}

function unknownPage() {
  return page(
    "Linket virker ikke",
    `<h1>Linket virker ikke</h1>
     <p>Linket er ufuldstændigt eller hører ikke til en konto. Prøv at åbne det fra mailen igen —
        nogle mailprogrammer klipper lange links over.</p>
     <p>Du kan også slå mails fra under Notifikationer i appen, eller skrive til
        <a href="mailto:kontakt@padelmakker.dk">kontakt@padelmakker.dk</a>.</p>`,
    404,
  );
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
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "content-type",
      },
    });
  }

  if (req.method === "GET") {
    const token = readToken(req);
    if (!token) return unknownPage();
    // Bevidst ingen afmelding her - se noten oeverst om mailscannere.
    return confirmPage(token);
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const token = await readPostedToken(req);
  if (!token) return unknownPage();

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) {
    console.error("email-unsubscribe: SUPABASE_URL eller SUPABASE_SERVICE_ROLE_KEY mangler");
    return page(
      "Noget gik galt",
      `<h1>Noget gik galt</h1>
       <p>Vi kunne ikke afmelde dig lige nu. Prøv igen om lidt, eller skriv til
          <a href="mailto:kontakt@padelmakker.dk">kontakt@padelmakker.dk</a>, så gør vi det manuelt.</p>`,
      500,
    );
  }

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const { data, error } = await admin.rpc("email_unsubscribe_by_token", { p_token: token });

  if (error) {
    // Fejlen maa ikke ende som en tavs 200. Sker det her, holder mailene ikke
    // op, og naeste skridt for brugeren er spam-knappen.
    console.error("email-unsubscribe rpc:", error.message);
    return page(
      "Noget gik galt",
      `<h1>Noget gik galt</h1>
       <p>Vi kunne ikke afmelde dig lige nu. Prøv igen om lidt, eller skriv til
          <a href="mailto:kontakt@padelmakker.dk">kontakt@padelmakker.dk</a>, så gør vi det manuelt.</p>`,
      500,
    );
  }

  if (!data?.ok) {
    console.warn("email-unsubscribe:", data?.error || "ukendt svar");
    return unknownPage();
  }

  return donePage();
});
