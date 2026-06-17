/**
 * Endpoint serveur des leads (Soloris).
 * - Capture PROGRESSIVE : upsert par session via la fonction Postgres SECURITY
 *   DEFINER `upsert_lead` (la clé anon ne peut pas lire/écrire arbitrairement les
 *   leads ; toute la logique est encapsulée côté base). Pas besoin de service_role.
 * - Statut `partiel` (formulaire non finalisé) / `complet` (validé à 100 %).
 * - ⚠️ La CONVERSION Google Ads est déclenchée CÔTÉ CLIENT, UNIQUEMENT sur
 *   formulaire complet. Cet endpoint n'émet JAMAIS de conversion.
 * - Notifications Telegram (serveur, hors cookies) anti double-envoi :
 *   🟠 lead partiel (dès qu'un tel/email est présent) · 🟢 lead complet ·
 *   📨 contact · 💬 chat. Les flags sont gérés atomiquement par la fonction.
 */
import type { APIRoute } from 'astro';
import { sendLeadConfirmation } from '../../lib/confirmEmail';
import { leadKeyboard } from '../../lib/telegram';
import { computePrix, prixDes } from '../../lib/pricing';

export const prerender = false;

/**
 * Lecture d'une variable d'environnement.
 * ⚠️ Sur Vercel (adaptateur Node), les secrets NON `PUBLIC_` ne sont pas
 * garantis dans `import.meta.env` au runtime (inlining build-time only).
 * On lit donc `process.env` EN PRIORITÉ (valeur runtime fiable), avec repli sur
 * `import.meta.env` (références statiques, pour le dev local).
 */
function envVar(runtime: string | undefined, buildtime: string | undefined): string | undefined {
  return (runtime && runtime.length ? runtime : undefined) || (buildtime && buildtime.length ? buildtime : undefined);
}
const P = typeof process !== 'undefined' && process.env ? process.env : ({} as Record<string, string | undefined>);

const DEMANDES = ['vente', 'location', 'dpe', 'audit'];
const BIENS = ['appartement', 'maison', 'cave', 'parking', 'box'];
const AGES = ['avant1949', 'intermediaire', 'recent'];

const HITS = new Map<string, number[]>();
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 20; // capture progressive : plusieurs upserts par session

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const arr = (HITS.get(ip) || []).filter((t) => now - t < WINDOW_MS);
  arr.push(now);
  HITS.set(ip, arr);
  return arr.length > MAX_PER_WINDOW;
}

function clean(v: unknown, max = 500): string | null {
  if (typeof v !== 'string') return null;
  const s = v.trim().slice(0, max);
  return s.length ? s : null;
}

/** Valide un uuid (sinon chaîne vide : la fonction RPC l'ignore via nullif). */
function uuidOrEmpty(v: unknown): string {
  return typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v) ? v : '';
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

/** Notification Telegram (non bloquante). kind: 'partiel' | 'complet' | 'contact' | 'chat'.
 *  Renvoie le message_id de la carte postée (pour la réécrire ensuite), ou null. */
