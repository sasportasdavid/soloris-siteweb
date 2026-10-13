/**
 * POST /api/devis/send — envoie le devis par email au client (Resend), avec le PDF
 * en pièce jointe et le lien de signature « bon pour accord ». Réservé à un admin
 * authentifié (vérification du JWT Supabase). Marque le devis comme « envoyé ».
 * Body : { devis_id }. Header : Authorization: Bearer <jwt admin>.
 */
import type { APIRoute } from 'astro';
import { SUPABASE_URL, SUPABASE_ANON, RESEND_API_KEY } from '../../../lib/serverEnv';
import { sendDevisEmail, sentPatch } from '../../../lib/devisSend';

export const prerender = false;

const isUuid = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

async function verifyAdmin(jwt: string): Promise<boolean> {
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: SUPABASE_ANON as string, Authorization: `Bearer ${jwt}` },
    });
    return res.ok;
  } catch { return false; }
}

export const POST: APIRoute = async ({ request }) => {
  if (!RESEND_API_KEY) return json({ error: "Envoi email non configuré : ajoutez la variable RESEND_API_KEY dans Vercel." }, 503);
  if (!SUPABASE_URL || !SUPABASE_ANON) return json({ error: 'Configuration serveur manquante.' }, 500);

  const jwt = (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!jwt) return json({ error: 'Non autorisé.' }, 401);
  if (!(await verifyAdmin(jwt))) return json({ error: 'Session expirée, reconnectez-vous.' }, 401);

  let body: any;
  try { body = await request.json(); } catch { return json({ error: 'Requête invalide.' }, 400); }
  const devisId = String(body.devis_id || '').trim();
  if (!isUuid(devisId)) return json({ error: 'Identifiant de devis invalide.' }, 400);

  // Lecture du devis avec le JWT admin (RLS authenticated)
  const dRes = await fetch(`${SUPABASE_URL}/rest/v1/devis?id=eq.${devisId}&select=*`, {
    headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${jwt}` },
  });
  if (!dRes.ok) return json({ error: 'Lecture du devis impossible.' }, 500);
  const arr = await dRes.json();
  const d = Array.isArray(arr) ? arr[0] : null;
  if (!d) return json({ error: 'Devis introuvable.' }, 404);
  if (!d.client_email) return json({ error: "Ce lead n'a pas d'adresse email." }, 400);

  const sent = await sendDevisEmail(d);
  if (!sent.ok) return json({ error: sent.error, ...(sent.detail ? { detail: sent.detail } : {}) }, sent.status);

  // Marquer comme envoyé (sans rétrograder un devis déjà signé)
  const patch = sentPatch(d);
  await fetch(`${SUPABASE_URL}/rest/v1/devis?id=eq.${devisId}`, {
    method: 'PATCH',
    headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify(patch),
  });

  return json({ ok: true, to: sent.to, sent_at: patch.sent_at });
};
