// Supabase Edge Function: send-push
// Sender browser push-notifikation til alle enheder tilhørende en bruger.
//
// Miljøvariabler der skal sættes i Supabase Dashboard → Edge Functions → Secrets:
//   VAPID_PUBLIC_KEY   – base64url ECDH P-256 public key
//   VAPID_PRIVATE_KEY  – base64url ECDH P-256 private key
//   VAPID_SUBJECT      – mailto: eller https: kontaktadresse (fx "mailto:hej@padelmakker.dk")
//   SUPABASE_URL       – automatisk tilgængelig i Edge Functions
//   SUPABASE_SERVICE_ROLE_KEY – automatisk tilgængelig i Edge Functions

import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Kræv gyldig bruger-JWT (kalder er autentificeret)
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { targetUserId, title, body, matchId } = await req.json();
    if (!targetUserId || !title) {
      return new Response(JSON.stringify({ error: "targetUserId og title er påkrævet" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Hent subscriptions via service role (bypasser RLS)
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verificér at kalder er autentificeret — send JWT eksplicit (Edge Functions har ingen session-storage)
    const jwt = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await adminClient.auth.getUser(jwt);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: subs, error: subsError } = await adminClient
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth")
      .eq("user_id", targetUserId);

    if (subsError) {
      console.error("push_subscriptions fetch fejl:", subsError.message);
      return new Response(JSON.stringify({ error: subsError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!subs || subs.length === 0) {
      // Ingen subscriptions — ikke en fejl, bare ingen at sende til
      return new Response(JSON.stringify({ sent: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Konfigurér VAPID
    webpush.setVapidDetails(
      Deno.env.get("VAPID_SUBJECT") || "mailto:hej@padelmakker.dk",
      Deno.env.get("VAPID_PUBLIC_KEY")!,
      Deno.env.get("VAPID_PRIVATE_KEY")!
    );

    // Hent ulæst antal til app-ikon badge (bedste effort).
    // Hvis denne query fejler, sender vi stadig push uden unreadCount.
    let unreadCount: number | null = null;
    try {
      const { count } = await adminClient
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", targetUserId)
        .eq("read", false);
      if (typeof count === "number") unreadCount = count;
    } catch (countErr) {
      console.warn("unread count fejl:", countErr);
    }

    const payload = JSON.stringify({
      title,
      body: body || "",
      matchId: matchId || null,
      unreadCount,
    });
    let sent = 0;
    const expiredEndpoints: string[] = [];

    await Promise.all(
      subs.map(async (sub) => {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            payload
          );
          sent++;
        } catch (err: unknown) {
          const status = (err as { statusCode?: number }).statusCode;
          if (status === 404 || status === 410) {
            // Subscription er udløbet/fjernet — ryd op
            expiredEndpoints.push(sub.endpoint);
          } else {
            console.warn("push send fejl:", err);
          }
        }
      })
    );

    // Slet udløbne subscriptions
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
    console.error("send-push uventet fejl:", e);
    return new Response(JSON.stringify({ error: "Intern fejl" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
