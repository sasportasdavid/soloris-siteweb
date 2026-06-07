/**
 * GET /api/telegram/setup — outil d'administration (one-shot) pour (ré)enregistrer
 * le webhook Telegram des boutons de cartes lead, SANS manipuler le token à la main.
 *
 * Protégé par le secret : ?key=<TELEGRAM_WEBHOOK_SECRET>. L'endpoint lit le token et
 * le secret côté serveur, appelle setWebhook avec EXACTEMENT TELEGRAM_WEBHOOK_SECRET
 * (donc aucun risque de décalage de secret), puis renvoie getWebhookInfo + un
 * diagnostic du filtre de groupe (chat où les cartes sont postées vs chat accepté
 * par le webhook entrant).
 *
 *   ?key=SECRET            → setWebhook puis getWebhookInfo (enregistrement)
 *   ?key=SECRET&info=1     → getWebhookInfo seul (diagnostic, ne modifie rien)
 *
 * Ne renvoie JAMAIS le token. getWebhookInfo ne contient ni token ni secret.
 */
import type { APIRoute } from 'astro';
import {
  TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET, TELEGRAM_CHAT_ID,
  TELEGRAM_LEADS_CHAT_ID, SITE_URL,
} from '../../../lib/serverEnv';

export const prerender = false;

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data, null, 2), {
    status, headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

async function tg(method: string, body?: unknown): Promise<any> {
  const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/${method}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}),
  });
  return res.json().catch(() => ({ ok: false, description: 'réponse Telegram illisible' }));
}

export const GET: APIRoute = async ({ url }) => {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_WEBHOOK_SECRET) {
    return json({ error: 'TELEGRAM_BOT_TOKEN ou TELEGRAM_WEBHOOK_SECRET absent au runtime (vérifier les variables Vercel en Production + redéployer).' }, 500);
  }
  // Garde : il faut connaître le secret pour déclencher (le même que celui posé en Vercel).
  if (url.searchParams.get('key') !== TELEGRAM_WEBHOOK_SECRET) {
    return json({ error: 'Clé invalide. Appeler avec ?key=<TELEGRAM_WEBHOOK_SECRET>.' }, 401);
  }

  const webhookUrl = `${SITE_URL}/api/telegram/webhook`;
  const infoOnly = url.searchParams.get('info') === '1';

  let setResult: any = null;
  if (!infoOnly) {
    setResult = await tg('setWebhook', {
      url: webhookUrl,
      secret_token: TELEGRAM_WEBHOOK_SECRET,
      allowed_updates: ['callback_query'],
    });
  }
  const infoRaw = await tg('getWebhookInfo');
  const info = infoRaw?.result || infoRaw;

  // Diagnostic du filtre de groupe : le webhook entrant n'accepte que les clics venant
  // de TELEGRAM_LEADS_CHAT_ID. Les cartes sont postées dans TELEGRAM_CHAT_ID. S'ils
  // diffèrent, les boutons resteront inertes (callback rejeté). On le signale.
  const chatMatch = String(TELEGRAM_CHAT_ID || '') === String(TELEGRAM_LEADS_CHAT_ID || '');

  return json({
    action: infoOnly ? 'getWebhookInfo' : 'setWebhook + getWebhookInfo',
    set_webhook: setResult,
    webhook_info: info,
    diagnostics: {
      webhook_url_attendu: webhookUrl,
      url_enregistree: info?.url || '',
      url_ok: (info?.url || '') === webhookUrl,
      pending_update_count: info?.pending_update_count ?? null,
      last_error_message: info?.last_error_message || null,
      // Filtre de groupe (les 2 doivent être identiques pour que les boutons marchent)
      chat_cartes_postees: String(TELEGRAM_CHAT_ID || '(non défini)'),
      chat_accepte_par_webhook: String(TELEGRAM_LEADS_CHAT_ID || '(non défini)'),
      chat_match: chatMatch,
    },
  });
};
