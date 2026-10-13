/**
 * POST /api/admin/lead-update — changement de STATUT ou d'ASSIGNATION d'un lead depuis le
 * back-office, avec réécriture de la carte Telegram (ligne de statut « par X »).
 * Header : Authorization: Bearer <jwt admin>. Body : { lead_id, field: 'statut'|'assigne_a'|'recontacter_le', value }.
 * - statut → RPC tg_set_status (traçabilité : nom de l'opérateur, sinon email) ;
 *   statut 'perdu' → RPC tg_set_perdu, avec { motif, commentaire } OBLIGATOIRE dans le body
 * - recontacter_le → date de rappel (YYYY-MM-DD ou null), écrite avec le JWT de l'appelant
 * - assigne_a → RPC set_lead_assignee (exécutée avec le JWT de l'appelant : authenticated)
 * Puis refreshLeadCard : la carte Telegram affiche le nouveau statut. Secrets côté serveur.
 */
import type { APIRoute } from 'astro';
import { SUPABASE_URL, SUPABASE_ANON } from '../../../lib/serverEnv';
import { refreshLeadCard } from '../../../lib/telegramPush';
import { callerIdentity, bearer } from '../../../lib/adminAuth';

export const prerender = false;

const STATUTS = ['nouveau', 'contacte', 'a_recontacter', 'rdv_pris', 'realise', 'facture', 'perdu'];
const isUuid = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

export const POST: APIRoute = async ({ request }) => {
  if (!SUPABASE_URL || !SUPABASE_ANON) return json({ error: 'Configuration serveur manquante.' }, 500);
  const jwt = bearer(request);
  if (!jwt) return json({ error: 'Non autorisé.' }, 401);
  const who = await callerIdentity(jwt);
  if (!who) return json({ error: 'Session expirée, reconnectez-vous.' }, 401);

  let body: any;
  try { body = await request.json(); } catch { return json({ error: 'Requête invalide.' }, 400); }
  const leadId = String(body.lead_id || '').trim();
  const field = String(body.field || '');
  if (!isUuid(leadId)) return json({ error: 'Identifiant de lead invalide.' }, 400);

  const headers = { apikey: SUPABASE_ANON as string, 'Content-Type': 'application/json' };
  let result: any = null;

  if (field === 'statut') {
    const statut = String(body.value || '');
    if (!STATUTS.includes(statut)) return json({ error: 'Statut invalide.' }, 400);
    if (statut === 'perdu') {
      const commentaire = String(body.commentaire || '').trim();
      if (commentaire.length < 3) return json({ error: 'Un commentaire est obligatoire pour passer un lead en perdu.' }, 400);
      const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/tg_set_perdu`, {
        method: 'POST', headers: { ...headers, Authorization: `Bearer ${jwt}` },
        body: JSON.stringify({ p_id: leadId, p_motif: body.motif || null, p_commentaire: commentaire, p_traite_par: who.nom }),
      });
      result = r.ok ? await r.json().catch(() => null) : null;
      if (!result?.ok) {
        console.error('[lead-update] tg_set_perdu', r.status, result);
        return json({ error: result?.error === 'commentaire_requis' ? 'Un commentaire est obligatoire pour passer un lead en perdu.' : 'Le changement de statut a échoué.' }, result?.error ? 400 : 500);
      }
    } else {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/tg_set_status`, {
        method: 'POST', headers: { ...headers, Authorization: `Bearer ${jwt}` },
        body: JSON.stringify({ p_id: leadId, p_statut: statut, p_traite_par: who.nom }),
      });
      result = r.ok ? await r.json().catch(() => null) : null;
      if (!result?.ok) { console.error('[lead-update] tg_set_status', r.status, result); return json({ error: 'Le changement de statut a échoué.' }, 500); }
    }
  } else if (field === 'recontacter_le') {
    const date = body.value ? String(body.value) : null;
    if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) return json({ error: 'Date invalide.' }, 400);
    const r = await fetch(`${SUPABASE_URL}/rest/v1/leads?id=eq.${leadId}`, {
      method: 'PATCH', headers: { ...headers, Authorization: `Bearer ${jwt}`, Prefer: 'return=minimal' },
      body: JSON.stringify({ recontacter_le: date, updated_at: new Date().toISOString() }),
    });
    if (!r.ok) { console.error('[lead-update] recontacter_le', r.status, (await r.text().catch(() => '')).slice(0, 200)); return json({ error: 'La date de rappel n’a pas pu être enregistrée.' }, 500); }
  } else if (field === 'assigne_a') {
    const op = body.value ? String(body.value) : null;
    if (op && !isUuid(op)) return json({ error: 'Opérateur invalide.' }, 400);
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/set_lead_assignee`, {
      method: 'POST', headers: { ...headers, Authorization: `Bearer ${jwt}` },
      body: JSON.stringify({ p_id: leadId, p_operateur: op, p_traite_par: who.nom }),
    });
    result = r.ok ? await r.json().catch(() => null) : null;
    if (!result?.ok) { console.error('[lead-update] set_lead_assignee', r.status, result); return json({ error: result?.error === 'operateur_inconnu' ? 'Opérateur inconnu ou désactivé.' : "L'assignation a échoué." }, 500); }
  } else {
    return json({ error: 'Champ non pris en charge.' }, 400);
  }

  // Carte Telegram : reflète le statut / l'assignation (non bloquant).
  let card = false;
  try { card = await refreshLeadCard(leadId); } catch (e) { console.error('[lead-update] carte Telegram', e); }
  console.log(`[lead-update] ${field} → ${body.value ?? 'null'} · lead ${leadId} · par ${who.nom} · carte ${card ? 'réécrite' : 'non réécrite'}`);
  return json({
    ok: true, field, value: body.value ?? null, traite_par: who.nom, card,
    ...(result?.perte_commentaire ? { motif_perte: result.motif_perte, perte_commentaire: result.perte_commentaire } : {}),
  });
};

export const GET: APIRoute = () => json({ error: 'Méthode non autorisée.' }, 405);
