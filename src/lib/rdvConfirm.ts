/**
 * Cœur partagé de confirmation de RDV — appelé À L'IDENTIQUE par le back-office
 * (JWT admin) et le lien public signé (token HMAC). Côté serveur uniquement.
 *
 * Séquence : a) rdv_save (RPC) → b) email Resend + .ics (non bloquant) →
 *            c) rdv_mark_sent → d) réécriture de la carte Telegram du lead.
 * L'échec d'email ne bloque jamais l'enregistrement (les données sont déjà écrites).
 */
import {
  SUPABASE_URL, SUPABASE_ANON, RESEND_API_KEY, CONFIRM_FROM_EMAIL,
  TELEGRAM_BOT_TOKEN, TELEGRAM_LEADS_CHAT_ID,
} from './serverEnv';
import { SITE } from './site';
import { buildRdvConfirmation, formatDateFr, formatHeureFr } from './rdvEmail';
import { buildIcs } from './ics';

export interface RdvFields {
  rdv_at: string; rdv_adresse?: string; prestation?: string; diagnostiqueur?: string;
  prix_total_ttc?: number; duree_estimee?: string; consignes?: string;
}

async function rpc(fn: string, body: unknown): Promise<any> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: { apikey: SUPABASE_ANON as string, Authorization: `Bearer ${SUPABASE_ANON}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) { console.error(`[rdv] RPC ${fn}`, res.status, await res.text().catch(() => '')); return null; }
  return res.json();
}

/** Réécrit (ou poste en repli) la carte Telegram du lead avec le RDV confirmé. */
async function rewriteTelegramCard(lead: any): Promise<void> {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_LEADS_CHAT_ID) return;
  const d = new Date(lead.rdv_at);
  const prenom = (lead.nom || '').trim().split(/\s+/)[0] || '—';
  const prix = lead.prix_total_ttc != null ? `${lead.prix_total_ttc}€` : '';
  const text = `✅ RDV pris · ${formatDateFr(d)} ${formatHeureFr(d)} · ${lead.prestation || ''}${prix ? ' · ' + prix : ''} — par ${lead.traite_par || '—'}\n👤 ${prenom}${lead.telephone ? ' · 📞 ' + lead.telephone : ''}`;
  try {
    if (lead.telegram_message_id) {
      const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/editMessageText`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: TELEGRAM_LEADS_CHAT_ID, message_id: lead.telegram_message_id, text, reply_markup: { inline_keyboard: [] } }),
      });
      if (res.ok) return; // sinon repli sendMessage
    }
    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: TELEGRAM_LEADS_CHAT_ID, text, disable_web_page_preview: true }),
    });
  } catch (e) { console.error('[rdv] réécriture carte Telegram échouée (RDV enregistré):', e); }
}

export interface RunRdvResult {
  ok: boolean; needsConfirm?: boolean; error?: string;
  emailSent?: boolean; emailError?: string; reason?: string; to?: string; confirmation_rdv_envoyee_at?: string | null;
}

/** Confirme un RDV : enregistre, email + .ics, stamp, réécrit la carte Telegram. */
export async function runRdvConfirm(opts: { leadId: string; fields: RdvFields; traitePar: string; resend?: boolean }): Promise<RunRdvResult> {
  if (!SUPABASE_URL || !SUPABASE_ANON) return { ok: false, error: 'config' };

  // a) Enregistrement (idempotent)
  const saved = await rpc('rdv_save', {
    payload: { lead_id: opts.leadId, ...opts.fields, traite_par: opts.traitePar, resend: !!opts.resend },
  });
  if (!saved) return { ok: false, error: 'save_failed' };
  if (saved.needsConfirm) return { ok: false, needsConfirm: true };
  if (!saved.ok) return { ok: false, error: saved.error || 'save_failed' };
  const lead = saved.lead;

  // b) Email (non bloquant)
  let emailSent = false; let emailError: string | undefined; let reason: string | undefined;
  if (!lead.email) reason = 'no_email';
  else if (!RESEND_API_KEY) reason = 'resend_not_configured';
  else {
    try {
      const { subject, html, text } = buildRdvConfirmation(lead);
      const ics = buildIcs({ summary: `Diagnostic Soloris — ${lead.prestation || 'rendez-vous'}`, start: new Date(lead.rdv_at), durationMin: 60, location: lead.rdv_adresse || '' });
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST', headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: CONFIRM_FROM_EMAIL, to: [lead.email], reply_to: SITE.email, subject, html, text,
          attachments: [{ filename: 'rendez-vous-soloris.ics', content: Buffer.from(ics).toString('base64'), content_type: 'text/calendar; charset=utf-8; method=PUBLISH' }],
        }),
      });
      emailSent = res.ok;
      if (!res.ok) emailError = (await res.text().catch(() => '')).slice(0, 300);
    } catch (e: any) { emailError = String(e?.message || e).slice(0, 300); console.error('[rdv] email échoué (RDV enregistré):', e); }
  }

  // c) Stamp idempotence (si email parti)
  let stampedAt: string | null = null;
  if (emailSent) { stampedAt = new Date().toISOString(); await rpc('rdv_mark_sent', { p_id: opts.leadId }); }

  // d) Réécriture de la carte Telegram (toujours, le RDV est pris)
  await rewriteTelegramCard(lead);

  return { ok: true, emailSent, emailError, reason, to: lead.email || undefined, confirmation_rdv_envoyee_at: stampedAt };
}
