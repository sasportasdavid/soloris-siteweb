/**
 * Identité d'un appelant du back-office à partir de son JWT Supabase (côté serveur).
 * Renvoie { id, email, nom, role } : nom et rôle viennent de la fiche opérateur si elle
 * existe (table operateurs, lue avec le JWT de l'appelant via RLS), sinon nom = email.
 */
import { SUPABASE_URL, SUPABASE_ANON } from './serverEnv';

export interface CallerIdentity { id: string; email: string; nom: string; role: string }

export async function callerIdentity(jwt: string): Promise<CallerIdentity | null> {
  if (!SUPABASE_URL || !SUPABASE_ANON || !jwt) return null;
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${jwt}` } });
    if (!res.ok) return null;
    const u = await res.json();
    if (!u?.id) return null;
    const email: string = u.email || '';
    let nom = email || 'back-office'; let role = '';
    try {
      const q = `select=nom,role,actif&or=(auth_user_id.eq.${u.id},email.eq.${encodeURIComponent(email)})&limit=1`;
      const r = await fetch(`${SUPABASE_URL}/rest/v1/operateurs?${q}`, { headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${jwt}` } });
      if (r.ok) { const rows = await r.json(); if (rows?.[0]?.nom) { nom = rows[0].nom; role = rows[0].role || ''; } }
    } catch { /* table absente : on garde l'email */ }
    return { id: u.id, email, nom, role };
  } catch { return null; }
}

/** JWT extrait de l'en-tête Authorization (Bearer), ou chaîne vide. */
export function bearer(request: Request): string {
  return (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim();
}
