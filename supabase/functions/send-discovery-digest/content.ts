// Ren indholdslogik til den daglige opsummering. Ingen Deno- eller npm-imports,
// så den kan testes direkte fra node (tests/unit/discoveryDigest.test.mjs).
//
// Design (ejeren godkendte udkastet 24. sep. 2026): personlig hilsen, appens
// blå farve og logo, kampe som kort med dato, tid, bane, niveau, ledige
// pladser og en "Meld dig til"-knap, og spillere med navn, niveau og region.
// Mangler detaljerne (fx en kamp der er slettet siden), bruges beskedens tekst.

export type DigestItem = {
  id: string;
  type: "match_watch_match" | "makker_suggestion" | string;
  title: string | null;
  body: string | null;
  match_id: string | null;
  entity_id: string | null;
  created_at: string;
};

export type DigestMatch = {
  id: string;
  date: string | null;
  time: string | null;
  time_end: string | null;
  court_name: string | null;
  court_id: string | null;
  level_range: string | null;
  current_players: number | null;
  max_players: number | null;
  price_per_person: number | null;
  creator_id: string | null;
};

export type DigestPlayer = {
  id: string;
  full_name: string | null;
  name: string | null;
  level: number | null;
  area: string | null;
  court_side: string | null;
};

export type DigestDetails = {
  recipientName?: string | null;
  matches?: Record<string, DigestMatch>;
  players?: Record<string, DigestPlayer>;
  /** Dagens dato i mailen, fx "Torsdag 24. september". */
  todayLabel?: string;
};

export type DigestEmail = {
  subject: string;
  preheader: string;
  text: string;
  html: string;
  itemIds: string[];
};

/** Højst så mange kort pr. afsnit; resten bliver til "og N mere". */
export const MAX_ITEMS_PER_SECTION = 5;

/** Opsummeringen sendes kl. 17 dansk tid. */
export const DIGEST_LOCAL_HOUR = 17;

const NAVY = "#16377E";
const NAVY_BG = "#EEF2FB";
const TEXT = "#0B1120";
const TEXT_MID = "#3E4C63";
const TEXT_LIGHT = "#596579";
const BORDER = "#E2E8F0";
const PAGE_BG = "#EEF2F8";

const WEEKDAYS_SHORT = ["SØN", "MAN", "TIR", "ONS", "TOR", "FRE", "LØR"];
const WEEKDAYS = ["Søndag", "Mandag", "Tirsdag", "Onsdag", "Torsdag", "Fredag", "Lørdag"];
const MONTHS_SHORT = ["jan", "feb", "mar", "apr", "maj", "jun", "jul", "aug", "sep", "okt", "nov", "dec"];
const MONTHS = ["januar", "februar", "marts", "april", "maj", "juni", "juli", "august", "september", "oktober", "november", "december"];

export function copenhagenHour(now: Date = new Date()): number {
  const h = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Copenhagen",
    hour: "2-digit",
    hourCycle: "h23",
  }).format(now);
  return Number(h);
}

/** "Torsdag 24. september" i dansk tid. */
export function copenhagenDateLabel(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Copenhagen",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  const d = parseYmd(parts);
  if (!d) return "";
  return `${WEEKDAYS[d.weekday]} ${d.day}. ${MONTHS[d.month - 1]}`;
}

/**
 * Mærker et link med hvilken mail det kom fra, fx ?kilde=digest. Appen gemmer
 * mærket, når personen er logget ind (log_app_return), så vi kan se, om
 * mailene får folk tilbage. Framelding og privatlivspolitik mærkes ikke.
 */
export function withKilde(url: string, kilde: string | null | undefined): string {
  const k = String(kilde || "").trim().toLowerCase();
  if (!k || !/^[a-z0-9_-]{1,32}$/.test(k)) return url;
  const hashAt = url.indexOf("#");
  const base = hashAt >= 0 ? url.slice(0, hashAt) : url;
  const hash = hashAt >= 0 ? url.slice(hashAt) : "";
  return `${base}${base.includes("?") ? "&" : "?"}kilde=${encodeURIComponent(k)}${hash}`;
}

