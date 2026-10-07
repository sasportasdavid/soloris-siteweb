/**
 * POST /api/admin/operateurs — actions sur les opérateurs nécessitant la clé service_role
 * (comptes de connexion Supabase Auth). Réservé aux opérateurs de rôle « admin ».
 * Header : Authorization: Bearer <jwt admin>.
 * Body : { action: 'create_access' | 'set_active', operateur_id, actif? }
 * - create_access : crée (ou réinitialise) le compte de connexion de l'opérateur avec un mot
 *   de passe temporaire renvoyé UNE fois à l'admin, qui le transmet. Lie auth_user_id.
 * - set_active : active / désactive l'opérateur ; bannit / débannit son compte de connexion.
 * Sans SUPABASE_SERVICE_ROLE (variable Vercel), create_access répond 501 avec la marche à suivre.
 * La fiche opérateur elle-même (nom, email, rôle…) s'édite directement depuis /admin/equipe (RLS).
 */
import type { APIRoute } from 'astro';
import { randomBytes } from 'node:crypto';
import { SUPABASE_URL, SUPABASE_ANON, SUPABASE_SERVICE_ROLE } from '../../../lib/serverEnv';
import { callerIdentity, bearer } from '../../../lib/adminAuth';

export const prerender = false;

const isUuid = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}
/** Mot de passe temporaire lisible : « Sol-xxxxxxxxxxxx » (base64url, 12 car. aléatoires). */
function tempPassword(): string { return 'Sol-' + randomBytes(9).toString('base64url'); }

async function adminApi(method: string, path: string, body?: unknown): Promise<{ ok: boolean; status: number; data: any }> {
  const r = await fetch(`${SUPABASE_URL}/auth/v1/admin/${path}`, {
    method, headers: { apikey: SUPABASE_SERVICE_ROLE as string, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await r.json().catch(() => null);
  return { ok: r.ok, status: r.status, data };
}

export const POST: APIRoute = async ({ request }) => {
  if (!SUPABASE_URL || !SUPABASE_ANON) return json({ error: 'Configuration serveur manquante.' }, 500);
  const jwt = bearer(request);
  if (!jwt) return json({ error: 'Non autorisé.' }, 401);
  const who = await callerIdentity(jwt);
  if (!who) return json({ error: 'Session expirée, reconnectez-vous.' }, 401);
  if (who.role && who.role !== 'admin') return json({ error: 'Réservé aux administrateurs.' }, 403);

  let body: any;
  try { body = await request.json(); } catch { return json({ error: 'Requête invalide.' }, 400); }
  const action = String(body.action || '');
  const opId = String(body.operateur_id || '');
  if (!isUuid(opId)) return json({ error: 'Opérateur invalide.' }, 400);

  // Fiche opérateur (lue avec le JWT de l'appelant : RLS authenticated)
  const userHeaders = { apikey: SUPABASE_ANON as string, Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json' };
  const rf = await fetch(`${SUPABASE_URL}/rest/v1/operateurs?select=*&id=eq.${opId}&limit=1`, { headers: userHeaders });
  const op = rf.ok ? (await rf.json())?.[0] : null;
  if (!op) return json({ error: 'Opérateur introuvable.' }, 404);

  if (action === 'create_access') {
    if (!SUPABASE_SERVICE_ROLE) {
      return json({ error: 'La création de comptes de connexion nécessite la variable SUPABASE_SERVICE_ROLE (clé service_role du projet Supabase) dans Vercel → Settings → Environment Variables, puis un redéploiement. En attendant, créez l\u2019utilisateur dans Supabase → Authentication → Users avec le même email : dès que la clé sera configurée, « Créer l\u2019accès » reliera ce compte à la fiche.' }, 501);
    }
    if (!op.email) return json({ error: "L'opérateur n'a pas d'email." }, 400);
    const password = tempPassword();
    let authId: string | null = op.auth_user_id || null;
    if (authId) {
      const r = await adminApi('PUT', `users/${authId}`, { password, ban_duration: 'none' });
      if (!r.ok) { console.error('[operateurs] reset password', r.status, r.data); return json({ error: 'Réinitialisation impossible : ' + (r.data?.msg || r.data?.message || r.status) }, 500); }
    } else {
      const r = await adminApi('POST', 'users', { email: op.email, password, email_confirm: true, user_metadata: { nom: op.nom, role: op.role } });
      if (!r.ok) {
        const msg = String(r.data?.msg || r.data?.message || '');
        if (/already|exists|registered/i.test(msg)) {
          return json({ error: 'Un compte existe déjà pour cet email dans Supabase Auth. Rechargez la page Équipe : il sera relié automatiquement, puis utilisez « Réinitialiser le mot de passe ».' }, 409);
        }
        console.error('[operateurs] create user', r.status, r.data);
        return json({ error: 'Création impossible : ' + (msg || r.status) }, 500);
      }
      authId = r.data?.id || r.data?.user?.id || null;
      if (authId) {
        await fetch(`${SUPABASE_URL}/rest/v1/operateurs?id=eq.${opId}`, { method: 'PATCH', headers: { ...userHeaders, Prefer: 'return=minimal' }, body: JSON.stringify({ auth_user_id: authId, actif: true, updated_at: new Date().toISOString() }) });
      }
    }
    console.log(`[operateurs] accès ${op.auth_user_id ? 'réinitialisé' : 'créé'} pour ${op.email} par ${who.nom}`);
    return json({ ok: true, email: op.email, temp_password: password, auth_user_id: authId, reset: !!op.auth_user_id });
  }

  if (action === 'set_active') {
    const actif = body.actif !== false;
    const r = await fetch(`${SUPABASE_URL}/rest/v1/operateurs?id=eq.${opId}`, { method: 'PATCH', headers: { ...userHeaders, Prefer: 'return=minimal' }, body: JSON.stringify({ actif, updated_at: new Date().toISOString() }) });
    if (!r.ok) return json({ error: 'Mise à jour impossible.' }, 500);
    let compte = 'inchangé';
    if (op.auth_user_id && SUPABASE_SERVICE_ROLE) {
      const b = await adminApi('PUT', `users/${op.auth_user_id}`, { ban_duration: actif ? 'none' : '876000h' });
      compte = b.ok ? (actif ? 'réactivé' : 'bloqué') : 'non modifié';
    }
    console.log(`[operateurs] ${op.email || op.nom} ${actif ? 'activé' : 'désactivé'} par ${who.nom} · compte ${compte}`);
    return json({ ok: true, actif, compte });
  }

  return json({ error: 'Action inconnue.' }, 400);
};

export const GET: APIRoute = () => json({ error: 'Méthode non autorisée.' }, 405);
