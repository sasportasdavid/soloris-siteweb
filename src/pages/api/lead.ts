/**
 * Endpoint serveur d'insertion des leads.
 * - Rendu à la demande (serverless Vercel).
 * - Validation stricte + liste blanche des valeurs + honeypot anti-spam.
 * - Insertion via l'API REST PostgREST de Supabase (fetch). On évite ainsi le
 *   client realtime de supabase-js, incompatible avec Node < 22 sans WebSocket.
 * - Utilise la clé service_role si configurée, sinon la clé anon (la RLS
 *   autorise l'INSERT public). La service_role n'est JAMAIS exposée au client.
 */
import type { APIRoute } from 'astro';

export const prerender = false;

const DEMANDES = ['vente', 'location', 'dpe', 'audit'];
const BIENS = ['appartement', 'maison'];
const TYPOS = ['t1', 't2', 't3', 't4'];

// Limitation de débit simple (best-effort, mémoire de l'instance serverless)
const HITS = new Map<string, number[]>();
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 5;

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const arr = (HITS.get(ip) || []).filter((t) => now - t < WINDOW_MS);
  arr.push(now);
  HITS.set(ip, arr);
  return arr.length > MAX_PER_WINDOW;
}

function clean(v: unknown, max = 500): string | null {
  if (typeof v !== 'string') return null;
  const s = v.trim().slice(0, max);
  return s.length ? s : null;
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export const POST: APIRoute = async ({ request, clientAddress }) => {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Requête invalide.' }, 400);
  }

  // Anti-spam : honeypot (on ignore silencieusement)
  if (clean(body.website)) return json({ ok: true }, 200);

  // Limitation de débit
  let ip = 'unknown';
  try { ip = clientAddress || 'unknown'; } catch { /* clientAddress indispo en static */ }
  if (rateLimited(ip)) return json({ error: 'Trop de demandes, réessayez dans un instant.' }, 429);

  // Validation (liste blanche)
  const type_demande = clean(body.type_demande, 20);
  const type_bien = clean(body.type_bien, 20);
  const typologie = clean(body.typologie, 10);
  if (type_demande && !DEMANDES.includes(type_demande)) return json({ error: 'Demande invalide.' }, 400);
  if (type_bien && !BIENS.includes(type_bien)) return json({ error: 'Type de bien invalide.' }, 400);
  if (typologie && !TYPOS.includes(typologie)) return json({ error: 'Typologie invalide.' }, 400);

  // Coordonnées obligatoires
  const nom = clean(body.nom, 120);
  const telephone = clean(body.telephone, 40);
  const email = clean(body.email, 160);
  if (!nom || !telephone || !email) return json({ error: 'Nom, téléphone et email sont requis.' }, 400);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ error: 'Email invalide.' }, 400);

  const surfaceNum = Number(body.surface);
  const estimationNum = Number(body.estimation);

  const record = {
    type_demande,
    type_bien,
    typologie,
    surface: Number.isFinite(surfaceNum) && surfaceNum > 0 ? Math.round(surfaceNum) : null,
    secteur: clean(body.secteur, 120),
    estimation: Number.isFinite(estimationNum) && estimationNum > 0 ? Math.round(estimationNum) : null,
    nom,
    telephone,
    email,
    message: clean(body.message, 1000),
    source: clean(body.source, 120),
    medium: clean(body.medium, 120),
    campaign: clean(body.campaign, 160),
    term: clean(body.term, 160),
    content: clean(body.content, 160),
    gclid: clean(body.gclid, 255),
    fbclid: clean(body.fbclid, 255),
    landing_path: clean(body.landing_path, 255),
    statut: 'nouveau',
  };

  // Clé : service_role si dispo, sinon anon (RLS autorise l'insert public)
  const url = import.meta.env.PUBLIC_SUPABASE_URL;
  const serviceRole = import.meta.env.SUPABASE_SERVICE_ROLE;
  const anon = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;
  const key = serviceRole && serviceRole !== '__A_REMPLACER__' ? serviceRole : anon;

  if (!url || !key) return json({ error: 'Configuration serveur manquante.' }, 500);

  // Insertion via PostgREST
  try {
    const res = await fetch(`${url}/rest/v1/leads`, {
      method: 'POST',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify(record),
    });
    if (!res.ok) {
      const detail = await res.text();
      console.error('[lead] PostgREST', res.status, detail);
      return json({ error: "L'enregistrement a échoué." }, 500);
    }
  } catch (e) {
    console.error('[lead] fetch error', e);
    return json({ error: "L'enregistrement a échoué." }, 500);
  }

  return json({ ok: true }, 201);
};

export const GET: APIRoute = () => json({ error: 'Méthode non autorisée.' }, 405);
