/**
 * POST /api/telegram/webhook — webhook entrant Telegram (boutons sous les cartes lead).
 * - Vérifie X-Telegram-Bot-Api-Secret-Token == TELEGRAM_WEBHOOK_SECRET (rejette sinon).
 * - N'accepte que les callback_query venant du groupe TELEGRAM_LEADS_CHAT_ID.
 * - ct|{id} / pd|{id} → statut Supabase + réécrit la carte ; rdv|{id} → ajoute un
 *   bouton URL vers le formulaire RDV signé (lien expirant 48 h).
 * Secrets côté serveur uniquement.
 */
import type { APIRoute } from 'astro';
import {
  SUPABASE_URL, SUPABASE_ANON, TELEGRAM_BOT_TOKEN, TELEGRAM_LEADS_CHAT_ID,
  TELEGRAM_WEBHOOK_SECRET, SITE_URL,
} from '../../../lib/serverEnv';
import { leadKeyboard, STATUT_LABELS_TG } from '../../../lib/telegram';
import { signRdvToken } from '../../../lib/rdvToken';

export const prerender = false;

const ok = () => new Response('ok', { status: 200 });

async function tg(method: string, body: unknown) {
  return fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/${method}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
}
async function rpc(fn: string, body: unknown): Promise<any> {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST', headers: { apikey: SUPABASE_ANON as string, Authorization: `Bearer ${SUPABASE_ANON}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return r.ok ? r.json() : null;
}
const isUuid = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);

/** Carte réécrite après un changement de statut (sans RDV). */
function statusCard(lead: any, statut: string, by: string): string {
  const icon = statut === 'perdu' ? '❌' : statut === 'contacte' ? '📞' : '•';
  const prenom = (lead.nom || '').trim() || '—';
  return `${icon} ${STATUT_LABELS_TG[statut] || statut} — par ${by}\n👤 ${prenom}` +
    `${lead.telephone ? ' · 📞 ' + lead.telephone : ''}${lead.secteur ? ' · 📍 ' + lead.secteur : ''}` +
    `${lead.estimation ? ' · 💶 ' + lead.estimation + ' €' : ''}`;
}

export const POST: APIRoute = async ({ request }) => {
  // Sécurité : secret d'en-tête obligatoire
  if (!TELEGRAM_WEBHOOK_SECRET || request.headers.get('x-telegram-bot-api-secret-token') !== TELEGRAM_WEBHOOK_SECRET) {
    return new Response('forbidden', { status: 401 });
  }
  let update: any;
  try { update = await request.json(); } catch { return ok(); }

  const cq = update?.callback_query;
  if (!cq) return ok(); // on ignore tout sauf les clics de boutons

  const chatId = String(cq.message?.chat?.id || '');
  if (chatId !== String(TELEGRAM_LEADS_CHAT_ID)) return ok(); // uniquement notre groupe

  const data = String(cq.data || '');
  const sep = data.indexOf('|');
  const action = sep > 0 ? data.slice(0, sep) : data;
  const leadId = sep > 0 ? data.slice(sep + 1) : '';
  const from = String(cq.from?.first_name || cq.from?.username || 'équipe').slice(0, 40);
  const messageId = cq.message?.message_id;

  if (!isUuid(leadId)) { await tg('answerCallbackQuery', { callback_query_id: cq.id }); return ok(); }

  if (action === 'ct' || action === 'pd') {
    const statut = action === 'ct' ? 'contacte' : 'perdu';
    const r = await rpc('tg_set_status', { p_id: leadId, p_statut: statut, p_traite_par: from });
    await tg('answerCallbackQuery', { callback_query_id: cq.id, text: r?.ok ? `Statut : ${STATUT_LABELS_TG[statut]}` : 'Action impossible' });
    if (r?.ok && messageId) {
      // « Perdu » → on retire les boutons ; « Contacté » → on garde les actions
      const reply_markup = statut === 'perdu' ? { inline_keyboard: [] } : leadKeyboard(leadId);
      await tg('editMessageText', { chat_id: TELEGRAM_LEADS_CHAT_ID, message_id: messageId, text: statusCard(r.lead, statut, from), reply_markup });
    }
    return ok();
  }

  if (action === 'rdv') {
    const token = signRdvToken({ lead_id: leadId, tg_user: from, exp: Date.now() + 48 * 3600 * 1000 });
    const url = `${SITE_URL}/rdv/${token}`;
    await tg('answerCallbackQuery', { callback_query_id: cq.id, text: 'Lien du formulaire RDV ajouté ↑' });
    if (messageId) {
      await tg('editMessageReplyMarkup', {
        chat_id: TELEGRAM_LEADS_CHAT_ID, message_id: messageId,
        reply_markup: { inline_keyboard: [[{ text: '📅 Ouvrir le formulaire RDV →', url }], ...leadKeyboard(leadId).inline_keyboard] },
      });
    }
    return ok();
  }

  await tg('answerCallbackQuery', { callback_query_id: cq.id });
  return ok();
};

export const GET: APIRoute = () => new Response('ok');
