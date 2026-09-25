/**
 * GET /api/kamp-preview?id=<kamp-id> — link-forhåndsvisning af en delt kamp.
 * GET /api/turnering-preview?id=<turnerings-id> — samme for Americano/Mexicano.
 *
 * Deler man /kamp/<id> på WhatsApp, Messenger, iMessage eller Slack, henter
 * de siden for at lave et kort under linket. De kører ikke JavaScript, så de
 * så kun forsidens standardtekst. vercel.json sender kun deres robotter hertil
 * (user-agent), aldrig almindelige besøgende; de får appen som før.
 *
 * Svaret er en lille html-side med og:title/og:description ud fra
 * public_match_preview (samme offentlige oplysninger som kampsiden: ingen
 * deltagernavne, kun opretterens fornavn).
 */
/* global process */
import { matchPreviewMeta, shareMatchUrl } from '../../src/lib/matchShareText.js';
import { shareTournamentUrl, tournamentPreviewMeta } from '../../src/lib/tournamentShareText.js';

const SITE = (process.env.VITE_SITE_URL || process.env.SITE_URL || 'https://www.padelmakker.dk').replace(/\/+$/, '');
const SUPABASE_URL = (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '').replace(/\/+$/, '');
const ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const FALLBACK = {
  title: 'Padel-kamp på PadelMakker',
  description: 'Find padelspillere på dit niveau og meld dig til kampe. Gratis profil.',
};

const TOURNAMENT_FALLBACK = {
  title: 'Americano/Mexicano på PadelMakker',
  description: 'Find padelspillere på dit niveau og meld dig til turneringer. Gratis profil.',
};

export function escapeHtmlAttr(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function renderMatchPreviewHtml({ title, description, url, image }) {
  const t = escapeHtmlAttr(title);
  const d = escapeHtmlAttr(description);
  const u = escapeHtmlAttr(url);
  const i = escapeHtmlAttr(image);
  return `<!doctype html>
<html lang="da"><head>
<meta charset="utf-8">
<title>${t}</title>
<meta name="description" content="${d}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="PadelMakker">
<meta property="og:locale" content="da_DK">
<meta property="og:title" content="${t}">
<meta property="og:description" content="${d}">
<meta property="og:url" content="${u}">
<meta property="og:image" content="${i}">
<meta name="twitter:card" content="summary">
<meta name="twitter:title" content="${t}">
<meta name="twitter:description" content="${d}">
<link rel="canonical" href="${u}">
</head><body><a href="${u}">${t}</a></body></html>`;
}

async function fetchPreviewRow(rpc, args) {
  if (!SUPABASE_URL || !ANON_KEY) return null;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 4000);
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${rpc}`, {
      method: 'POST',
      headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(args),
      signal: ctrl.signal,
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data && data.found ? data : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function sendPreview(res, html) {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  // Kort cache: pladser og status ændrer sig.
  res.setHeader('Cache-Control', 'public, max-age=300');
  res.end(html);
}

export async function handleMatchPreview(req, res) {
  const raw = typeof req.query?.id === 'string' ? req.query.id : '';
  const id = UUID.test(raw) ? raw : '';
  const row = id ? await fetchPreviewRow('public_match_preview', { p_match_id: id }) : null;
  const meta = row ? matchPreviewMeta(row) : FALLBACK;
  sendPreview(res, renderMatchPreviewHtml({
    ...meta,
    url: id ? shareMatchUrl(SITE, id) : SITE,
    image: `${SITE}/icon-512-v2.png`,
  }));
}

export async function handleTournamentPreview(req, res) {
  const raw = typeof req.query?.id === 'string' ? req.query.id : '';
  const id = UUID.test(raw) ? raw : '';
  const row = id ? await fetchPreviewRow('public_americano_preview', { p_tournament_id: id }) : null;
  const meta = row ? tournamentPreviewMeta(row) : TOURNAMENT_FALLBACK;
  sendPreview(res, renderMatchPreviewHtml({
    ...meta,
    url: id ? shareTournamentUrl(SITE, id) : SITE,
    image: `${SITE}/icon-512-v2.png`,
  }));
}
