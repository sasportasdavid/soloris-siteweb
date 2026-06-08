/**
 * POST /api/rdv/confirm — confirmation de RDV depuis le BACK-OFFICE (admin authentifié).
 * Vérifie le JWT Supabase puis délègue au cœur partagé runRdvConfirm (commun avec le
 * lien public signé). L'email ne bloque jamais l'enregistrement.
 * Body : { lead_id, rdv_at, rdv_adresse, prestation, diagnostiqueur, prix_total_ttc,
 *          duree_estimee?, consignes?, resend? }. Header : Authorization: Bearer <jwt admin>.
 */
import type { APIRoute } from 'astro';
import { SUPABASE_URL, SUPABASE_ANON } from '../../../lib/serverEnv';
import { runRdvConfirm } from '../../../lib/rdvConfirm';

export const prerender = false;

const isUuid = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}
function clean(v: unknown, max = 500): string | undefined {
  if (typeof v !== 'string') return undefined;
  const s = v.trim().slice(0, max);
  return s.length ? s : undefined;
}

/** Vérifie le JWT et renvoie l'email de l'admin (pour traite_par), ou null. */
async function adminEmail(jwt: string): Promise<string | null> {
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: SUPABASE_ANON as string, Authorization: `Bearer ${jwt}` } });
    if (!res.ok) return null;
    const u = await res.json();
    return u?.email || 'back-office';
  } catch { return null; }
}

export const POST: APIRoute = async ({ request }) => {
  if (!SUPABASE_URL || !SUPABASE_ANON) return json({ error: 'Configuration serveur manquante.' }, 500);

  const jwt = (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!jwt) return json({ error: 'Non autorisé.' }, 401);
  const email = await adminEmail(jwt);
  if (!email) return json({ error: 'Session expirée, reconnectez-vous.' }, 401);

  let body: any;
  try { body = await request.json(); } catch { return json({ error: 'Requête invalide.' }, 400); }

  const leadId = String(body.lead_id || '').trim();
  if (!isUuid(leadId)) return json({ error: 'Identifiant de lead invalide.' }, 400);
  const rdvAt = clean(body.rdv_at, 40);
  if (!rdvAt || Number.isNaN(Date.parse(rdvAt))) return json({ error: 'Date et heure du rendez-vous requises.' }, 400);

  const prix = Number(body.prix_total_ttc);
  try {
    const result = await runRdvConfirm({
      leadId,
      traitePar: email,
      resend: body.resend === true,
      fields: {
        rdv_at: new Date(rdvAt).toISOString(),
        rdv_adresse: clean(body.rdv_adresse, 300),
        prestation: clean(body.prestation, 300),
        diagnostiqueur: clean(body.diagnostiqueur, 160),
        prix_total_ttc: Number.isFinite(prix) && prix >= 0 ? prix : undefined,
        duree_estimee: clean(body.duree_estimee, 80),
        consignes: clean(body.consignes, 1000),
      },
    });

    if (result.needsConfirm) return json({ needsConfirm: true });
    if (!result.ok) return json({ error: result.error || "L'enregistrement a échoué." }, 500);
    return json(result);
  } catch (e: any) {
    // Garantit une réponse JSON même sur exception imprévue (sinon l'UI affiche
    // « L'envoi a échoué » sans détail, car res.json() côté client échoue).
    console.error('[rdv/confirm] exception non gérée', e);
    return json({ error: String(e?.message || e).slice(0, 300) }, 500);
  }
};

export const GET: APIRoute = () => json({ error: 'Méthode non autorisée.' }, 405);
