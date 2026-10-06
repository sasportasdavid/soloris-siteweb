/**
 * POST /api/telegram/webhook — webhook entrant Telegram (boutons sous les cartes lead).
 * - Vérifie X-Telegram-Bot-Api-Secret-Token == TELEGRAM_WEBHOOK_TOKEN (jeton transmis à Telegram
 *   par /api/telegram/setup ; dérivé du secret si celui-ci contient des caractères refusés).
 * - N'accepte que les callback_query venant des chats connus : celui où les cartes sont
 *   postées (TELEGRAM_CHAT_ID) et le groupe « Soloris Leads » (TELEGRAM_LEADS_CHAT_ID).
 *   Ils sont en général identiques ; s'ils diffèrent, les clics restent acceptés et la
 *   carte est réécrite dans le chat d'où vient le clic (celui du message cliqué).
 * - ct|{id} / pd|{id} → statut Supabase + réécrit la carte ; rdv|{id} → ajoute un
 *   bouton URL vers le formulaire RDV signé (lien expirant 48 h).
 * - Journalise chaque clic (action, lead, chat) et chaque erreur Telegram / RPC pour
 *   le diagnostic dans les logs Vercel. Aucun secret n'est journalisé.
 * Secrets côté serveur uniquement.
 */
import type { APIRoute } from 'astro';
import { timingSafeEqual } from 'node:crypto';
import {
  SUPABASE_URL, SUPABASE_ANON, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID,
  TELEGRAM_LEADS_CHAT_ID, TELEGRAM_WEBHOOK_TOKEN, SITE_URL,
} from '../../../lib/serverEnv';
import { leadKeyboard, STATUT_LABELS_TG } from '../../../lib/telegram';
import { signRdvToken } from '../../../lib/rdvToken';

export const prerender = false;

const ok = () => new Response('ok', { status: 200 });

/** Comparaison à temps constant du jeton d'en-tête avec le jeton attendu. */
function tokenOk(header: string | null): boolean {
  if (!TELEGRAM_WEBHOOK_TOKEN || !header) return false;
  const a = Buffer.from(header), b = Buffer.from(TELEGRAM_WEBHOOK_TOKEN);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Chats dont les clics sont acceptés : chat des cartes lead + groupe RDV. */
const ALLOWED_CHATS = new Set(
  [TELEGRAM_CHAT_ID, TELEGRAM_LEADS_CHAT_ID].filter((v): v is string => !!v).map(String),
);

/** Appel Bot API. Ne lève jamais : une erreur Telegram est journalisée (sans token) et
 *  renvoie null, pour toujours répondre 200 à Telegram (sinon il rejoue l'update en boucle). */
async function tg(method: string, body: unknown): Promise<Response | null> {
  try {
    const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/${method}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      console.error(`[tg-webhook] Telegram ${method} → ${res.status}`, txt.slice(0, 300));
    }
    return res;
  } catch (e) {
    console.error(`[tg-webhook] Telegram ${method} injoignable :`, e);
    return null;
  }
}
/** RPC Supabase (security definer). Renvoie null en cas d'échec, après l'avoir journalisé. */
async function rpc(fn: string, body: unknown): Promise<any> {
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
      method: 'POST', headers: { apikey: SUPABASE_ANON as string, Authorization: `Bearer ${SUPABASE_ANON}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!r.ok) {
      const txt = await r.text().catch(() => '');
      console.error(`[tg-webhook] RPC ${fn} → ${r.status}`, txt.slice(0, 300));
      return null;
    }
    return await r.json();
  } catch (e) {
    console.error(`[tg-webhook] RPC ${fn} injoignable :`, e);
    return null;
  }
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
  if (!tokenOk(request.headers.get('x-telegram-bot-api-secret-token'))) {
    console.warn('[tg-webhook] requête rejetée : jeton d’en-tête absent ou différent du jeton attendu (ré-enregistrer le webhook depuis /admin → Outils)');
    return new Response('forbidden', { status: 401 });
  }
  let update: any;
  try { update = await request.json(); } catch { return ok(); }

  const cq = update?.callback_query;
  if (!cq) return ok(); // on ignore tout sauf les clics de boutons

  const chatId = String(cq.message?.chat?.id || '');
  const data = String(cq.data || '');
  const sep = data.indexOf('|');
  const action = sep > 0 ? data.slice(0, sep) : data;
  const leadId = sep > 0 ? data.slice(sep + 1) : '';
  const from = String(cq.from?.first_name || cq.from?.username || 'équipe').slice(0, 40);
  const messageId = cq.message?.message_id;

  // Uniquement nos chats (cartes lead / groupe RDV). On répond au clic pour que le
  // bouton ne tourne pas dans le vide et on trace le chat refusé pour le diagnostic.
  if (!ALLOWED_CHATS.has(chatId)) {
    console.warn(`[tg-webhook] clic ignoré : chat ${chatId || '(inconnu)'} non autorisé (attendus : ${[...ALLOWED_CHATS].join(', ') || 'aucun chat configuré'}) · action ${action}`);
    await tg('answerCallbackQuery', { callback_query_id: cq.id, text: 'Ce chat n’est pas autorisé pour les actions lead.' });
    return ok();
  }
  console.log(`[tg-webhook] clic ${action} · lead ${leadId || '—'} · chat ${chatId} · message ${messageId ?? '—'}`);

  if (!isUuid(leadId)) { await tg('answerCallbackQuery', { callback_query_id: cq.id }); return ok(); }

  if (action === 'ct' || action === 'pd') {
    const statut = action === 'ct' ? 'contacte' : 'perdu';
    const r = await rpc('tg_set_status', { p_id: leadId, p_statut: statut, p_traite_par: from });
    await tg('answerCallbackQuery', { callback_query_id: cq.id, text: r?.ok ? `Statut : ${STATUT_LABELS_TG[statut]}` : 'Action impossible' });
    if (r?.ok && messageId) {
      // « Perdu » → on retire les boutons ; « Contacté » → on garde les actions
      const reply_markup = statut === 'perdu' ? { inline_keyboard: [] } : leadKeyboard(leadId);
      await tg('editMessageText', { chat_id: chatId, message_id: messageId, text: statusCard(r.lead, statut, from), reply_markup });
    }
    return ok();
  }

  if (action === 'rdv') {
    const token = signRdvToken({ lead_id: leadId, tg_user: from, exp: Date.now() + 48 * 3600 * 1000 });
    const url = `${SITE_URL}/rdv/${token}`;
    await tg('answerCallbackQuery', { callback_query_id: cq.id, text: 'Lien du formulaire RDV ajouté ↑' });
    if (messageId) {
      await tg('editMessageReplyMarkup', {
        chat_id: chatId, message_id: messageId,
        reply_markup: { inline_keyboard: [[{ text: '📅 Ouvrir le formulaire RDV →', url }], ...leadKeyboard(leadId).inline_keyboard] },
      });
    }
    return ok();
  }

  await tg('answerCallbackQuery', { callback_query_id: cq.id });
  return ok();
};

export const GET: APIRoute = () => new Response('ok');
