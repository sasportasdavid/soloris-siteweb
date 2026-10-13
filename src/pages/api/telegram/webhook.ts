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
 * - « À recontacter » (comme dans /admin : statut + date de rappel) :
 *   rc|{id} → choix rapide de la date · rcm|{id}|YYYY-MM → mini-calendrier du mois ·
 *   rcd|{id}|YYYY-MM-DD → RPC tg_set_recontacter + réécrit la carte · rcx|{id} → annule.
 *   x → bouton inerte (en-têtes du calendrier, jours passés).
 * - Perdu (commentaire obligatoire, comme dans /admin) : pd|{id} → boutons motif ;
 *   pdm|{id}|{motif} → le bot poste « Répondez à CE message avec un commentaire » (force_reply) ;
 *   la RÉPONSE (update `message`, reply_to_message du bot avec « réf. {id}·{motif} ») → RPC
 *   tg_set_perdu + carte réécrite. Nécessite allowed_updates ['callback_query','message'].
 * - Devis (comme « Créer / Envoyer le devis » dans /admin) :
 *   dv|{leadId} → dernier devis du lead (ou brouillon créé) posté en aperçu, en réponse à la carte ;
 *   dvs|{devisId} → envoie l'email au client (PDF + lien de signature), marque « envoyé », puis
 *   synchronise (journal, « Nouveau » → « Contacté », carte du lead réécrite avec la ligne devis) ;
 *   dvx → ferme l'aperçu. Accès devis via la clé service Supabase (RLS authenticated).
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
import {
  leadKeyboard, STATUT_LABELS_TG, recontacterKeyboard, calendarKeyboard, rappelDateOk, rappelLabel,
  MOTIFS_PERTE, perduKeyboard, perduPromptText, parsePerduRef,
} from '../../../lib/telegram';
import { cardKeyboard } from '../../../lib/telegramCard';
import { devisServerReady, getOrCreateDevisForLead, getDevis, patchDevis } from '../../../lib/devisServer';
import { syncAfterDevisEvent } from '../../../lib/devisSync';
import { sendDevisEmail, sentPatch } from '../../../lib/devisSend';
import { devisBlockers, devisPreviewText, devisPreviewKeyboard, devisSentText } from '../../../lib/telegramDevis';
import { signRdvToken } from '../../../lib/rdvToken';
import { fetchLeadForCard, rewriteLeadCard, refreshLeadCard } from '../../../lib/telegramPush';

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
/**
 * Réponse au message « commentaire de perte » du bot → lead perdu (motif + commentaire).
 * Tout autre message du groupe est ignoré (le bot ne lit que les réponses à ses messages).
 */
async function handlePerduReply(msg: any): Promise<Response> {
  const chatId = String(msg.chat?.id || '');
  const reply = msg.reply_to_message;
  const botId = String(TELEGRAM_BOT_TOKEN || '').split(':')[0];
  if (!ALLOWED_CHATS.has(chatId) || !reply || !botId || String(reply.from?.id) !== botId) return ok();
  const ref = parsePerduRef(reply.text);
  if (!ref) return ok();

  const commentaire = String(msg.text || '').trim();
  const from = String(msg.from?.first_name || msg.from?.username || 'équipe').slice(0, 40);
  const answer = (text: string) => tg('sendMessage', {
    chat_id: chatId, text, reply_parameters: { message_id: msg.message_id, allow_sending_without_reply: true },
  });
  if (commentaire.length < 3) {
    await answer('Commentaire trop court : répondez au message ❌ avec quelques mots expliquant la perte.');
    return ok();
  }
  console.log(`[tg-webhook] perdu · lead ${ref.leadId} · motif ${ref.motif} · par ${from}`);
  const r = await rpc('tg_set_perdu', { p_id: ref.leadId, p_motif: ref.motif, p_commentaire: commentaire, p_traite_par: from });
  if (!r?.ok) { await answer('Impossible d’enregistrer la perte de ce lead.'); return ok(); }

  await refreshLeadCard(ref.leadId, { chatId, postIfMissing: false });
  await tg('editMessageText', {
    chat_id: chatId, message_id: reply.message_id,
    text: `❌ Lead marqué perdu · ${MOTIFS_PERTE[ref.motif]} · par ${from}\n💬 « ${r.perte_commentaire || commentaire} »`,
  });
  return ok();
}

