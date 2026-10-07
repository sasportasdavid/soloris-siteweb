/**
 * Lecture centralisée des variables d'environnement côté SERVEUR.
 * ⚠️ Sur Vercel (adaptateur Node), les secrets NON `PUBLIC_` ne sont pas garantis
 * dans `import.meta.env` au runtime → on lit `process.env` EN PRIORITÉ, avec repli
 * `import.meta.env` (références statiques) pour le dev local.
 */
import { createHash } from 'node:crypto';

const P: Record<string, string | undefined> =
  typeof process !== 'undefined' && process.env ? (process.env as any) : {};

function pick(runtime: string | undefined, build: string | undefined): string | undefined {
  return (runtime && runtime.length ? runtime : undefined) || (build && build.length ? build : undefined);
}

export const SUPABASE_URL = pick(P.PUBLIC_SUPABASE_URL, import.meta.env.PUBLIC_SUPABASE_URL);
export const SUPABASE_ANON = pick(P.PUBLIC_SUPABASE_ANON_KEY, import.meta.env.PUBLIC_SUPABASE_ANON_KEY);
/** Clé service_role (facultative) : création / blocage des comptes de connexion des opérateurs. */
export const SUPABASE_SERVICE_ROLE = pick(P.SUPABASE_SERVICE_ROLE, import.meta.env.SUPABASE_SERVICE_ROLE);

export const RESEND_API_KEY = pick(P.RESEND_API_KEY, import.meta.env.RESEND_API_KEY);
/** Expéditeur des emails. Domaine à vérifier dans Resend (ex. "Soloris <devis@soloris.fr>"). */
export const DEVIS_FROM_EMAIL = pick(P.DEVIS_FROM_EMAIL, import.meta.env.DEVIS_FROM_EMAIL) || 'Soloris <onboarding@resend.dev>';
/** Expéditeur de l'email de confirmation au lead (domaine vérifié Resend). */
export const CONFIRM_FROM_EMAIL = pick(P.CONFIRM_FROM_EMAIL, import.meta.env.CONFIRM_FROM_EMAIL) || 'Soloris <contact@soloris.fr>';

export const TELEGRAM_BOT_TOKEN = pick(P.TELEGRAM_BOT_TOKEN, import.meta.env.TELEGRAM_BOT_TOKEN);
export const TELEGRAM_CHAT_ID = pick(P.TELEGRAM_CHAT_ID, import.meta.env.TELEGRAM_CHAT_ID);
/** Canal Telegram « Soloris Leads » pour les confirmations de RDV (repli sur la valeur fournie). */
export const TELEGRAM_LEADS_CHAT_ID = pick(P.TELEGRAM_LEADS_CHAT_ID, import.meta.env.TELEGRAM_LEADS_CHAT_ID) || '-1003709950379';
/** Secret maître du webhook Telegram (variable Vercel). Sert de clé à /api/telegram/setup. */
export const TELEGRAM_WEBHOOK_SECRET = pick(P.TELEGRAM_WEBHOOK_SECRET, import.meta.env.TELEGRAM_WEBHOOK_SECRET);
/** Telegram n'accepte comme secret_token que 1 à 256 caractères parmi A-Z a-z 0-9 _ - . */
const TELEGRAM_TOKEN_OK = /^[A-Za-z0-9_-]{1,256}$/;
/**
 * Jeton RÉELLEMENT transmis à Telegram (setWebhook.secret_token) et vérifié sur chaque requête
 * entrante (en-tête X-Telegram-Bot-Api-Secret-Token). Si TELEGRAM_WEBHOOK_SECRET respecte le
 * jeu de caractères de Telegram, c'est lui ; sinon on dérive un jeton déterministe (SHA-256 en
 * base64url, 43 caractères, tous autorisés) — même entropie, aucun changement de variable Vercel.
 * Les deux côtés (enregistrement et vérification) utilisent cette même valeur.
 */
export const TELEGRAM_WEBHOOK_TOKEN: string | undefined = TELEGRAM_WEBHOOK_SECRET
  ? (TELEGRAM_TOKEN_OK.test(TELEGRAM_WEBHOOK_SECRET)
      ? TELEGRAM_WEBHOOK_SECRET
      : createHash('sha256').update(TELEGRAM_WEBHOOK_SECRET).digest('base64url'))
  : undefined;
/** Vrai si le jeton Telegram a dû être dérivé du secret (caractères non autorisés dans le secret). */
export const TELEGRAM_WEBHOOK_TOKEN_DERIVE = !!TELEGRAM_WEBHOOK_SECRET && TELEGRAM_WEBHOOK_TOKEN !== TELEGRAM_WEBHOOK_SECRET;
/** Secret de signature HMAC des liens publics /rdv/{token}. */
export const RDV_LINK_SECRET = pick(P.RDV_LINK_SECRET, import.meta.env.RDV_LINK_SECRET);

/** URL publique du site (liens dans les emails / PDF). */
export const SITE_URL = (pick(P.SITE_URL, import.meta.env.SITE_URL) || 'https://www.soloris.fr').replace(/\/$/, '');
