/**
 * POST /api/rdv/confirm — confirme un rendez-vous et envoie l'email de confirmation.
 * Réservé à un admin authentifié (JWT Supabase vérifié). Remplace, dans le flux
 * commercial, le « devis à signer » par une confirmation de RDV (plus rapide).
 *
 * Séquence (impérative) :
 *   a) enregistre les champs RDV + statut='rdv_pris' (D'ABORD — jamais bloqué par l'email)
 *   b) PUIS envoie l'email de confirmation (Resend) + invitation .ics (try/catch)
 *   c) stampe confirmation_rdv_envoyee_at (uniquement si l'email est parti)
 *   d) notifie le canal Telegram « Soloris Leads »
 * Idempotence : si déjà confirmé et resend!==true → { needsConfirm:true } (le CRM redemande).
 *
 * Body : { lead_id, rdv_at, rdv_adresse, prestation, diagnostiqueur, prix_total_ttc,
 *          duree_estimee?, consignes?, resend? }. Header : Authorization: Bearer <jwt admin>.
 */
import type { APIRoute } from 'astro';
import {
  SUPABASE_URL, SUPABASE_ANON, RESEND_API_KEY, CONFIRM_FROM_EMAIL,
  TELEGRAM_BOT_TOKEN, TELEGRAM_LEADS_CHAT_ID,
} from '../../../lib/serverEnv';
import { SITE } from '../../../lib/site';
import { buildRdvConfirmation, formatDateFr, formatHeureFr } from '../../../lib/rdvEmail';
import { buildIcs } from '../../../lib/ics';

export const prerender = false;

const isUuid = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}
function clean(v: unknown, max = 500): string | null {
  if (typeof v !== 'string') return null;
  const s = v.trim().slice(0, max);
  return s.length ? s : null;
}

async function verifyAdmin(jwt: string): Promise<boolean> {
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: SUPABASE_ANON as string, Authorization: `Bearer ${jwt}` },
    });
    return res.ok;
  } catch { return false; }
}