function escapeHtml(value: string) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function plural(n: number, ental: string, flertal: string) {
  return `${n} ${n === 1 ? ental : flertal}`;
}

function parseYmd(value: string | null | undefined) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value || ""));
  if (!m) return null;
  const y = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const weekday = new Date(Date.UTC(y, month - 1, day)).getUTCDay();
  return { y, month, day, weekday };
}

function clock(value: string | null | undefined) {
  const m = /^(\d{1,2}):(\d{2})/.exec(String(value || ""));
  return m ? `${m[1].padStart(2, "0")}:${m[2]}` : "";
}

/** Samme omregning som eloToLevel i appen: 800 = 1,0 og 400/6 pr. niveau. */
function eloToLevel(elo: number) {
  const raw = 1 + (elo - 800) / (400 / 6);
  return Math.round(Math.max(1, Math.min(7, raw)) * 10) / 10;
}

export function matchLevelLabel(levelRange: string | null | undefined) {
  const m = /elo:(\d{2,4})-(\d{2,4})/i.exec(String(levelRange || ""));
  if (!m) return "";
  const a = eloToLevel(Number(m[1]));
  const b = eloToLevel(Number(m[2]));
  return `Niveau ${Math.min(a, b).toFixed(1)}–${Math.max(a, b).toFixed(1)}`;
}

function isBooked(match: DigestMatch) {
  if (/booked:yes/i.test(String(match.level_range || ""))) return true;
  return Boolean(match.court_id);
}

function regionLabel(area: string | null | undefined) {
  return String(area || "").replace(/^Region\s+/i, "").trim();
}

function firstName(p: { full_name?: string | null; name?: string | null } | null | undefined) {
  const n = String(p?.full_name || p?.name || "").trim();
  return n ? n.split(/\s+/)[0] : "";
}

function fullName(p: DigestPlayer | null | undefined) {
  return String(p?.full_name || p?.name || "").trim();
}

function initials(name: string) {
  const parts = name.split(/\s+/).filter(Boolean);
  const s = (parts[0]?.[0] || "") + (parts.length > 1 ? parts[parts.length - 1][0] : "");
  return (s || "?").toUpperCase();
}

function courtSidePhrase(side: string | null | undefined) {
  const s = String(side || "").toLowerCase();
  if (s.startsWith("venstre")) return "spiller venstre";
  if (s.startsWith("højre") || s.startsWith("hojre")) return "spiller højre";
  if (s.startsWith("begge")) return "spiller begge sider";
  return "";
}

