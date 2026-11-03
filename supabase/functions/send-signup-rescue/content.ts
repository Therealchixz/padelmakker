// Indhold til engangsmailen "Din profil er næsten klar" (ejeren 3. nov. 2026).
//
// Gennemgangen af oprettelsen fandt tre fejl, der stoppede nye brugere (SMS-kode
// afvist for Google-brugere, "Ved ikke endnu" sendte folk tilbage til start, og
// telefon-konti kunne ikke logge ind uden bekræftet mail). Alle er rettet; mailen
// fortæller de berørte præcis, hvad de mangler.
//
// Ren logik (ingen netværk), så den kan testes fra node.

import {
  copenhagenDateLabel,
  emailShellHtml,
  escapeHtml,
  legalLineHtml,
  NAVY,
  NAVY_BG,
  TEXT_MID,
  withKilde,
} from "../send-discovery-digest/content.ts";

export type RescueGroup = "google_sms" | "phone_email" | "email_sms" | "profile" | "city";

export type RescueUser = {
  id: string;
  email?: string | null;
  new_email?: string | null;
  email_confirmed_at?: string | null;
  phone_confirmed_at?: string | null;
  app_metadata?: { provider?: string; providers?: string[] } | null;
  user_metadata?: Record<string, unknown> | null;
};

export type RescueProfile = {
  id: string;
  full_name?: string | null;
  name?: string | null;
  birth_year?: number | null;
  play_style?: string | null;
  city?: string | null;
  latitude?: number | null;
  phone_verification_exempt?: boolean | null;
  is_banned?: boolean | null;
  role?: string | null;
  notification_prefs?: { email?: Record<string, unknown> } | null;
};

/** Mailen kontoen kan nås på: bekræftet mail, ellers den der venter (telefon-konti). */
export function rescueEmailAddress(user: RescueUser): string {
  return String(user.email || user.new_email || "").trim();
}

function provider(user: RescueUser): "google" | "phone" | "email" {
  const list = user.app_metadata?.providers || [user.app_metadata?.provider || ""];
  if (list.includes("google")) return "google";
  if (list.includes("phone")) return "phone";
  return "email";
}

/**
 * Hvor sidder brugeren fast? null = færdig, eller må/kan ikke få mailen.
 * Samme regler som appen (profileUtils.isOnboardingComplete, phoneVerification, profileCompleteness).
 */
export function rescueGroupFor(user: RescueUser, profile: RescueProfile | null): RescueGroup | null {
  const to = rescueEmailAddress(user);
  if (!to || /@(example\.|.*\.invalid$)/i.test(to)) return null;
  // Uden profil kan vi ikke lave et frameldingslink (email_unsubscribe_tokens → profiles).
  if (!profile) return null;
  if (profile.is_banned || profile.role === "admin") return null;
  // Har man selv afmeldt mails fra os, sender vi heller ikke denne.
  if (String(profile.notification_prefs?.email?.opdagelse ?? "") === "false") return null;

  const onboardingOk = profile.birth_year != null && Boolean(String(profile.play_style || "").trim());
  if (!onboardingOk) return "profile";
  const prov = provider(user);
  if (prov === "phone" && !user.email_confirmed_at) return "phone_email";
  if (!user.phone_confirmed_at && !profile.phone_verification_exempt) return prov === "google" ? "google_sms" : "email_sms";
  if (!String(profile.city || "").trim() || profile.latitude == null) return "city";
  return null;
}

const STEPS: Record<RescueGroup, { how: string; steps: string[] }> = {
  google_sms: {
    how: "Du mangler kun at bekræfte dit telefonnummer.",
    steps: [
      "Gå ind på padelmakker.dk og tryk «Log ind».",
      "Vælg «Fortsæt med Google».",
      "Tryk «Send SMS-kode», og skriv koden fra SMS’en.",
    ],
  },
  phone_email: {
    how: "Du mangler kun at bekræfte din mail.",
    steps: [
      "Gå ind på padelmakker.dk og tryk «Log ind».",
      "Skriv dit telefonnummer og din adgangskode.",
      "Tryk «Send bekræftelsesmail igen», og klik på linket i mailen.",
    ],
  },
  email_sms: {
    how: "Du mangler kun at bekræfte dit telefonnummer.",
    steps: [
      "Gå ind på padelmakker.dk og tryk «Log ind».",
      "Log ind med din mail og adgangskode.",
      "Tryk «Send SMS-kode», og skriv koden fra SMS’en.",
    ],
  },
  profile: {
    how: "Du mangler kun de sidste felter i din profil.",
    steps: [
      "Gå ind på padelmakker.dk og tryk «Log ind».",
      "Log ind, som da du oprettede dig (Google, mail eller telefonnummer).",
      "Udfyld de felter, appen beder om – det tager et par minutter.",
    ],
  },
  city: {
    how: "Du mangler kun at vælge din by, så spillere i nærheden kan finde dig.",
    steps: [
      "Gå ind på padelmakker.dk og tryk «Log ind».",
      "Log ind, som da du oprettede dig (Google, mail eller telefonnummer).",
      "Vælg din by fra listen.",
    ],
  },
};

