// Ren indholdslogik til den daglige opsummering. Ingen Deno- eller npm-imports,
// så den kan testes direkte fra node (tests/unit/discoveryDigest.test.mjs).

export type DigestItem = {
  id: string;
  type: "match_watch_match" | "makker_suggestion" | string;
  title: string | null;
  body: string | null;
  match_id: string | null;
  entity_id: string | null;
  created_at: string;
};

export type DigestEmail = {
  subject: string;
  text: string;
  html: string;
  itemIds: string[];
};

/** Højst så mange linjer pr. afsnit; resten bliver til "og N mere". */
export const MAX_ITEMS_PER_SECTION = 5;

/** Opsummeringen sendes kl. 17 dansk tid. */
export const DIGEST_LOCAL_HOUR = 17;

export function copenhagenHour(now: Date = new Date()): number {
  const h = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Copenhagen",
    hour: "2-digit",
    hourCycle: "h23",
  }).format(now);
  return Number(h);
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
  return `I dag på PadelMakker: ${parts.join(" og ")}, der passer til dig`;
}

export function buildDigestEmail(
  items: DigestItem[],
  opts: { siteUrl: string; unsubLink: string; cvr: string },
): DigestEmail | null {
  const { matches, makkere } = splitItems(items);
  if (matches.length === 0 && makkere.length === 0) return null;

  const site = opts.siteUrl.replace(/\/+$/, "");
  const prefsLink = `${site}/dashboard/notifikationer`;
  const overviewLink = `${site}/dashboard/notifikationer`;
  const line = (it: DigestItem) => String(it.body || it.title || "").trim();
  const matchLink = (it: DigestItem) =>
    it.match_id ? `${site}/dashboard/kampe/2v2/${encodeURIComponent(it.match_id)}` : `${site}/dashboard/kampe`;
  const makkerLink = (it: DigestItem) =>
    it.entity_id ? `${site}/dashboard/makkere?profile=${encodeURIComponent(it.entity_id)}` : `${site}/dashboard/makkere`;

  const sections = [
    { heading: matches.length === 1 ? "Ny kamp nær dig" : "Nye kampe nær dig", list: matches, link: matchLink, rest: `${site}/dashboard/kampe` },
    { heading: makkere.length === 1 ? "Spiller der søger makker" : "Spillere der søger makker", list: makkere, link: makkerLink, rest: `${site}/dashboard/makkere` },
  ].filter((s) => s.list.length > 0);

  const textSections = sections.map((s) => {
    const shown = s.list.slice(0, MAX_ITEMS_PER_SECTION);
    const more = s.list.length - shown.length;
    return [
      s.heading,
      ...shown.map((it) => `- ${line(it)}\n  ${s.link(it)}`),
      ...(more > 0 ? [`- og ${more} mere: ${s.rest}`] : []),
    ].join("\n");
  });

  const htmlSections = sections.map((s) => {
    const shown = s.list.slice(0, MAX_ITEMS_PER_SECTION);
    const more = s.list.length - shown.length;
    const rows = shown.map((it) => `
          <li style="margin:0 0 8px">
            <a href="${escapeHtml(s.link(it))}" style="color:#111;text-decoration:none">${escapeHtml(line(it))}</a>
          </li>`).join("");
    const moreRow = more > 0
      ? `<li style="margin:0 0 8px"><a href="${escapeHtml(s.rest)}" style="color:#0B6E4F">og ${more} mere</a></li>`
      : "";
    return `
          <h2 style="margin:18px 0 8px;font-size:15px;font-weight:700">${escapeHtml(s.heading)}</h2>
          <ul style="margin:0;padding-left:18px">${rows}${moreRow}</ul>`;
  }).join("");

  const footerText =
    `Du får denne mail, fordi du har en profil på PadelMakker, og besked om nye\n` +
    `makkere og kampe er slået til på din konto. Nyheder samles i én mail om dagen.\n` +
    `Afmeld med ét klik: ${opts.unsubLink}\n` +
    `Eller administrér i appen: ${prefsLink}\n\n` +
    `PadelMakker · CVR ${opts.cvr} · ${site}/privatlivspolitik`;

  const text = `I dag på PadelMakker\n\n${textSections.join("\n\n")}\n\nSe alt i appen: ${overviewLink}\n\n${footerText}`;

  const html = `
        <div style="font-family:system-ui,Segoe UI,Arial,sans-serif;line-height:1.5;color:#111;max-width:560px">
          <p style="margin:0 0 4px;font-size:13px;color:#666">PadelMakker</p>
          <h1 style="margin:0 0 4px;font-size:18px;font-weight:700">I dag på PadelMakker</h1>
          ${htmlSections}
          <p style="margin:20px 0 24px">
            <a href="${escapeHtml(overviewLink)}" style="display:inline-block;padding:10px 16px;background:#0B6E4F;color:#fff;text-decoration:none;border-radius:8px;font-weight:600">
              Åbn PadelMakker
            </a>
          </p>
          <p style="margin:0 0 6px;font-size:12px;color:#666">
            Du får denne mail, fordi du har en profil på PadelMakker, og besked om nye
            makkere og kampe er slået til på din konto. Nyheder samles i én mail om dagen.
            <a href="${escapeHtml(opts.unsubLink)}" style="color:#0B6E4F">Afmeld</a>
            ·
            <a href="${escapeHtml(prefsLink)}" style="color:#0B6E4F">Administrér i appen</a>
          </p>
          <p style="margin:0;font-size:11px;color:#888">
            PadelMakker · CVR ${escapeHtml(opts.cvr)} ·
            <a href="${escapeHtml(site)}/privatlivspolitik" style="color:#888">Privatlivspolitik</a>
          </p>
        </div>`.trim();

  const itemIds = (items || []).map((it) => it.id).filter(Boolean);
  return { subject: digestSubject(matches.length, makkere.length), text, html, itemIds };
}
