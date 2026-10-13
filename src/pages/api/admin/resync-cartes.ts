/**
 * POST /api/admin/resync-cartes — réaligne, par petits lots, les cartes Telegram des leads sur la
 * base (voir lib/cardResync.ts). Appelé automatiquement par /admin à l'ouverture (une fois par
 * jour et par navigateur, en boucle jusqu'à ce qu'il ne reste rien) ; le cron quotidien joue le
 * même rôle en filet de sécurité.
 * Header : Authorization: Bearer <jwt admin>. Réponse : { traitees, inchangees, disparues, erreurs,
 * restantes, limite_debit }. Idempotent : une carte déjà à jour n'est pas modifiée.
 */
import type { APIRoute } from 'astro';
import { callerIdentity, bearer } from '../../../lib/adminAuth';
import { resyncCards } from '../../../lib/cardResync';

export const prerender = false;

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
}

export const POST: APIRoute = async ({ request }) => {
  const jwt = bearer(request);
  if (!jwt) return json({ error: 'Non autorisé.' }, 401);
  const who = await callerIdentity(jwt);
  if (!who) return json({ error: 'Session expirée, reconnectez-vous.' }, 401);

  const r = await resyncCards({ max: 4, budgetMs: 7000, pauseMs: 1200 });
  if (!r) return json({ error: 'Resynchronisation indisponible (base ou clé service non configurée).' }, 503);
  if (r.traitees || r.erreurs || r.limite_debit) console.log(`[resync-cartes] par ${who.nom} :`, JSON.stringify(r));
  return json(r);
};