/**
 * Statuts avancés qu'un clic « Contacté » / « À recontacter » ne doit jamais rétrograder : une carte
 * périmée (affichée avant que le lead ait avancé depuis /admin) garde ses boutons ; on resynchronise
 * la carte avec la base au lieu d'écraser le statut.
 */
const PROTEGES = new Set(['rdv_pris', 'realise', 'facture', 'perdu']);

const isUuid = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);

export const POST: APIRoute = async ({ request }) => {
  // Sécurité : secret d'en-tête obligatoire
  if (!tokenOk(request.headers.get('x-telegram-bot-api-secret-token'))) {
    console.warn('[tg-webhook] requête rejetée : jeton d’en-tête absent ou différent du jeton attendu (ré-enregistrer le webhook depuis /admin → Outils)');
    return new Response('forbidden', { status: 401 });
  }
  let update: any;
  try { update = await request.json(); } catch { return ok(); }

  if (update?.message) return handlePerduReply(update.message);
  const cq = update?.callback_query;
  if (!cq) return ok(); // on ignore tout sauf les clics de boutons et les réponses au bot

  const chatId = String(cq.message?.chat?.id || '');
  const data = String(cq.data || '');
  const [action, leadId = '', arg = ''] = data.split('|');
  const from = String(cq.from?.first_name || cq.from?.username || 'équipe').slice(0, 40);
  const messageId = cq.message?.message_id;

  // Uniquement nos chats (cartes lead / groupe RDV). On répond au clic pour que le
  // bouton ne tourne pas dans le vide et on trace le chat refusé pour le diagnostic.
  if (!ALLOWED_CHATS.has(chatId)) {
    console.warn(`[tg-webhook] clic ignoré : chat ${chatId || '(inconnu)'} non autorisé (attendus : ${[...ALLOWED_CHATS].join(', ') || 'aucun chat configuré'}) · action ${action}`);
    await tg('answerCallbackQuery', { callback_query_id: cq.id, text: 'Ce chat n’est pas autorisé pour les actions lead.' });
    return ok();
  }
  if (action === 'x') { await tg('answerCallbackQuery', { callback_query_id: cq.id }); return ok(); }
  if (action === 'dvx') {
    await tg('answerCallbackQuery', { callback_query_id: cq.id });
    if (messageId) {
      const del = await tg('deleteMessage', { chat_id: chatId, message_id: messageId });
      if (!del?.ok) await tg('editMessageText', { chat_id: chatId, message_id: messageId, text: 'Aperçu du devis fermé.' });
    }
    return ok();
  }
  console.log(`[tg-webhook] clic ${action}${arg ? ' ' + arg : ''} · lead ${leadId || '—'} · chat ${chatId} · message ${messageId ?? '—'}`);

  if (!isUuid(leadId)) { await tg('answerCallbackQuery', { callback_query_id: cq.id }); return ok(); }

  if (action === 'ct') {
    const statut = 'contacte';
    const before = await fetchLeadForCard(leadId);
    if (before && PROTEGES.has(before.statut)) {
      console.log(`[tg-webhook] ct ignoré : lead ${leadId} déjà « ${before.statut} » — carte resynchronisée`);
      await tg('answerCallbackQuery', { callback_query_id: cq.id, text: `Déjà « ${STATUT_LABELS_TG[before.statut] || before.statut} » — carte mise à jour.` });
      if (messageId) await rewriteLeadCard(before, { chatId, messageId, postIfMissing: false });
      return ok();
    }
    const r = await rpc('tg_set_status', { p_id: leadId, p_statut: statut, p_traite_par: from });
    await tg('answerCallbackQuery', { callback_query_id: cq.id, text: r?.ok ? `Statut : ${STATUT_LABELS_TG[statut]}` : 'Action impossible' });
    if (r?.ok && messageId) {
      // Carte complète réécrite (source unique) : détails du lead + ligne « 📞 Contacté · par X »
      // ou « ❌ Perdu … » ; le clavier reste tant que le lead est ouvert, retiré sinon.
      const full = await fetchLeadForCard(leadId);
      if (full) await rewriteLeadCard(full, { chatId, messageId, postIfMissing: false });
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

  // ── Perdu : motif (clavier remplacé sur place), puis demande de commentaire ──
  if (action === 'pd') {
    await tg('answerCallbackQuery', { callback_query_id: cq.id, text: 'Motif de la perte ?' });
    if (messageId) await tg('editMessageReplyMarkup', { chat_id: chatId, message_id: messageId, reply_markup: perduKeyboard(leadId) });
    return ok();
  }

  if (action === 'pdm') {
    if (!MOTIFS_PERTE[arg]) { await tg('answerCallbackQuery', { callback_query_id: cq.id }); return ok(); }
    const full = await fetchLeadForCard(leadId);
    await tg('answerCallbackQuery', { callback_query_id: cq.id, text: 'Répondez au message ❌ avec un commentaire ↓' });
    // La carte retrouve ses boutons : le lead ne passe « perdu » qu'avec le commentaire.
    if (messageId) await tg('editMessageReplyMarkup', { chat_id: chatId, message_id: messageId, reply_markup: full ? cardKeyboard(full) : leadKeyboard(leadId) });
    await tg('sendMessage', {
      chat_id: chatId, text: perduPromptText(full?.nom, arg, leadId),
      reply_markup: { force_reply: true, input_field_placeholder: 'Pourquoi ce lead est perdu ?' },
      ...(messageId ? { reply_parameters: { message_id: messageId, allow_sending_without_reply: true } } : {}),
    });
    return ok();
  }

  // ── À recontacter : choix de la date (clavier remplacé sur place), puis enregistrement ──
  if (action === 'rc' || action === 'rcm') {
    const month = /^\d{4}-\d{2}$/.test(arg) ? arg : '';
    const reply_markup = action === 'rcm' && month ? calendarKeyboard(leadId, month) : recontacterKeyboard(leadId);
    await tg('answerCallbackQuery', { callback_query_id: cq.id, text: action === 'rc' ? 'Quand rappeler ce lead ?' : undefined });
    if (messageId) await tg('editMessageReplyMarkup', { chat_id: chatId, message_id: messageId, reply_markup });
    return ok();
  }

  if (action === 'rcd') {
    if (!rappelDateOk(arg)) {
      await tg('answerCallbackQuery', { callback_query_id: cq.id, text: 'Date invalide ou passée.', show_alert: true });
      return ok();
    }
    const before = await fetchLeadForCard(leadId);
    if (before && PROTEGES.has(before.statut)) {
      console.log(`[tg-webhook] rcd ignoré : lead ${leadId} déjà « ${before.statut} » — carte resynchronisée`);
      await tg('answerCallbackQuery', { callback_query_id: cq.id, text: `Déjà « ${STATUT_LABELS_TG[before.statut] || before.statut} » — carte mise à jour.`, show_alert: true });
      if (messageId) await rewriteLeadCard(before, { chatId, messageId, postIfMissing: false });
      return ok();
    }
    const r = await rpc('tg_set_recontacter', { p_id: leadId, p_date: arg, p_traite_par: from });
    await tg('answerCallbackQuery', { callback_query_id: cq.id, text: r?.ok ? `🔁 À recontacter le ${rappelLabel(arg)}` : 'Action impossible' });
    if (r?.ok && messageId) {
      const full = await fetchLeadForCard(leadId);
      if (full) await rewriteLeadCard(full, { chatId, messageId, postIfMissing: false });
    }
    return ok();
  }

  if (action === 'rcx') {
    await tg('answerCallbackQuery', { callback_query_id: cq.id });
    const full = await fetchLeadForCard(leadId);
    if (messageId) {
      await tg('editMessageReplyMarkup', {
        chat_id: chatId, message_id: messageId,
        reply_markup: full ? cardKeyboard(full) : leadKeyboard(leadId),
      });
    }
    return ok();
  }

  // ── Devis : aperçu (avec confirmation) puis envoi au client ──
  if (action === 'dv' || action === 'dvs') {
    if (!devisServerReady()) {
      console.error('[tg-webhook] devis : SUPABASE_SERVICE_ROLE absente');
      await tg('answerCallbackQuery', { callback_query_id: cq.id, text: 'Devis indisponible depuis Telegram (clé service Supabase manquante).', show_alert: true });
      return ok();
    }
  }

  if (action === 'dv') {
    const res = await getOrCreateDevisForLead(leadId);
    if (!res) { await tg('answerCallbackQuery', { callback_query_id: cq.id, text: 'Devis impossible à préparer.', show_alert: true }); return ok(); }
    await tg('answerCallbackQuery', { callback_query_id: cq.id, text: `Devis ${res.devis.numero} — vérifiez puis confirmez l’envoi ↓` });
    await tg('sendMessage', {
      chat_id: chatId, text: devisPreviewText(res.devis), disable_web_page_preview: true,
      reply_markup: devisPreviewKeyboard(res.devis),
      ...(messageId ? { reply_parameters: { message_id: messageId, allow_sending_without_reply: true } } : {}),
    });
    return ok();
  }

  if (action === 'dvs') {
    const d = await getDevis(leadId);
    if (!d) { await tg('answerCallbackQuery', { callback_query_id: cq.id, text: 'Devis introuvable.', show_alert: true }); return ok(); }
    const blockers = devisBlockers(d);
    if (blockers.length) {
      await tg('answerCallbackQuery', { callback_query_id: cq.id, text: `Envoi impossible : ${blockers.join(', ')}.`, show_alert: true });
      return ok();
    }
    // Anti double-clic : un envoi de moins de 2 min n'est pas répété.
    if (d.sent_at && Date.now() - new Date(d.sent_at).getTime() < 120_000) {
      await tg('answerCallbackQuery', { callback_query_id: cq.id, text: 'Ce devis vient d’être envoyé.', show_alert: true });
      return ok();
    }
    await tg('answerCallbackQuery', { callback_query_id: cq.id, text: 'Envoi en cours…' });
    if (messageId) await tg('editMessageReplyMarkup', { chat_id: chatId, message_id: messageId, reply_markup: { inline_keyboard: [] } });

    const sent = await sendDevisEmail(d);
    if (!sent.ok) {
      console.error(`[tg-webhook] devis ${d.numero} : envoi échoué (${sent.status})`, sent.detail || sent.error);
      if (messageId) {
        await tg('editMessageText', {
          chat_id: chatId, message_id: messageId, disable_web_page_preview: true,
          text: `${devisPreviewText(d)}\n\n❌ ${sent.error}`, reply_markup: devisPreviewKeyboard(d),
        });
      }
      return ok();
    }
    await patchDevis(d.id, sentPatch(d));
    await syncAfterDevisEvent({ leadId: d.lead_id, kind: 'envoye', detail: `envoyé ${d.numero} à ${sent.to}`, par: from });
    console.log(`[tg-webhook] devis ${d.numero} envoyé à ${sent.to} · par ${from}`);
    if (messageId) await tg('editMessageText', { chat_id: chatId, message_id: messageId, text: devisSentText(d, sent.to, from) });
    return ok();
  }

  await tg('answerCallbackQuery', { callback_query_id: cq.id });
  return ok();
};

export const GET: APIRoute = () => new Response('ok');
