/**
 * Synchronisation après un événement de DEVIS (envoyé, signé, refusé), quel que soit le canal :
 * bouton Telegram, back-office /admin ou signature du client sur la page publique.
 * Un seul endroit garantit que les trois vues restent cohérentes :
 *  1. journal du lead (timeline admin) : « envoyé DEV-… à … » avec l'auteur ;
 *  2. statut du lead : « Nouveau » → « Contacté » (jamais de rétrogradation) quand un devis
 *     est envoyé ou signé — un lead qui a reçu un devis n'est plus « Nouveau » ;
 *  3. carte Telegram du lead réécrite (ligne devis + statut), si elle existe.
 * Non bloquant : toute erreur est journalisée, jamais propagée à l'appelant.
 */
import { SUPABASE_URL, SUPABASE_ANON } from './serverEnv';
import { devisServerReady, logLeadActivity } from './devisServer';
import { fetchLeadForCard, refreshLeadCard } from './telegramPush';

export type DevisEvent = 'envoye' | 'signe' | 'refuse';

export async function syncAfterDevisEvent(opts: { leadId: string | null | undefined; kind: DevisEvent; detail: string; par: string }): Promise<void> {
  const { leadId, kind, detail, par } = opts;
  if (!leadId) return;
  try {
    // 1. Journal (clé service ; sans clé, la timeline n'est pas alimentée mais le reste continue)
    if (devisServerReady()) await logLeadActivity(leadId, 'devis', detail, par);

    // 2. Promotion « Nouveau » → « Contacté » (devis envoyé ou signé). Les autres statuts sont intouchés.
    if (kind !== 'refuse' && SUPABASE_URL && SUPABASE_ANON) {
      const lead = await fetchLeadForCard(leadId);
      if ((lead?.statut || 'nouveau') === 'nouveau') {
        const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/tg_set_status`, {
          method: 'POST', headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ p_id: leadId, p_statut: 'contacte', p_traite_par: par }),
        });
        if (!r.ok) console.error('[devis-sync] tg_set_status', r.status, (await r.text().catch(() => '')).slice(0, 200));
      }
    }

    // 3. Carte Telegram (relue après la promotion : statut + devis à jour)
    await refreshLeadCard(leadId);
  } catch (e) {
    console.error('[devis-sync] échec (devis enregistré, synchro partielle) :', e);
  }
}

/** Exécute `p` mais ne l'attend pas plus de `ms` (réponses publiques : ne pas faire patienter le client). */
export async function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | undefined> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try { return await Promise.race([p, new Promise<undefined>((res) => { timer = setTimeout(() => res(undefined), ms); })]); }
  finally { if (timer) clearTimeout(timer); }
}
