/**
 * Réécriture serveur de la carte Telegram d'un lead, à partir de la base (RPC get_lead_for_card)
 * et de la source unique telegramCard.ts. Secrets lus dans serverEnv, jamais journalisés.
 * Appelée par le webhook (boutons), la confirmation de RDV et l'API admin (statut / assignation).
 */
import { SUPABASE_URL, SUPABASE_ANON, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, TELEGRAM_LEADS_CHAT_ID } from './serverEnv';
import { cardText, cardKeyboard } from './telegramCard';
import { getLatestDevisForLead } from './devisServer';

async function tg(method: string, body: unknown): Promise<any> {
  try {
    const r = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/${method}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    const j = await r.json().catch(() => null);
    if (!r.ok) console.error(`[tg-card] Telegram ${method} → ${r.status}`, JSON.stringify(j || {}).slice(0, 300));
    return j;
  } catch (e) { console.error(`[tg-card] Telegram ${method} injoignable :`, e); return null; }
}

/** Envoie un message texte simple au canal (par défaut le canal Leads). Pour les notifications cron. */
export async function sendTelegramMessage(text: string, chatId?: string | number): Promise<boolean> {
  const chat = chatId ?? TELEGRAM_LEADS_CHAT_ID ?? TELEGRAM_CHAT_ID;
  if (!TELEGRAM_BOT_TOKEN || !chat) return false;
  const j = await tg('sendMessage', { chat_id: chat, text, disable_web_page_preview: true });
  return !!(j && j.ok);
}

/** Lead complet (+ opérateur assigné + dernier devis) pour sa carte, ou null. */
export async function fetchLeadForCard(leadId: string): Promise<Record<string, any> | null> {
  if (!SUPABASE_URL || !SUPABASE_ANON) return null;
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_lead_for_card`, {
      method: 'POST', headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_id: leadId }),
    });
    if (!r.ok) { console.error('[tg-card] RPC get_lead_for_card', r.status, (await r.text().catch(() => '')).slice(0, 200)); return null; }
    const j = await r.json();
    if (!j?.found) return null;
    const lead = j.lead;
    // Devis : table réservée au back-office (RLS) → clé service côté serveur ; sans clé, pas de ligne devis.
    try { lead.devis = await getLatestDevisForLead(leadId); } catch { lead.devis = null; }
    return lead;
  } catch (e) { console.error('[tg-card] RPC get_lead_for_card injoignable :', e); return null; }
}

async function storeMessageId(leadId: string, messageId: number): Promise<void> {
  if (!SUPABASE_URL || !SUPABASE_ANON) return;
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/rpc/set_lead_tg_message_id`, {
      method: 'POST', headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_id: leadId, p_message_id: messageId }),
    });
  } catch { /* non bloquant */ }
}

export interface RewriteOpts {
  /** Chat / message à éditer (clic sur une carte précise) ; sinon la carte mémorisée du lead. */
  chatId?: string | number; messageId?: number;
  /**
   * Carte introuvable : true = poste une carte à jour ; false = ne rien poster.
   * Défaut : poste seulement si une carte existait (id mémorisé) mais n'est plus éditable
   * (message supprimé). Un lead SANS carte (partiel sans contact, ancien lead) n'en reçoit pas
   * de nouvelle sur un simple changement de statut ; passer true pour forcer (ex. RDV confirmé).
   */
  postIfMissing?: boolean;
}

/**
 * Réécrit la carte (texte complet + clavier selon le statut). Renvoie le message_id courant,
 * ou null si rien n'a pu être écrit.
 */
export async function rewriteLeadCard(lead: Record<string, any>, opts: RewriteOpts = {}): Promise<number | null> {
  const chatId = opts.chatId ?? TELEGRAM_CHAT_ID ?? TELEGRAM_LEADS_CHAT_ID;
  if (!TELEGRAM_BOT_TOKEN || !chatId) return null;
  const text = cardText(lead);
  const reply_markup = cardKeyboard(lead);
  const messageId = opts.messageId ?? (lead.telegram_message_id ? Number(lead.telegram_message_id) : null);

  if (messageId) {
    const r = await tg('editMessageText', { chat_id: chatId, message_id: messageId, text, disable_web_page_preview: true, reply_markup });
    if (r?.ok) return messageId;
    // Même contenu qu'avant : Telegram refuse l'édition mais la carte est déjà à jour.
    if (String(r?.description || '').toLowerCase().includes('not modified')) return messageId;
  }
  if (opts.postIfMissing === false) return null;
  if (!messageId && opts.postIfMissing !== true) return null;
  const r = await tg('sendMessage', { chat_id: chatId, text, disable_web_page_preview: true, reply_markup });
  const mid = r?.result?.message_id;
  if (typeof mid === 'number') { await storeMessageId(String(lead.id), mid); return mid; }
  return null;
}

export interface CardEditResult {
  ok: boolean;
  /** Carte déjà identique à la base : rien à écrire. */
  unchanged?: boolean;
  /** Pas de carte éditable (jamais postée ou message supprimé) : rien à resynchroniser. */
  gone?: boolean;
  /** Limite de débit Telegram (429) : secondes à attendre avant de réessayer. */
  retryAfter?: number;
  error?: string;
}

/**
 * Édite la carte EXISTANTE du lead à partir de l'état de la base, sans jamais en poster une
 * nouvelle. Renvoie le détail du résultat (limite de débit, carte disparue…) pour la
 * resynchronisation par lots (cardResync.ts).
 */
export async function editLeadCardOnly(lead: Record<string, any>): Promise<CardEditResult> {
  const chatId = TELEGRAM_CHAT_ID ?? TELEGRAM_LEADS_CHAT_ID;
  if (!TELEGRAM_BOT_TOKEN || !chatId) return { ok: false, error: 'Telegram non configuré' };
  const messageId = lead.telegram_message_id ? Number(lead.telegram_message_id) : null;
  if (!messageId) return { ok: true, gone: true };
  const r = await tg('editMessageText', {
    chat_id: chatId, message_id: messageId, text: cardText(lead), disable_web_page_preview: true, reply_markup: cardKeyboard(lead),
  });
  if (r?.ok) return { ok: true };
  const desc = String(r?.description || '').toLowerCase();
  if (desc.includes('not modified')) return { ok: true, unchanged: true };
  if (r?.error_code === 429) return { ok: false, retryAfter: Number(r?.parameters?.retry_after) || 5 };
  if (desc.includes('message to edit not found') || desc.includes("can't be edited") || desc.includes('message_id_invalid')) return { ok: true, gone: true };
  return { ok: false, error: String(r?.description || 'erreur Telegram') };
}

/** Relit le lead en base et réécrit sa carte. Vrai si une carte a été écrite. */
export async function refreshLeadCard(leadId: string, opts: RewriteOpts = {}): Promise<boolean> {
  const lead = await fetchLeadForCard(leadId);
  if (!lead) return false;
  return (await rewriteLeadCard(lead, opts)) != null;
}