function firstName(user: RescueUser, profile: RescueProfile | null): string {
  const raw = String(
    profile?.full_name || profile?.name || user.user_metadata?.full_name || user.user_metadata?.name || "",
  ).trim();
  const first = raw.split(/\s+/)[0] || "";
  if (!first || /^(ny|spiller)$/i.test(first)) return "";
  return first.charAt(0).toLocaleUpperCase("da-DK") + first.slice(1);
}

export type RescueEmail = { subject: string; preheader: string; text: string; html: string };

export function buildSignupRescueEmail(
  group: RescueGroup,
  user: RescueUser,
  profile: RescueProfile | null,
  opts: { siteUrl: string; unsubLink: string; cvr: string; todayLabel?: string },
): RescueEmail {
  const site = opts.siteUrl.replace(/\/+$/, "");
  const loginLink = withKilde(`${site}/login`, "signup_rescue");
  const name = firstName(user, profile);
  const greeting = name ? `Hej ${name}` : "Hej";
  const { how, steps } = STEPS[group];
  const subject = name ? `${name}, din profil på PadelMakker er næsten klar` : "Din profil på PadelMakker er næsten klar";
  const preheader = `${how} Vi har rettet en fejl, som kan have stoppet dig.`;
  const intro = "Du er begyndt at oprette en profil på PadelMakker, men blev ikke helt færdig. "
    + "Vi har fundet og rettet nogle fejl i oprettelsen, som kan have stoppet dig – undskyld for besværet.";

  const bodyHtml = `
    <div style="font-size:16px;font-weight:700;color:${NAVY};margin:16px 0 10px">${escapeHtml(how)}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${NAVY_BG};border-radius:14px">
      ${steps.map((s, i) => `
      <tr><td style="padding:${i === 0 ? 14 : 4}px 16px ${i === steps.length - 1 ? 14 : 6}px;font-size:14px;line-height:1.5;color:${TEXT_MID}">
        <b style="color:${NAVY}">${i + 1}.</b> ${escapeHtml(s)}
      </td></tr>`).join("")}
    </table>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:18px"><tr><td align="center">
      <a href="${escapeHtml(loginLink)}" style="display:block;background:${NAVY};color:#FFFFFF;text-decoration:none;font-size:15px;font-weight:700;border-radius:12px;padding:14px 16px">Log ind og bliv færdig →</a>
    </td></tr></table>
    <div style="font-size:13px;line-height:1.5;color:${TEXT_MID};margin-top:14px">Driller det stadig? Svar på denne mail eller skriv til kontakt@padelmakker.dk, så hjælper vi dig.</div>`;

  const footer = "Du får denne mail én gang, fordi du er begyndt at oprette en profil på PadelMakker.";
  const html = emailShellHtml({
    preheader,
    logo: `${site}/icon-192-v2.png`,
    todayLabel: opts.todayLabel ?? copenhagenDateLabel(),
    greeting,
    summaryHtml: escapeHtml(intro),
    bodyHtml,
    footerHtml: `${footer}<br><a href="${escapeHtml(opts.unsubLink)}" style="color:${NAVY}">Afmeld mails</a>
    ${legalLineHtml(opts, site)}`,
  });
  const text = `${greeting}\n\n${intro}\n\n${how}\n${steps.map((s, i) => `${i + 1}. ${s}`).join("\n")}\n\n`
    + `Log ind: ${loginLink}\n\nDriller det stadig? Svar på denne mail eller skriv til kontakt@padelmakker.dk.\n\n`
    + `${footer}\nAfmeld mails med ét klik: ${opts.unsubLink}\n\nPadelMakker · CVR ${opts.cvr} · ${site}/privatlivspolitik`;
  return { subject, preheader, text, html };
}
