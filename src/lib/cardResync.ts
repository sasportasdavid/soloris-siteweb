/**
 * Resynchronisation des cartes Telegram avec la base (source de vérité : Supabase).
 * Une carte peut rester en retard si une écriture a eu lieu sans réécriture (ancien code, clic
 * sur une carte périmée, devis envoyé avant la synchro). Ce module réécrit, par petits lots et
 * en respectant la limite de débit de Telegram, les cartes dont le lead (ou son devis) a changé
 * depuis leur dernière resynchronisation ; l'avancement est mémorisé dans tg_card_sync, donc un
 * lot interrompu reprend où il s'est arrêté. Lectures/écritures avec la clé service (serveur).
 *
 * Périmètre : cartes de leads qui ne sont plus de simples « nouveau » (statut avancé, devis ou
 * opérateur assigné). Un « nouveau » sans devis ni assigné garde sa carte d'origine, déjà exacte.
 */
import { rest as serviceRest, devisServerReady } from './devisServer';
import { fetchLeadForCard, editLeadCardOnly } from './telegramPush';

export interface ResyncResult {
  /** Cartes réellement modifiées. */
  traitees: number;
  /** Cartes déjà identiques à la base. */
  inchangees: number;
  /** Cartes introuvables dans Telegram (supprimées) : rien à faire. */
  disparues: number;
  erreurs: number;
  /** Cartes encore à resynchroniser après ce lot. */
  restantes: number;
  /** Telegram a demandé de ralentir : relancer plus tard. */
  limite_debit: boolean;
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const ts = (v: unknown) => { const t = Date.parse(String(v ?? '')); return Number.isFinite(t) ? t : 0; };

/** Identifiants des leads dont la carte est à resynchroniser, les jamais synchronisés d'abord. */
export async function cartesARetraiter(): Promise<string[] | null> {
  const [leads, syncs, devis] = await Promise.all([
    serviceRest('GET', 'leads?telegram_message_id=not.is.null&select=id,statut,assigne_a,updated_at&order=updated_at.desc&limit=1000'),
    serviceRest('GET', 'tg_card_sync?select=lead_id,synced_at&limit=1000'),
    serviceRest('GET', 'devis?select=lead_id,updated_at,created_at&limit=1000'),
  ]);
  if (!leads || !syncs || !devis) return null;
  const syncAt = new Map<string, number>(syncs.map((s) => [String(s.lead_id), ts(s.synced_at)]));
  const devisAt = new Map<string, number>();
  for (const d of devis) {
    const k = String(d.lead_id);
    devisAt.set(k, Math.max(devisAt.get(k) ?? 0, ts(d.updated_at), ts(d.created_at)));
  }
  const out: { id: string; jamais: boolean; maj: number }[] = [];
  for (const l of leads) {
    const id = String(l.id);
    const concerne = l.statut !== 'nouveau' || devisAt.has(id) || !!l.assigne_a;
    if (!concerne) continue;
    const s = syncAt.get(id);
    const maj = Math.max(ts(l.updated_at), devisAt.get(id) ?? 0);
    if (s === undefined || maj > s) out.push({ id, jamais: s === undefined, maj });
  }
  out.sort((a, b) => Number(b.jamais) - Number(a.jamais) || b.maj - a.maj);
  return out.map((x) => x.id);
}

/** `quand` = instant AVANT la lecture du lead : une modification survenue pendant l'édition reste à refaire. */
async function marquerSynchro(leadId: string, quand: string): Promise<void> {
  await serviceRest('POST', 'tg_card_sync?on_conflict=lead_id', { lead_id: leadId, synced_at: quand }, 'resolution=merge-duplicates,return=minimal');
}

export interface ResyncOpts {
  /** Nombre maximal de cartes traitées dans cet appel. */
  max?: number;
  /** Durée maximale avant de ne plus démarrer de nouvelle carte (ms). */
  budgetMs?: number;
  /** Pause entre deux éditions, pour rester sous la limite de débit de Telegram (ms). */
  pauseMs?: number;
}

/** Traite un lot de cartes. Renvoie null si la base n'est pas joignable ou la clé service absente. */
export async function resyncCards(opts: ResyncOpts = {}): Promise<ResyncResult | null> {
  if (!devisServerReady()) return null;
  const max = opts.max ?? 4;
  const budget = opts.budgetMs ?? 7000;
  const pause = opts.pauseMs ?? 1200;
  const t0 = Date.now();
  const todo = await cartesARetraiter();
  if (!todo) return null;

  const res: ResyncResult = { traitees: 0, inchangees: 0, disparues: 0, erreurs: 0, restantes: 0, limite_debit: false };
  let essais = 0;
  while (todo.length && essais < max && Date.now() - t0 < budget) {
    const id = todo[0];
    const debut = new Date().toISOString();
    const lead = await fetchLeadForCard(id);
    if (!lead) { res.erreurs++; todo.shift(); essais++; continue; }
    let r = await editLeadCardOnly(lead);
    if (!r.ok && r.retryAfter && Date.now() - t0 + r.retryAfter * 1000 + 1000 < budget) {
      await sleep(r.retryAfter * 1000 + 500);
      r = await editLeadCardOnly(lead);
    }
    if (!r.ok && r.retryAfter) { res.limite_debit = true; break; }
    todo.shift(); essais++;
    if (r.ok) {
      await marquerSynchro(id, debut);
      if (r.gone) res.disparues++; else if (r.unchanged) res.inchangees++; else res.traitees++;
    } else {
      res.erreurs++;
      console.error('[resync-cartes] carte non écrite pour', id, r.error);
    }
    if (todo.length && essais < max) await sleep(pause);
  }
  res.restantes = todo.length;
  return res;
}
