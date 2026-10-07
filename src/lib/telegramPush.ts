/**
 * Réécriture serveur de la carte Telegram d'un lead, à partir de la base (RPC get_lead_for_card)
 * et de la source unique telegramCard.ts. Secrets lus dans serverEnv, jamais journalisés.
 * Appelée par le webhook (boutons), la confirmation de RDV et l'API admin (statut / assignation).
 */
import { SUPABASE_URL, SUPABASE_ANON, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, TELEGRAM_LEADS_CHAT_ID } from './serverEnv';
import { cardText, cardKeyboard } from './telegramCard';

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

/** Lead complet (+ nom de l'opérateur assigné) pour sa carte, ou null. */
export async function fetchLeadForCard(leadId: string): Promise<Record<string, any> | null> {
  if (!SUPABASE_URL || !SUPABASE_ANON) return null;
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_lead_for_card`, {
      method: 'POST', headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_id: leadId }),
    });
    if (!r.ok) { console.error('[tg-card] RPC get_lead_for_card', r.status, (await r.text().catch(() => '')).slice(0, 200)); return null; }
    const j = await r.json();
    return j?.found ? j.lead : null;
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
  /** Si l'édition est impossible (carte supprimée, id inconnu), poste une carte à jour. Défaut : true. */
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
  const r = await tg('sendMessage', { chat_id: chatId, text, disable_web_page_preview: true, reply_markup });
  const mid = r?.result?.message_id;
  if (typeof mid === 'number') { await storeMessageId(String(lead.id), mid); return mid; }
  return null;
}

/** Relit le lead en base et réécrit sa carte. Vrai si une carte a été écrite. */
export async function refreshLeadCard(leadId: string, opts: RewriteOpts = {}): Promise<boolean> {
  const lead = await fetchLeadForCard(leadId);
  if (!lead) return false;
  return (await rewriteLeadCard(lead, opts)) != null;
}
