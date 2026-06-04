/**
 * Endpoint d'ingestion analytics comportemental (Soloris) — first-party.
 * - Reçoit des batches d'events (+ chunks rrweb) en JSON, valide, et insère via la
 *   fonction Postgres SECURITY DEFINER `ingest_analytics` (la clé anon ne peut
 *   qu'appeler cette fonction — calque exact de /api/lead → upsert_lead).
 * - RGPD : dérive une géo GROSSIÈRE (région/ville) depuis les en-têtes Vercel,
 *   puis JETTE l'IP — aucune IP brute n'est jamais transmise à la base ni stockée.
 * - UA : seul un hash tronqué est conservé (jamais l'UA brut).
 * - `action: 'purge'` → retrait du consentement : purge la session du visiteur.
 * - Rate-limiting basique, CORS limité au domaine du site, rejet des payloads non conformes.
 * ⚠️ Aucune PII ni valeur de champ ne doit transiter ici (le tracker n'en envoie pas).
 */
import type { APIRoute } from 'astro';
import { SUPABASE_URL, SUPABASE_ANON, SITE_URL } from '../../lib/serverEnv';

export const prerender = false;

const SITE_HOST = (() => {
  try { return new URL(SITE_URL).host.replace(/^www\./, ''); } catch { return ''; }
})();

// ── Rate-limit en mémoire (transitoire ; l'IP n'est JAMAIS stockée) ──
const HITS = new Map<string, number[]>();
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 60; // un visiteur actif envoie ~1 batch / 5 s

function rateLimited(ipKey: string): boolean {
  const now = Date.now();
  const arr = (HITS.get(ipKey) || []).filter((t) => now - t < WINDOW_MS);
  arr.push(now);
  HITS.set(ipKey, arr);
  return arr.length > MAX_PER_WINDOW;
}

function json(data: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...extra },
  });
}

/** En-têtes CORS : autorise uniquement le domaine du site (et localhost en dev). */
function corsHeaders(origin: string | null): Record<string, string> {
  const h: Record<string, string> = { Vary: 'Origin' };
  if (!origin) return h; // requêtes same-origin (sans en-tête Origin)
  try {
    const host = new URL(origin).host.replace(/^www\./, '');
    if (host === SITE_HOST || host.startsWith('localhost') || host.startsWith('127.0.0.1')) {
      h['Access-Control-Allow-Origin'] = origin;
      h['Access-Control-Allow-Methods'] = 'POST, OPTIONS';
      h['Access-Control-Allow-Headers'] = 'Content-Type';
    }
  } catch { /* origine illisible : pas d'en-têtes CORS → bloqué par le navigateur */ }
  return h;
}

/** Géo GROSSIÈRE via en-têtes Vercel, puis l'IP est jetée (jamais lue/retournée). */
function deriveGeo(headers: Headers): { region: string | null; city: string | null } {
  const region = headers.get('x-vercel-ip-country-region') || null;
  const cityRaw = headers.get('x-vercel-ip-city') || null;
  let city: string | null = null;
  if (cityRaw) { try { city = decodeURIComponent(cityRaw); } catch { city = cityRaw; } }
  return { region, city };
}

/** Parse grossier navigateur/OS depuis l'UA (métadonnée, pas d'identification fine). */
function parseUA(ua: string): { browser: string | null; os: string | null } {
  const u = ua.toLowerCase();
  let browser: string | null = null;
  if (u.includes('edg/')) browser = 'Edge';
  else if (u.includes('chrome/') && !u.includes('chromium')) browser = 'Chrome';
  else if (u.includes('firefox/')) browser = 'Firefox';
  else if (u.includes('safari/')) browser = 'Safari';
  let os: string | null = null;
  if (u.includes('android')) os = 'Android';
  else if (u.includes('iphone') || u.includes('ipad') || u.includes('ios')) os = 'iOS';
  else if (u.includes('windows')) os = 'Windows';
  else if (u.includes('mac os')) os = 'macOS';
  else if (u.includes('linux')) os = 'Linux';
  return { browser, os };
}

/** Hash SHA-256 tronqué (jamais l'UA brut, pas de fingerprint réversible). */
async function uaHash(ua: string): Promise<string | null> {
  if (!ua) return null;
  try {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(ua));
    return Array.from(new Uint8Array(buf)).slice(0, 8).map((b) => b.toString(16).padStart(2, '0')).join('');
  } catch { return null; }
}

async function callRpc(fn: string, body: unknown): Promise<boolean> {
  if (!SUPABASE_URL || !SUPABASE_ANON) return false;
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
      method: 'POST',
      headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) { console.error(`[track] RPC ${fn}`, res.status, await res.text()); return false; }
    return true;
  } catch (e) { console.error(`[track] RPC ${fn} error`, e); return false; }
}

export const OPTIONS: APIRoute = ({ request }) =>
  new Response(null, { status: 204, headers: corsHeaders(request.headers.get('origin')) });

export const POST: APIRoute = async ({ request, clientAddress }) => {
  const cors = corsHeaders(request.headers.get('origin'));

  let body: any;
  try { body = await request.json(); } catch { return json({ ok: false, error: 'bad_json' }, 400, cors); }
  if (!body || typeof body !== 'object') return json({ ok: false, error: 'bad_body' }, 400, cors);

  // Clé de rate-limit transitoire (IP utilisée en mémoire uniquement, jamais stockée)
  let ipKey = 'unknown';
  try { ipKey = clientAddress || 'unknown'; } catch { /* */ }
  if (rateLimited(ipKey)) return json({ ok: false, error: 'rate_limited' }, 429, cors);

  // ── Retrait du consentement : purge de la session du visiteur ──
  if (body.action === 'purge') {
    const vid = typeof body.visitor_id === 'string' ? body.visitor_id : '';
    if (!/^[0-9a-f-]{36}$/i.test(vid)) return json({ ok: false, error: 'bad_visitor' }, 400, cors);
    const ok = await callRpc('purge_visitor_analytics', { p_visitor_id: vid });
    return json({ ok }, ok ? 200 : 500, cors);
  }

  // ── Ingestion d'un batch ──
  const session = body.session && typeof body.session === 'object' ? body.session : null;
  if (!session || typeof session.id !== 'string' || typeof session.visitor_id !== 'string') {
    return json({ ok: false, error: 'missing_session' }, 400, cors);
  }
  const events = Array.isArray(body.events) ? body.events.slice(0, 200) : [];
  const replay = Array.isArray(body.replay) ? body.replay.slice(0, 50) : [];
  if (!events.length && !replay.length) return json({ ok: true, noop: true }, 200, cors);

  // Enrichissement serveur : géo grossière (IP jetée), UA → hash + parse grossier
  const geo = deriveGeo(request.headers);
  const ua = request.headers.get('user-agent') || '';
  const { browser, os } = parseUA(ua);
  const payload = {
    session: {
      ...session,
      geo_region: session.geo_region || geo.region || null,
      geo_city: session.geo_city || geo.city || null,
      browser: session.browser || browser,
      os: session.os || os,
      ua_hash: await uaHash(ua),
    },
    events,
    replay,
    page_views: Number.isFinite(+body.page_views) ? +body.page_views : 0,
  };

  const ok = await callRpc('ingest_analytics', { payload });
  return json({ ok }, ok ? 200 : 500, cors);
};

export const GET: APIRoute = () => json({ error: 'Méthode non autorisée.' }, 405);