/** Notification Telegram (non bloquante) vers le canal « Soloris Leads ». */
async function notifyTelegramRdv(lead: Record<string, any>): Promise<void> {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_LEADS_CHAT_ID) return;
  const d = new Date(lead.rdv_at);
  const prenom = (lead.nom || '').trim().split(/\s+/)[0] || '—';
  const prix = lead.prix_total_ttc != null ? `${lead.prix_total_ttc}€` : '';
  const line = `✅ RDV confirmé — ${prenom} · ${formatDateFr(d)} ${formatHeureFr(d)} · ${lead.prestation || ''}${prix ? ' · ' + prix : ''}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 4000);
  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: TELEGRAM_LEADS_CHAT_ID, text: line, disable_web_page_preview: true }),
      signal: ctrl.signal,
    });
  } catch (e) {
    console.error('[rdv] notif Telegram échouée (RDV bien enregistré):', e);
  } finally { clearTimeout(timer); }
}

export const POST: APIRoute = async ({ request }) => {
  if (!SUPABASE_URL || !SUPABASE_ANON) return json({ error: 'Configuration serveur manquante.' }, 500);

  const jwt = (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!jwt) return json({ error: 'Non autorisé.' }, 401);
  if (!(await verifyAdmin(jwt))) return json({ error: 'Session expirée, reconnectez-vous.' }, 401);

  let body: any;
  try { body = await request.json(); } catch { return json({ error: 'Requête invalide.' }, 400); }

  const leadId = String(body.lead_id || '').trim();
  if (!isUuid(leadId)) return json({ error: 'Identifiant de lead invalide.' }, 400);

  const rdvAt = clean(body.rdv_at, 40);
  if (!rdvAt || Number.isNaN(Date.parse(rdvAt))) return json({ error: 'Date et heure du rendez-vous requises.' }, 400);

  const prixNum = Number(body.prix_total_ttc);
  const fields: Record<string, any> = {
    rdv_at: new Date(rdvAt).toISOString(),
    rdv_adresse: clean(body.rdv_adresse, 300),
    prestation: clean(body.prestation, 300),
    diagnostiqueur: clean(body.diagnostiqueur, 160),
    prix_total_ttc: Number.isFinite(prixNum) && prixNum >= 0 ? prixNum : null,
    duree_estimee: clean(body.duree_estimee, 80),
    consignes: clean(body.consignes, 1000),
  };

  const headers = { apikey: SUPABASE_ANON, Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json' };

  // Lecture du lead (nom/email/téléphone + état de confirmation)
  const gRes = await fetch(`${SUPABASE_URL}/rest/v1/leads?id=eq.${leadId}&select=*`, { headers });
  if (!gRes.ok) return json({ error: 'Lecture du lead impossible.' }, 500);
  const lead = (await gRes.json())?.[0];
  if (!lead) return json({ error: 'Lead introuvable.' }, 404);

  // Idempotence : déjà confirmé et pas de renvoi explicite → on redemande
  if (lead.confirmation_rdv_envoyee_at && body.resend !== true) {
    return json({ needsConfirm: true, confirmation_rdv_envoyee_at: lead.confirmation_rdv_envoyee_at });
  }

  // a) ENREGISTREMENT D'ABORD (jamais bloqué par l'email)
  const patchRes = await fetch(`${SUPABASE_URL}/rest/v1/leads?id=eq.${leadId}`, {
    method: 'PATCH',
    headers: { ...headers, Prefer: 'return=minimal' },
    body: JSON.stringify({ ...fields, statut: 'rdv_pris', updated_at: new Date().toISOString() }),
  });
  if (!patchRes.ok) {
    return json({ error: "L'enregistrement du rendez-vous a échoué." }, 500);
  }

  const merged = { ...lead, ...fields };

  // b) EMAIL (non bloquant). Si pas d'email lead, on s'arrête là (données déjà sauvées).
  if (!merged.email) {
    return json({ ok: true, saved: true, emailSent: false, reason: 'no_email' });
  }
  if (!RESEND_API_KEY) {
    return json({ ok: true, saved: true, emailSent: false, reason: 'resend_not_configured' });
  }

  let emailSent = false;
  let emailError: string | undefined;
  try {
    const { subject, html, text } = buildRdvConfirmation(merged);
    const ics = buildIcs({
      summary: `Diagnostic Soloris — ${merged.prestation || 'rendez-vous'}`,
      start: new Date(merged.rdv_at),
      durationMin: 60,
      location: merged.rdv_adresse || '',
    });
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: CONFIRM_FROM_EMAIL,
        to: [merged.email],
        reply_to: SITE.email,
        subject,
        html,
        text,
        attachments: [{
          filename: 'rendez-vous-soloris.ics',
          content: Buffer.from(ics).toString('base64'),
          content_type: 'text/calendar; charset=utf-8; method=PUBLISH',
        }],
      }),
    });
    emailSent = res.ok;
    if (!res.ok) emailError = (await res.text().catch(() => '')).slice(0, 300);
  } catch (e: any) {
    emailError = String(e?.message || e).slice(0, 300);
    console.error('[rdv] envoi email échoué (RDV bien enregistré):', e);
  }

  // c) STAMP idempotence — uniquement si l'email est parti
  let stampedAt: string | null = null;
  if (emailSent) {
    stampedAt = new Date().toISOString();
    await fetch(`${SUPABASE_URL}/rest/v1/leads?id=eq.${leadId}`, {
      method: 'PATCH',
      headers: { ...headers, Prefer: 'return=minimal' },
      body: JSON.stringify({ confirmation_rdv_envoyee_at: stampedAt }),
    }).catch(() => {});
  }

  // d) Telegram (non bloquant)
  try { await notifyTelegramRdv(merged); } catch (e) { console.error('[rdv] telegram', e); }

  return json({ ok: true, saved: true, emailSent, emailError, to: merged.email, confirmation_rdv_envoyee_at: stampedAt });
};

export const GET: APIRoute = () => json({ error: 'Méthode non autorisée.' }, 405);
