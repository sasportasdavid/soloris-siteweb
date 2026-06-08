/**
 * POST /api/rdv/confirm-public — confirmation de RDV depuis le LIEN PUBLIC signé.
 * RE-VALIDE le token HMAC côté serveur (jamais confiance au client), puis délègue au
 * cœur partagé runRdvConfirm (identique au back-office). Inopérant après confirmation.
 */
import type { APIRoute } from 'astro';
import { verifyRdvToken } from '../../../lib/rdvToken';
import { runRdvConfirm } from '../../../lib/rdvConfirm';

export const prerender = false;

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}
function clean(v: unknown, max = 500): string | undefined {
  if (typeof v !== 'string') return undefined;
  const s = v.trim().slice(0, max);
  return s.length ? s : undefined;
}

export const POST: APIRoute = async ({ request }) => {
  let body: any;
  try { body = await request.json(); } catch { return json({ error: 'Requête invalide.' }, 400); }

  const payload = verifyRdvToken(String(body.token || ''));
  if (!payload) return json({ error: 'Lien invalide ou expiré.' }, 401);

  const rdvAt = clean(body.rdv_at, 40);
  if (!rdvAt || Number.isNaN(Date.parse(rdvAt))) return json({ error: 'Date et heure du rendez-vous requises.' }, 400);

  const prix = Number(body.prix_total_ttc);
  try {
    const result = await runRdvConfirm({
      leadId: payload.lead_id,
      traitePar: payload.tg_user,
      resend: false, // le lien public ne peut pas re-confirmer
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

    if (result.needsConfirm) return json({ error: 'Ce rendez-vous a déjà été confirmé.' }, 409);
    if (!result.ok) return json({ error: result.error || "L'enregistrement a échoué." }, 500);
    return json(result);
  } catch (e: any) {
    console.error('[rdv/confirm-public] exception non gérée', e);
    return json({ error: String(e?.message || e).slice(0, 300) }, 500);
  }
};

export const GET: APIRoute = () => json({ error: 'Méthode non autorisée.' }, 405);
