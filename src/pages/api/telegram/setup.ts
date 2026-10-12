/**
 * GET /api/telegram/setup — outil d'administration (one-shot) pour (ré)enregistrer
 * le webhook Telegram des boutons de cartes lead, SANS manipuler le token à la main.
 *
 * Protégé : soit ?key=<TELEGRAM_WEBHOOK_SECRET>, soit une session back-office
 * (Authorization: Bearer <jwt Supabase>, comme /api/rdv/confirm) — ce second mode permet
 * de déclencher l'enregistrement depuis /admin sans manipuler de variable Vercel.
 * L'endpoint lit le token et le secret côté serveur, appelle setWebhook avec EXACTEMENT le
 * jeton que le webhook entrant vérifie (TELEGRAM_WEBHOOK_TOKEN : le secret lui-même, ou sa
 * dérivation SHA-256 si le secret contient des caractères refusés par Telegram — donc aucun
 * risque de décalage ni de « secret token contains illegal characters »), puis renvoie getWebhookInfo + un
 * diagnostic des chats (chat où les cartes sont postées vs groupe RDV ; le webhook
 * entrant accepte les clics venant de l'un comme de l'autre).
 *
 *   ?key=SECRET            → setWebhook puis getWebhookInfo (enregistrement)
 *   ?key=SECRET&info=1     → getWebhookInfo seul (diagnostic, ne modifie rien)
 *   (ou les mêmes appels sans clé, avec l'en-tête Authorization du back-office)
 *
 * Ne renvoie JAMAIS le token. getWebhookInfo ne contient ni token ni secret.
 */
import type { APIRoute } from 'astro';
import {
  SUPABASE_URL, SUPABASE_ANON, TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET,
  TELEGRAM_WEBHOOK_TOKEN, TELEGRAM_WEBHOOK_TOKEN_DERIVE, TELEGRAM_CHAT_ID,
  TELEGRAM_LEADS_CHAT_ID, SITE_URL,
} from '../../../lib/serverEnv';

export const prerender = false;

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data, null, 2), {
    status, headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

async function tg(method: string, body?: unknown): Promise<any> {
  try {
    const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/${method}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {}),
    });
    return await res.json().catch(() => ({ ok: false, description: 'réponse Telegram illisible' }));
  } catch (e) {
    console.error(`[tg-setup] Telegram ${method} injoignable :`, e);
    return { ok: false, description: 'Telegram injoignable depuis le serveur' };
  }
}

/** Vérifie le JWT Supabase d'une session back-office → email de l'admin, ou null. */
async function adminEmail(jwt: string): Promise<string | null> {
  if (!SUPABASE_URL || !SUPABASE_ANON) return null;
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: SUPABASE_ANON as string, Authorization: `Bearer ${jwt}` } });
    if (!res.ok) return null;
    const u = await res.json();
    return u?.email || 'back-office';
  } catch { return null; }
}

export const GET: APIRoute = async ({ url, request }) => {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_WEBHOOK_SECRET || !TELEGRAM_WEBHOOK_TOKEN) {
    return json({ error: 'TELEGRAM_BOT_TOKEN ou TELEGRAM_WEBHOOK_SECRET absent au runtime (vérifier les variables Vercel en Production + redéployer).' }, 500);
  }
  // Garde : soit le secret (le même que celui posé en Vercel), soit une session admin valide.
  let declenchePar = '';
  const key = url.searchParams.get('key');
  if (key && key === TELEGRAM_WEBHOOK_SECRET) {
    declenchePar = 'clé';
  } else {
    const jwt = (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim();
    const email = jwt ? await adminEmail(jwt) : null;
    if (!email) {
      return json({ error: 'Non autorisé. Appeler avec ?key=<TELEGRAM_WEBHOOK_SECRET> ou depuis le back-office (session admin).' }, 401);
    }
    declenchePar = email;
  }

  const webhookUrl = `${SITE_URL}/api/telegram/webhook`;
  const infoOnly = url.searchParams.get('info') === '1';
  console.log(`[tg-setup] ${infoOnly ? 'diagnostic' : 'enregistrement du webhook'} demandé par ${declenchePar}`);

  let setResult: any = null;
  if (!infoOnly) {
    setResult = await tg('setWebhook', {
      url: webhookUrl,
      secret_token: TELEGRAM_WEBHOOK_TOKEN,
      allowed_updates: ['callback_query'],
    });
  }
  const infoRaw = await tg('getWebhookInfo');
  const info = infoRaw?.result || infoRaw;

  // Diagnostic des chats : les cartes sont postées dans TELEGRAM_CHAT_ID, les RDV dans
  // TELEGRAM_LEADS_CHAT_ID. Le webhook entrant accepte les clics venant des deux ; on
  // signale simplement s'ils diffèrent (information, plus une cause de boutons inertes).
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
      // Vrai si le secret Vercel contient des caractères refusés par Telegram : le jeton transmis
      // et vérifié est alors sa dérivation SHA-256 (base64url). Aucune action requise.
      jeton_derive: TELEGRAM_WEBHOOK_TOKEN_DERIVE,
      // Chats (identiques dans la configuration habituelle ; les deux sont acceptés par le webhook)
      chat_cartes_postees: String(TELEGRAM_CHAT_ID || '(non défini)'),
      chat_accepte_par_webhook: String(TELEGRAM_LEADS_CHAT_ID || '(non défini)'),
      chat_match: chatMatch,
    },
  });
};