async function notifyTelegram(lead: Record<string, any>, kind: string, leadId?: string | null, editMessageId?: number | null): Promise<number | null> {
  const token = envVar(P.TELEGRAM_BOT_TOKEN, import.meta.env.TELEGRAM_BOT_TOKEN);
  const chatId = envVar(P.TELEGRAM_CHAT_ID, import.meta.env.TELEGRAM_CHAT_ID);
  if (!token || !chatId) {
    console.error('[lead] Telegram non configuré (TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID absents) — lead enregistré, notification ignorée.');
    return null;
  }

  let dateHeure = '';
  try { dateHeure = new Date().toLocaleString('fr-FR', { timeZone: 'Europe/Paris', dateStyle: 'short', timeStyle: 'short' }); }
  catch { dateHeure = new Date().toISOString(); }

  const ageLbl: Record<string, string> = { avant1949: 'avant 1949', intermediaire: '1949 à <15 ans', recent: '<15 ans' };
  const bienLine = [lead.type_demande || '—', lead.type_bien, lead.age_bien ? ageLbl[lead.age_bien] || lead.age_bien : '', lead.surface ? `${lead.surface} m²` : '']
    .filter(Boolean).join(' · ');
  const annexeLine = lead.annexe
    ? `🔧 annexe : ${lead.annexe_type === 'garage_dependance' ? 'garage / dépendance' : 'cave / parking / box'} (inclus)`
    : '';
  const acqLine = (lead.gads_keyword || lead.campaign)
    ? `🎯 ${lead.gads_keyword ? 'mot-clé ciblé : ' + lead.gads_keyword : ''}${lead.gads_keyword && lead.campaign ? ' · ' : ''}${lead.campaign ? 'campagne : ' + lead.campaign : ''}`
    : '';
  const prenom = (lead.nom || '').trim().split(/\s+/)[0] || '—';

  // 📍 Lieu : code postal + ville (« 75011 Paris »). Tolère l'absence de l'un ou l'autre.
  const lieuLine = (lead.secteur || lead.ville)
    ? `📍 ${[lead.secteur, lead.ville].filter(Boolean).join(' ')}`
    : '';

  // 💶 Toujours montrer un montant : estimation exacte si connue, sinon prix
  // d'entrée de la prestation (« à partir de ») tant que les infos sont incomplètes.
  const demandeOk = lead.type_demande && DEMANDES.includes(lead.type_demande) ? lead.type_demande : null;
  const estimLine = lead.estimation
    ? `💶 estimation ${lead.estimation} €`
    : demandeOk
      ? `💶 à partir de ${prixDes(demandeOk)} € (estimation à préciser)`
      : '';

  let lines: string[];
  if (kind === 'partiel') {
    lines = [
      '🟠 Lead PARTIEL à rappeler — Soloris',
      lead.nom ? `👤 ${lead.nom}` : '',
      `📞 ${lead.telephone || '—'}`,
      lead.email ? `✉️ ${lead.email}` : '',
      `📋 ${bienLine}`,
      annexeLine,
      estimLine,
      lieuLine,
      acqLine,
      `🔗 ${lead.landing_path || '/'}`,
      `🕒 ${dateHeure}`,
    ];
  } else if (kind === 'chat' || kind === 'contact') {
    const isChat = kind === 'chat';
    lines = [
      `${isChat ? '💬' : '📨'} Nouveau ${isChat ? 'CHAT' : 'CONTACT'} Soloris`,
      `👤 ${lead.nom || '—'}`,
      `📞 ${lead.telephone || '—'}`,
      lead.email ? `✉️ ${lead.email}` : '',
      lead.message ? `💬 ${lead.message}` : '',
      estimLine,
      `🔗 ${lead.landing_path || '/'}`,
      `🕒 ${dateHeure}`,
    ];
  } else {
    lines = [
      '🟢 Nouveau lead COMPLET — Soloris',
      `📋 ${bienLine}`,
      annexeLine,
      `👤 ${lead.nom || '—'} (${prenom})`,
      `📞 ${lead.telephone || '—'}`,
      lead.email ? `✉️ ${lead.email}` : '',
      lieuLine,
      estimLine,
      lead.message ? `💬 ${lead.message}` : '',
      acqLine,
      `🔗 ${lead.landing_path || '/'}`,
      `🕒 ${dateHeure}`,
    ];
  }
  lines = lines.filter(Boolean);

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 4000);
  const markup = leadId ? { reply_markup: leadKeyboard(leadId) } : {};
  try {
    // Une seule carte par lead : si une carte existe déjà (ex. partiel), on la MET À JOUR
    // (partiel → complet) au lieu d'en reposter une seconde. Repli : nouvelle carte si l'édition échoue.
    if (editMessageId) {
      const edit = await fetch(`https://api.telegram.org/bot${token}/editMessageText`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, message_id: editMessageId, text: lines.join('\n'), disable_web_page_preview: true, ...markup }),
        signal: ctrl.signal,
      });
      if (edit.ok) return editMessageId;
    }
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: lines.join('\n'), disable_web_page_preview: true, ...markup }),
      signal: ctrl.signal,
    });
    const j = await res.json().catch(() => null);
    return j && j.result && typeof j.result.message_id === 'number' ? j.result.message_id : null;
  } catch (e) {
    console.error('[lead] notif Telegram échouée (lead bien enregistré):', e);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export const POST: APIRoute = async ({ request, clientAddress }) => {
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return json({ error: 'Requête invalide.' }, 400); }

  if (clean(body.website)) return json({ ok: true }, 200); // honeypot

  const source = clean(body.source, 60) || 'devis'; // canal : devis | contact | chat
  const leadStatus = clean(body.lead_status, 12) === 'partiel' ? 'partiel' : 'complet';
  const leadUid = clean(body.lead_uid, 60);
  const isContact = source === 'contact';
  const isChat = source === 'chat';
  const isPartial = leadStatus === 'partiel';

  // Rate-limit UNIQUEMENT les upserts partiels (nombreux : 1 par étape + blur).
  // ⚠️ Un lead COMPLET (la conversion) ne doit JAMAIS être rejeté par le rate-limit.
  let ip = 'unknown';
  try { ip = clientAddress || 'unknown'; } catch { /* */ }
  if (isPartial && rateLimited(ip)) return json({ error: 'Trop de demandes, réessayez dans un instant.' }, 429);

  // Validation des listes blanches
  const type_demande = clean(body.type_demande, 20);
  const type_bien = clean(body.type_bien, 20);
  const age_bien = clean(body.age_bien, 20);
  if (type_demande && !DEMANDES.includes(type_demande)) return json({ error: 'Demande invalide.' }, 400);
  if (type_bien && !BIENS.includes(type_bien)) return json({ error: 'Type de bien invalide.' }, 400);
  if (age_bien && !AGES.includes(age_bien)) return json({ error: 'Âge du bien invalide.' }, 400);

  const nom = clean(body.nom, 120);
  const telephone = clean(body.telephone, 40);
  const email = clean(body.email, 160);
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ error: 'Email invalide.' }, 400);
  // Ville auto-déduite du code postal côté client (API geo.api.gouv.fr) — best-effort, jamais requise.
  const ville = clean(body.ville, 120);

  // Exigences selon le contexte (lenientes pour un lead partiel : on capture TOUT,
  // même sans nom — c'est l'intérêt de la capture progressive).
  if (isPartial) {
    if (!leadUid) return json({ error: 'Identifiant de session requis.' }, 400);
  } else if (isContact) {
    if (!nom || !telephone || !email) return json({ error: 'Nom, téléphone et email sont requis.' }, 400);
  } else if (isChat) {
    if (!nom || !telephone) return json({ error: 'Nom et téléphone sont requis.' }, 400);
  } else {
    // devis complet — email requis (envoi du devis + confirmation par email)
    if (!nom || !telephone || !email) return json({ error: 'Le nom, le téléphone et l\'email sont requis.' }, 400);
  }

  const surfaceNum = Number(body.surface);
  const estimationNum = Number(body.estimation);

  // Option annexe (+99 €) : cave/parking (appartement) ou garage/dépendance (maison)
  const ANNEXE_TYPES = ['cave_parking', 'garage_dependance'];
  const annexeOn = body.annexe === '1' || body.annexe === 1 || body.annexe === true;
  const annexeTypeRaw = clean(body.annexe_type, 30);
  const annexeType = annexeOn && annexeTypeRaw && ANNEXE_TYPES.includes(annexeTypeRaw) ? annexeTypeRaw : '';

  // Test A/B « price_model » (landing pages vente A/B) — variante 'A' | 'B' uniquement.
  const priceModelRaw = clean(body.price_model, 1);
  const priceModel = priceModelRaw === 'A' || priceModelRaw === 'B' ? priceModelRaw : '';

  // Payload pour la fonction RPC (la fonction applique nullif/cast)
  const payload: Record<string, string> = {
    lead_uid: leadUid || '',
    lead_status: leadStatus,
    source,
    ab_price_model: priceModel,
    type_demande: type_demande || '',
    type_bien: type_bien || '',
    age_bien: age_bien || '',
    surface: Number.isFinite(surfaceNum) && surfaceNum > 0 ? String(Math.round(surfaceNum)) : '',
    secteur: clean(body.secteur, 120) || '',
    ville: ville || '',
    estimation: Number.isFinite(estimationNum) && estimationNum > 0 ? String(Math.round(estimationNum)) : '',
    annexe: annexeOn ? '1' : '0',
    annexe_type: annexeType,
    nom: nom || '',
    telephone: telephone || '',
    email: email || '',
    message: clean(body.message, 1000) || '',
    // acquisition
    utm_source: clean(body.utm_source, 120) || '',
    medium: clean(body.medium, 120) || '',
    campaign: clean(body.campaign, 160) || '',
    term: clean(body.term, 160) || '',
    content: clean(body.content, 160) || '',
    gclid: clean(body.gclid, 255) || '',
    fbclid: clean(body.fbclid, 255) || '',
    gads_keyword: clean(body.gads_keyword, 160) || '',
    gads_campaign_id: clean(body.gads_campaign_id, 40) || '',
    gads_adgroup_id: clean(body.gads_adgroup_id, 40) || '',
    gads_creative_id: clean(body.gads_creative_id, 40) || '',
    match_type: clean(body.match_type, 20) || '',
    device: clean(body.device, 20) || '',
    network: clean(body.network, 20) || '',
    landing_path: clean(body.landing_path, 255) || '',
    referrer: clean(body.referrer, 255) || '',
    // Lien lead ↔ comportement (uuid posés par le tracker first-party ; ignorés si absents/invalides)
    session_id: uuidOrEmpty(body.session_id),
    visitor_id: uuidOrEmpty(body.visitor_id),
  };

  // 💶 Estimation SERVEUR (repli) : si le client n'a pas transmis d'estimation mais
  // que projet + surface sont connus, on calcule via la grille partagée
  // (src/lib/pricing.ts, même source de vérité que le tunnel /devis ; annexe incluse
  // dans le pack, pas de supplément). Persistée → visible partout (Telegram, admin).
  if (!payload.estimation && type_demande && Number.isFinite(surfaceNum) && surfaceNum > 0) {
    try {
      const { prix } = computePrix({
        projet: type_demande as 'vente' | 'location' | 'dpe' | 'audit',
        typeBien: type_bien,
        surface: surfaceNum,
        age: (age_bien as 'avant1949' | 'intermediaire' | 'recent' | null) || null,
      });
      if (prix != null) payload.estimation = String(prix);
    } catch { /* estimation indisponible : la notif affichera le prix d'entrée */ }
  }

  const url = envVar(P.PUBLIC_SUPABASE_URL, import.meta.env.PUBLIC_SUPABASE_URL);
  const key = envVar(P.PUBLIC_SUPABASE_ANON_KEY, import.meta.env.PUBLIC_SUPABASE_ANON_KEY);
  if (!url || !key) return json({ error: 'Configuration serveur manquante.' }, 500);

  // Upsert via la fonction RPC SECURITY DEFINER
  let result: any;
  try {
    const res = await fetch(`${url}/rest/v1/rpc/upsert_lead`, {
      method: 'POST',
      headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ payload }),
    });
    if (!res.ok) {
      console.error('[lead] RPC upsert_lead', res.status, await res.text());
      return json({ error: "L'enregistrement a échoué." }, 500);
    }
    result = await res.json();
  } catch (e) {
    console.error('[lead] fetch RPC error', e);
    return json({ error: "L'enregistrement a échoué." }, 500);
  }

  // Notifications (selon décision atomique de la fonction) — non bloquantes
  try {
    const lead = (result && result.lead) || {};
    // Repli ville : si la fonction RPC ne renvoie pas encore `ville` (migration non appliquée),
    // on utilise la valeur transmise par le client → la carte Telegram affiche la ville tout de suite.
    if (ville && !lead.ville) lead.ville = ville;
    let messageId: number | null = null;
    if (result && result.notify_complete) {
      // Édite la carte partielle existante (si présente) → une seule carte par lead.
      messageId = await notifyTelegram(lead, isContact ? 'contact' : isChat ? 'chat' : 'complet', result.id, result.telegram_message_id || null);
      // Email de confirmation au client (serveur, non bloquant : un échec ne doit
      // jamais empêcher l'enregistrement du lead ni la réponse). Anti-doublon : la
      // branche notify_complete est atomique (1 seule fois par lead).
      try { await sendLeadConfirmation(lead); }
      catch (e) { console.error('[lead] email de confirmation échoué (lead bien enregistré):', e); }
    } else if (result && result.notify_partial) {
      messageId = await notifyTelegram(lead, 'partiel', result.id, null);
    }
    // Mémorise l'id de la carte Telegram du lead → permet de la réécrire ensuite
    // (passage partiel→complet, confirmation de RDV, statut). Awaité pour fiabiliser
    // la suite (la requête « complet » lira ce message_id pour éditer la carte).
    if (messageId && result && result.id) {
      await fetch(`${url}/rest/v1/rpc/set_lead_tg_message_id`, {
        method: 'POST',
        headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ p_id: result.id, p_message_id: messageId }),
      }).catch(() => {});
    }
  } catch (e) {
    console.error('[lead] notif post-upsert', e);
  }

  // ⚠️ Aucune conversion ici : la conversion Google Ads est déclenchée côté client,
  // uniquement quand le formulaire est validé à 100 %.
  // `id` = identifiant Supabase du lead → exposé au client pour servir de
  // transaction_id (dédup) dans l'event de conversion « lead_submitted » (Tâche 4).
  // On expose au client : id (transaction_id), lead_uid, le statut RÉELLEMENT écrit
  // (le front n'affiche « Merci » que si lead_status='complet'), et — si la RPC le fournit —
  // un indicateur `created` (true = nouvelle ligne, false = mise à jour d'une ligne existante).
  const writtenStatus = (result && result.lead && result.lead.lead_status) || leadStatus;
  const created = result && typeof result.created === 'boolean' ? result.created : null;
  return json({ ok: true, id: result?.id ?? null, lead_uid: result?.lead_uid || leadUid || null, lead_status: writtenStatus, created }, 201);
};

export const GET: APIRoute = () => json({ error: 'Méthode non autorisée.' }, 405);
