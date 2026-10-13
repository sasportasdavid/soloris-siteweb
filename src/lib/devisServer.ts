/**
 * Accès serveur aux devis pour le webhook Telegram (hors session back-office).
 * La table devis n'est lisible qu'en `authenticated` (RLS) : on passe par la clé service
 * Supabase, côté serveur uniquement, derrière la vérification du jeton webhook + chats autorisés.
 * Même brouillon que le bouton « Créer le devis » de /admin (buildDevisDraftFromLead).
 */
import { SUPABASE_URL, SUPABASE_SERVICE_ROLE } from './serverEnv';
import { buildDevisDraftFromLead } from './devis';

export const devisServerReady = () => !!(SUPABASE_URL && SUPABASE_SERVICE_ROLE);

/** `sb_secret_…` : apikey seul ; JWT service_role historique : apikey + Bearer. */
function headers(extra: Record<string, string> = {}): Record<string, string> {
  const key = SUPABASE_SERVICE_ROLE as string;
  const h: Record<string, string> = { apikey: key, 'Content-Type': 'application/json', ...extra };
  if (!key.startsWith('sb_secret_')) h.Authorization = `Bearer ${key}`;
  return h;
}

async function rest(method: string, path: string, body?: unknown, prefer?: string): Promise<any[] | null> {
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
      method, headers: headers(prefer ? { Prefer: prefer } : {}), body: body ? JSON.stringify(body) : undefined,
    });
    if (!r.ok) { console.error(`[devis-server] ${method} ${path.split('?')[0]} → ${r.status}`, (await r.text().catch(() => '')).slice(0, 200)); return null; }
    const txt = await r.text();
    return txt ? JSON.parse(txt) : [];
  } catch (e) { console.error('[devis-server] Supabase injoignable :', e); return null; }
}

export async function getDevis(devisId: string): Promise<any | null> {
  const a = await rest('GET', `devis?id=eq.${devisId}&select=*`);
  return a?.[0] ?? null;
}

/**
 * Dernier devis non refusé du lead ; sinon crée le brouillon comme /admin. Recopie l'email du
 * lead sur un devis qui n'en a pas (le contact a pu être complété après la création).
 */
export async function getOrCreateDevisForLead(leadId: string): Promise<{ devis: any; lead: any } | null> {
  const leads = await rest('GET', `leads?id=eq.${leadId}&select=*`);
  const lead = leads?.[0];
  if (!lead) return null;

  const existing = await rest('GET', `devis?lead_id=eq.${leadId}&statut=neq.refuse&select=*&order=created_at.desc&limit=1`);
  if (existing === null) return null;
  let devis = existing[0];
  if (devis) {
    if (!devis.client_email && lead.email) {
      const up = await rest('PATCH', `devis?id=eq.${devis.id}`, { client_email: lead.email, updated_at: new Date().toISOString() }, 'return=representation');
      devis = up?.[0] ?? devis;
    }
    return { devis, lead };
  }

  const draft = buildDevisDraftFromLead(lead);
  const row = {
    lead_id: lead.id, client_nom: lead.nom, client_email: lead.email, client_tel: lead.telephone,
    client_cp: lead.secteur, client_adresse: lead.adresse || null,
    objet: draft.objet, lignes: draft.lignes, montant: draft.montant, validite_jours: draft.validite_jours,
  };
  const created = await rest('POST', 'devis?select=*', row, 'return=representation');
  return created?.[0] ? { devis: created[0], lead } : null;
}

export async function patchDevis(devisId: string, patch: Record<string, unknown>): Promise<boolean> {
  return (await rest('PATCH', `devis?id=eq.${devisId}`, patch, 'return=minimal')) !== null;
}

/** Journal « qui a fait quoi » du lead (timeline admin). Non bloquant. */
export async function logLeadActivity(leadId: string, type: string, detail: string, par: string): Promise<void> {
  await rest('POST', 'lead_activity', { lead_id: leadId, type, detail, par: par || null }, 'return=minimal');
}