export function splitItems(items: DigestItem[]) {
  const seen = new Set<string>();
  const matches: DigestItem[] = [];
  const makkere: DigestItem[] = [];
  for (const it of items || []) {
    // Samme kamp eller samme spiller kan ligge der to gange; vis den én gang.
    const key = it.type === "match_watch_match"
      ? `m:${it.match_id || it.id}`
      : `p:${it.entity_id || it.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (it.type === "match_watch_match") matches.push(it);
    else if (it.type === "makker_suggestion") makkere.push(it);
  }
  return { matches, makkere };
}

export function digestSubject(matchCount: number, makkerCount: number): string {
  const parts: string[] = [];
  if (matchCount > 0) parts.push(plural(matchCount, "ny kamp", "nye kampe"));
  if (makkerCount > 0) parts.push(plural(makkerCount, "makker", "makkere"));
  return `${parts.join(" og ")} på dit niveau`.replace(/^./, (c) => c.toUpperCase());
}

type MatchCard = {
  dateShort: { weekday: string; day: string; month: string } | null;
  headline: string;
  place: string;
  level: string;
  spotsLeft: number | null;
  creator: string;
  price: string;
  link: string;
  fallback: string;
};

type PlayerCard = {
  name: string;
  meta: string;
  initials: string;
  link: string;
  fallback: string;
};

function buildMatchCard(it: DigestItem, details: DigestDetails, site: string, kilde: string): MatchCard {
  const m = it.match_id ? details.matches?.[it.match_id] : undefined;
  const link = withKilde(
    it.match_id ? `${site}/dashboard/kampe/2v2/${encodeURIComponent(it.match_id)}` : `${site}/dashboard/kampe`,
    kilde,
  );
  const fallback = String(it.body || it.title || "").trim();
  if (!m) {
    return { dateShort: null, headline: fallback || "Ny kamp", place: "", level: "", spotsLeft: null, creator: "", price: "", link, fallback };
  }
  const d = parseYmd(m.date);
  const start = clock(m.time);
  const end = clock(m.time_end);
  const creatorProfile = m.creator_id ? details.players?.[m.creator_id] : undefined;
  const booked = isBooked(m);
  const courtName = String(m.court_name || "").trim();
  const region = regionLabel(creatorProfile?.area);
  const place = booked && courtName
    ? `${courtName} · bane booket`
    : ["Bane ikke valgt endnu", region].filter(Boolean).join(" · ");
  const max = Number(m.max_players) || 4;
  const cur = Number(m.current_players) || 0;
  const price = Number(m.price_per_person) > 0
    ? `${Math.round(Number(m.price_per_person))} kr. pr. person`
    : "gratis";
  const creator = firstName(creatorProfile);
  return {
    dateShort: d ? { weekday: WEEKDAYS_SHORT[d.weekday], day: String(d.day), month: MONTHS_SHORT[d.month - 1] } : null,
    headline: start ? `kl. ${start}${end ? `–${end}` : ""}` : "Tidspunkt aftales",
    place,
    level: matchLevelLabel(m.level_range),
    spotsLeft: Math.max(0, max - cur),
    creator: creator ? `Oprettet af ${creator} · ${price}` : price.replace(/^./, (c) => c.toUpperCase()),
    price,
    link,
    fallback,
  };
}

function buildPlayerCard(it: DigestItem, details: DigestDetails, site: string, kilde: string): PlayerCard {
  const p = it.entity_id ? details.players?.[it.entity_id] : undefined;
  const link = withKilde(
    it.entity_id ? `${site}/dashboard/makkere?profile=${encodeURIComponent(it.entity_id)}` : `${site}/dashboard/makkere`,
    kilde,
  );
  const fallback = String(it.body || it.title || "").trim();
  const name = fullName(p);
  if (!p || !name) {
    return { name: fallback || "Ny makker", meta: "", initials: "?", link, fallback };
  }
  const lvl = Number(p.level);
  const meta = [
    Number.isFinite(lvl) && lvl > 0 ? `Niveau ${lvl.toFixed(1)}` : "",
    regionLabel(p.area),
    courtSidePhrase(p.court_side),
  ].filter(Boolean).join(" · ");
  return { name, meta, initials: initials(name), link, fallback };
}

function spotsChip(n: number | null) {
  if (n == null) return "";
  if (n <= 0) return chip("Fuld", "#3E4C63", "#F1F5F9");
  if (n === 1) return chip("1 plads tilbage", "#92400E", "#FEF3C7");
  return chip(`${n} pladser tilbage`, "#166534", "#DCFCE7");
}

function chip(label: string, color: string, bg: string) {
  return `<span style="display:inline-block;font-size:12px;font-weight:600;color:${color};background:${bg};border-radius:999px;padding:3px 10px;margin:0 4px 4px 0">${escapeHtml(label)}</span>`;
}

function matchCardHtml(c: MatchCard) {
  const dateBox = c.dateShort
    ? `<td width="64" align="center" style="padding:14px 0 14px 14px;vertical-align:top">
          <div style="background:${NAVY_BG};border-radius:10px;padding:8px 0;width:54px">
            <div style="font-size:11px;font-weight:700;color:${NAVY};letter-spacing:.05em">${escapeHtml(c.dateShort.weekday)}</div>
            <div style="font-size:22px;font-weight:800;color:${TEXT};line-height:1.1">${escapeHtml(c.dateShort.day)}</div>
            <div style="font-size:11px;color:${TEXT_LIGHT}">${escapeHtml(c.dateShort.month)}</div>
          </div>
        </td>`
    : "";
  const chips = [c.level ? chip(c.level, NAVY, NAVY_BG) : "", spotsChip(c.spotsLeft)].join("");
  return `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${BORDER};border-radius:14px;margin:0 0 10px">
        <tr>
          ${dateBox}
          <td style="padding:14px 14px 14px 12px;vertical-align:top">
            <div style="font-size:16px;font-weight:700;color:${TEXT}">${escapeHtml(c.headline)}</div>
            ${c.place ? `<div style="font-size:13px;color:${TEXT_MID};margin:2px 0 8px">${escapeHtml(c.place)}</div>` : ""}
            ${chips ? `<div>${chips}</div>` : ""}
            ${c.creator ? `<div style="font-size:12px;color:${TEXT_LIGHT};margin:4px 0 12px">${escapeHtml(c.creator)}</div>` : `<div style="height:10px"></div>`}
            <a href="${escapeHtml(c.link)}" style="display:inline-block;background:${NAVY};color:#FFFFFF;text-decoration:none;font-size:14px;font-weight:700;border-radius:10px;padding:10px 18px">Meld dig til</a>
          </td>
        </tr>
      </table>`;
}

function playerCardHtml(c: PlayerCard) {
  return `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${BORDER};border-radius:14px;margin:0 0 10px">
        <tr>
          <td width="56" style="padding:14px 0 14px 14px;vertical-align:middle">
            <div style="width:44px;height:44px;border-radius:22px;background:#DBEAFE;color:${NAVY};font-size:16px;font-weight:800;text-align:center;line-height:44px">${escapeHtml(c.initials)}</div>
          </td>
          <td style="padding:14px 8px 14px 12px;vertical-align:middle">
            <div style="font-size:15px;font-weight:700;color:${TEXT}">${escapeHtml(c.name)}</div>
            ${c.meta ? `<div style="font-size:13px;color:${TEXT_MID}">${escapeHtml(c.meta)}</div>` : ""}
          </td>
          <td align="right" style="padding:14px 14px 14px 0;vertical-align:middle">
            <a href="${escapeHtml(c.link)}" style="display:inline-block;border:1.5px solid ${NAVY};color:${NAVY};text-decoration:none;font-size:13px;font-weight:700;border-radius:10px;padding:8px 12px;white-space:nowrap">Se profil</a>
          </td>
        </tr>
      </table>`;
}

function sectionHeadingHtml(label: string, first: boolean) {
  return `<div style="font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:${TEXT_LIGHT};margin:${first ? 18 : 22}px 4px 10px">${escapeHtml(label)}</div>`;
}

function moreRowHtml(more: number, link: string, noun: string) {
  return `<div style="margin:2px 4px 0;font-size:14px"><a href="${escapeHtml(link)}" style="color:${NAVY};font-weight:700;text-decoration:none">og ${more} ${noun} mere →</a></div>`;
}

function preheaderFor(matchCards: MatchCard[], playerCards: PlayerCard[]) {
  const m = matchCards[0];
  if (m?.dateShort && m.spotsLeft != null && m.spotsLeft > 0) {
    const day = `${m.dateShort.weekday.charAt(0)}${m.dateShort.weekday.slice(1).toLowerCase()} ${m.dateShort.day}. ${m.dateShort.month}`;
    const spillere = plural(m.spotsLeft, "spiller", "spillere");
    return `${day} ${m.headline}: en kamp på dit niveau mangler ${spillere}.`;
  }
  const p = playerCards[0];
  if (p && p.initials !== "?") return `${p.name.split(/\s+/)[0]} søger makker på dit niveau.`;
  return "Nye kampe og makkere, der passer til dig.";
}

type ShellParts = {
  preheader: string;
  logo: string;
  todayLabel: string;
  greeting: string;
  /** Html: teksten under hilsenen i den blå top. */
  summaryHtml: string;
  /** Html: indholdet i det hvide kort. */
  bodyHtml: string;
  /** Html: linjerne i foden under kortet. */
  footerHtml: string;
};

/** Mailens ramme: logo og dato, blå top med hilsen, hvidt kort og fod. */
function emailShellHtml(v: ShellParts): string {
  return `<!doctype html>
<html lang="da">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><meta name="color-scheme" content="light"></head>
<body style="margin:0;padding:0;background:${PAGE_BG};font-family:-apple-system,'Segoe UI',Roboto,Arial,sans-serif;color:${TEXT}">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all">${escapeHtml(v.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${PAGE_BG}">
<tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px">
  <tr><td style="padding:0 4px 14px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
      <td style="vertical-align:middle">
        <img src="${escapeHtml(v.logo)}" width="32" height="32" alt="" style="vertical-align:middle;border-radius:8px;border:0">
        <span style="font-size:16px;font-weight:800;color:${NAVY};vertical-align:middle;margin-left:6px">PadelMakker</span>
      </td>
      <td align="right" style="font-size:12px;color:${TEXT_LIGHT}">${escapeHtml(v.todayLabel)}</td>
    </tr></table>
  </td></tr>
  <tr><td style="background:${NAVY};border-radius:16px 16px 0 0;padding:26px 24px 22px;color:#FFFFFF">
    <div style="font-size:22px;font-weight:800;line-height:1.25;margin:0 0 6px;color:#FFFFFF">${escapeHtml(v.greeting)} 👋</div>
    <div style="font-size:15px;line-height:1.5;color:#D6E0F5">${v.summaryHtml}</div>
  </td></tr>
  <tr><td style="background:#FFFFFF;border-radius:0 0 16px 16px;padding:8px 20px 22px">
    ${v.bodyHtml}
  </td></tr>
  <tr><td style="padding:18px 12px 0;font-size:12px;line-height:1.55;color:${TEXT_LIGHT};text-align:center">
    ${v.footerHtml}
  </td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

function legalLineHtml(opts: { cvr: string }, site: string) {
  return `<div style="margin-top:10px;font-size:11px;color:#8795AA">PadelMakker · CVR ${escapeHtml(opts.cvr)} · <a href="${escapeHtml(site)}/privatlivspolitik" style="color:#8795AA">Privatlivspolitik</a></div>`;
}

export type EmailOpts = {
  siteUrl: string;
  unsubLink: string;
  cvr: string;
  /** Mærket på links (withKilde). Standard: "digest". */
  kilde?: string;
};

export function buildDigestEmail(
  items: DigestItem[],
  opts: EmailOpts,
  details: DigestDetails = {},
): DigestEmail | null {
  const { matches, makkere } = splitItems(items);
  if (matches.length === 0 && makkere.length === 0) return null;

  const site = opts.siteUrl.replace(/\/+$/, "");
  const kilde = opts.kilde ?? "digest";
  const prefsLink = withKilde(`${site}/dashboard/notifikationer`, kilde);
  const kampeLink = withKilde(`${site}/dashboard/kampe`, kilde);
  const makkereLink = withKilde(`${site}/dashboard/makkere`, kilde);
  const logo = `${site}/icon-192-v2.png`;
  const name = String(details.recipientName || "").trim();
  const greeting = name ? `Hej ${name}` : "Hej";
  const todayLabel = details.todayLabel ?? copenhagenDateLabel();

  const matchCards = matches.map((it) => buildMatchCard(it, details, site, kilde));
  const playerCards = makkere.map((it) => buildPlayerCard(it, details, site, kilde));
  const shownMatches = matchCards.slice(0, MAX_ITEMS_PER_SECTION);
  const shownPlayers = playerCards.slice(0, MAX_ITEMS_PER_SECTION);
  const moreMatches = matchCards.length - shownMatches.length;
  const morePlayers = playerCards.length - shownPlayers.length;

  const summaryParts: string[] = [];
  if (matches.length) summaryParts.push(`<b style="color:#FFFFFF">${plural(matches.length, "kamp", "kampe")}</b> på dit niveau i dit område`);
  if (makkere.length) summaryParts.push(`<b style="color:#FFFFFF">${plural(makkere.length, "spiller", "spillere")}</b> søger makker`);
  const summaryHtml = `Der er ${summaryParts.join(", og ")}.`;
  const summaryText = summaryHtml.replace(/<[^>]+>/g, "");

  const preheader = preheaderFor(matchCards, playerCards);
  const subject = digestSubject(matches.length, makkere.length);

  // --- Tekstudgave (til mailprogrammer uden html) ---
  const textSections: string[] = [];
  if (shownMatches.length) {
    textSections.push([
      "Kampe der passer til dig",
      ...shownMatches.map((c) => {
        const date = c.dateShort ? `${c.dateShort.weekday} ${c.dateShort.day}. ${c.dateShort.month} ` : "";
        const line = c.dateShort
          ? [`${date}${c.headline}`, c.place, c.level, c.spotsLeft != null ? plural(c.spotsLeft, "plads tilbage", "pladser tilbage") : ""].filter(Boolean).join(" · ")
          : c.fallback;
        return `- ${line}\n  Meld dig til: ${c.link}`;
      }),
      ...(moreMatches > 0 ? [`- og ${moreMatches} mere: ${kampeLink}`] : []),
    ].join("\n"));
  }
  if (shownPlayers.length) {
    textSections.push([
      "Spillere der søger makker",
      ...shownPlayers.map((c) => `- ${[c.name, c.meta].filter(Boolean).join(" · ")}\n  Se profil: ${c.link}`),
      ...(morePlayers > 0 ? [`- og ${morePlayers} mere: ${makkereLink}`] : []),
    ].join("\n"));
  }
  const footerText =
    `Du får denne mail, fordi du har slået besked om nye kampe og makkere til.\n` +
    `Vi samler nyhederne i én mail om dagen kl. 17.\n` +
    `Skift hvad du får besked om: ${prefsLink}\n` +
    `Afmeld mails med ét klik: ${opts.unsubLink}\n\n` +
    `PadelMakker · CVR ${opts.cvr} · ${site}/privatlivspolitik`;
  const text = `${greeting}\n\n${summaryText}\n\n${textSections.join("\n\n")}\n\nSe alle kampe i appen: ${kampeLink}\n\n${footerText}`;

  // --- Html ---
  let sectionsHtml = "";
  if (shownMatches.length) {
    sectionsHtml += sectionHeadingHtml("Kampe der passer til dig", true);
    sectionsHtml += shownMatches.map(matchCardHtml).join("");
    if (moreMatches > 0) sectionsHtml += moreRowHtml(moreMatches, kampeLink, moreMatches === 1 ? "kamp" : "kampe");
  }
  if (shownPlayers.length) {
    sectionsHtml += sectionHeadingHtml("Spillere der søger makker", !shownMatches.length);
    sectionsHtml += shownPlayers.map(playerCardHtml).join("");
    if (morePlayers > 0) sectionsHtml += moreRowHtml(morePlayers, makkereLink, morePlayers === 1 ? "spiller" : "spillere");
  }

  const html = emailShellHtml({
    preheader,
    logo,
    todayLabel,
    greeting,
    summaryHtml,
    bodyHtml: `${sectionsHtml}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:18px"><tr><td align="center">
      <a href="${escapeHtml(kampeLink)}" style="display:block;background:${NAVY_BG};color:${NAVY};text-decoration:none;font-size:14px;font-weight:700;border-radius:12px;padding:13px 16px">Se alle kampe i appen →</a>
    </td></tr></table>`,
    footerHtml: `Du får denne mail, fordi du har slået besked om nye kampe og makkere til.<br>
    Vi samler nyhederne i én mail om dagen kl. 17.<br>
    <a href="${escapeHtml(prefsLink)}" style="color:${NAVY}">Skift hvad du får besked om</a> · <a href="${escapeHtml(opts.unsubLink)}" style="color:${NAVY}">Afmeld mails</a>
    ${legalLineHtml(opts, site)}`,
  });

  const itemIds = (items || []).map((it) => it.id).filter(Boolean);
  return { subject, preheader, text, html, itemIds };
}

// --- Engangsmail til inaktive (send-winback) ------------------------------

export type WinbackEmail = {
  subject: string;
  preheader: string;
  text: string;
  html: string;
  matchCount: number;
  playerCount: number;
};

/** Det nye i appen, som den inaktive ikke har set. */
export const WINBACK_NEWS: { title: string; body: string }[] = [
  {
    title: "Jeg vil spille",
    body: "Vælg dag og tidsrum. Vi opretter kampen og giver besked til spillere på dit niveau i nærheden – du skal bare have tre til at sige ja.",
  },
  {
    title: "Vælg selv dit niveau",
    body: "Sæt selv fra og til, fx 3,0 til 3,6, så du kun hører om kampe og makkere, der passer til dig.",
  },
  {
    title: "Højst én mail om dagen",
    body: "Kl. 17, og kun når der er noget nyt til dig. Du kan altid slå det fra.",
  },
];

function capitalizeName(name: string) {
  const n = String(name || "").trim();
  return n ? n.charAt(0).toUpperCase() + n.slice(1) : "";
}

/**
 * Engangsmailen til dem, der ikke har været inde i 30 dage. Samme udseende
 * som den daglige mail. Har personen kampe eller spillere i nærheden, vises
 * de som kort; ellers kun det nye i appen og knappen "Jeg vil spille".
 */
export function buildWinbackEmail(
  input: { matchIds: string[]; playerIds: string[] },
  opts: EmailOpts,
  details: DigestDetails = {},
): WinbackEmail {
  const site = opts.siteUrl.replace(/\/+$/, "");
  const kilde = opts.kilde ?? "winback";
  const prefsLink = withKilde(`${site}/dashboard/notifikationer`, kilde);
  const kampeLink = withKilde(`${site}/dashboard/kampe`, kilde);
  const playLink = withKilde(`${site}/dashboard`, kilde);
  const logo = `${site}/icon-192-v2.png`;
  const name = capitalizeName(String(details.recipientName || ""));
  const greeting = name ? `Hej ${name}` : "Hej";
  const todayLabel = details.todayLabel ?? copenhagenDateLabel();

  // Kun kampe og spillere, vi faktisk har detaljerne på. En kamp der er
  // slettet siden, skal ikke stå som et tomt kort.
  const matchCards = (input.matchIds || [])
    .filter((id) => details.matches?.[id])
    .slice(0, MAX_ITEMS_PER_SECTION)
    .map((id) => buildMatchCard(
      { id, type: "match_watch_match", title: null, body: null, match_id: id, entity_id: null, created_at: "" },
      details, site, kilde,
    ));
  const playerCards = (input.playerIds || [])
    .filter((id) => fullName(details.players?.[id]))
    .slice(0, MAX_ITEMS_PER_SECTION)
    .map((id) => buildPlayerCard(
      { id, type: "makker_suggestion", title: null, body: null, match_id: null, entity_id: id, created_at: "" },
      details, site, kilde,
    ));

  const hasItems = matchCards.length > 0 || playerCards.length > 0;
  const whatParts: string[] = [];
  if (matchCards.length) whatParts.push(plural(matchCards.length, "åben kamp", "åbne kampe"));
  if (playerCards.length) whatParts.push(plural(playerCards.length, "spiller der søger makker", "spillere der søger makker"));
  const what = whatParts.join(" og ");

  const intro = "Det er et stykke tid siden, du var inde på PadelMakker.";
  const summaryHtml = hasItems
    ? `${intro} Lige nu er der <b style="color:#FFFFFF">${escapeHtml(what)}</b> på dit niveau tæt på dig.`
    : `${intro} Siden da er det blevet meget nemmere at komme ud og spille.`;
  const summaryText = summaryHtml.replace(/<[^>]+>/g, "");

  const shortParts: string[] = [];
  if (matchCards.length) shortParts.push(plural(matchCards.length, "kamp", "kampe"));
  if (playerCards.length) shortParts.push(plural(playerCards.length, "makker", "makkere"));
  const subjectCore = hasItems
    ? `${shortParts.join(" og ")} på dit niveau nær dig`
    : "nu er det nemmere at finde nogen at spille padel med";
  const subject = name ? `${name}, ${subjectCore}` : subjectCore.replace(/^./, (c) => c.toUpperCase());
  const preheader = hasItems
    ? preheaderFor(matchCards, playerCards)
    : "Vælg dag og tid – så finder vi de andre tre.";

  let bodyHtml = "";
  if (matchCards.length) {
    bodyHtml += sectionHeadingHtml("Kampe der passer til dig", true);
    bodyHtml += matchCards.map(matchCardHtml).join("");
  }
  if (playerCards.length) {
    bodyHtml += sectionHeadingHtml("Spillere der søger makker", !matchCards.length);
    bodyHtml += playerCards.map(playerCardHtml).join("");
  }
  bodyHtml += sectionHeadingHtml("Nyt i PadelMakker", !hasItems);
  bodyHtml += `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${NAVY_BG};border-radius:14px">`
    + WINBACK_NEWS.map((n, i) => `
      <tr><td style="padding:${i === 0 ? 14 : 4}px 16px ${i === WINBACK_NEWS.length - 1 ? 14 : 8}px">
        <div style="font-size:14px;font-weight:700;color:${NAVY}">${escapeHtml(n.title)}</div>
        <div style="font-size:13px;line-height:1.5;color:${TEXT_MID}">${escapeHtml(n.body)}</div>
      </td></tr>`).join("")
    + `</table>`;
  bodyHtml += `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:18px"><tr><td align="center">
      <a href="${escapeHtml(playLink)}" style="display:block;background:${NAVY};color:#FFFFFF;text-decoration:none;font-size:15px;font-weight:700;border-radius:12px;padding:14px 16px">Jeg vil spille →</a>
    </td></tr></table>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:10px"><tr><td align="center">
      <a href="${escapeHtml(kampeLink)}" style="display:block;background:${NAVY_BG};color:${NAVY};text-decoration:none;font-size:14px;font-weight:700;border-radius:12px;padding:13px 16px">Se alle kampe i appen</a>
    </td></tr></table>`;

  const html = emailShellHtml({
    preheader,
    logo,
    todayLabel,
    greeting,
    summaryHtml,
    bodyHtml,
    footerHtml: `Du får denne mail én gang, fordi du har en profil på PadelMakker og har slået besked om nye kampe og makkere til.<br>
    <a href="${escapeHtml(prefsLink)}" style="color:${NAVY}">Skift hvad du får besked om</a> · <a href="${escapeHtml(opts.unsubLink)}" style="color:${NAVY}">Afmeld mails</a>
    ${legalLineHtml(opts, site)}`,
  });

  const textSections: string[] = [];
  if (matchCards.length) {
    textSections.push([
      "Kampe der passer til dig",
      ...matchCards.map((c) => {
        const date = c.dateShort ? `${c.dateShort.weekday} ${c.dateShort.day}. ${c.dateShort.month} ` : "";
        const line = [`${date}${c.headline}`, c.place, c.level, c.spotsLeft != null ? plural(c.spotsLeft, "plads tilbage", "pladser tilbage") : ""]
          .filter(Boolean).join(" · ");
        return `- ${line}\n  Meld dig til: ${c.link}`;
      }),
    ].join("\n"));
  }
  if (playerCards.length) {
    textSections.push([
      "Spillere der søger makker",
      ...playerCards.map((c) => `- ${[c.name, c.meta].filter(Boolean).join(" · ")}\n  Se profil: ${c.link}`),
    ].join("\n"));
  }
  textSections.push([
    "Nyt i PadelMakker",
    ...WINBACK_NEWS.map((n) => `- ${n.title}: ${n.body}`),
  ].join("\n"));
  const text = `${greeting}\n\n${summaryText}\n\n${textSections.join("\n\n")}\n\n`
    + `Jeg vil spille: ${playLink}\nSe alle kampe i appen: ${kampeLink}\n\n`
    + `Du får denne mail én gang, fordi du har en profil på PadelMakker og har slået besked om nye kampe og makkere til.\n`
    + `Skift hvad du får besked om: ${prefsLink}\n`
    + `Afmeld mails med ét klik: ${opts.unsubLink}\n\n`
    + `PadelMakker · CVR ${opts.cvr} · ${site}/privatlivspolitik`;

  return { subject, preheader, text, html, matchCount: matchCards.length, playerCount: playerCards.length };
}
