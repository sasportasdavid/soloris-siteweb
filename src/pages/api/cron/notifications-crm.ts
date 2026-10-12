/**
 * Cron quotidien — notifications CRM vers Telegram (canal Leads).
 *   #8 Rappels actifs    : leads « à recontacter » dont la date est échue (<= aujourd'hui).
 *   #7 Relances devis    : devis « envoyé » non signé depuis > N jours.
 * Lecture via la clé service Supabase (RLS contournée côté serveur). Auth : CRON_SECRET.
 * Un seul cron pour les deux (limite de crons Vercel).
 */
import type { APIRoute } from 'astro';
import { SUPABASE_URL, SUPABASE_SERVICE_ROLE } from '../../../lib/serverEnv';
import { sendTelegramMessage } from '../../../lib/telegramPush';

export const prerender = false;

const P = typeof process !== 'undefined' && process.env ? process.env : ({} as Record<string, string | undefined>);
const CRON_SECRET = P.CRON_SECRET;
const RELANCE_JOURS = 3; // devis envoyé non signé depuis > 3 jours

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

async function readRest(path: string): Promise<any[] | null> {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: SUPABASE_SERVICE_ROLE as string, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE}` },
  });
  if (!r.ok) { console.error('[cron-crm] lecture', path, r.status, (await r.text().catch(() => '')).slice(0, 200)); return null; }
  return r.json();
}

export const GET: APIRoute = async ({ request }) => {
  if (!CRON_SECRET || request.headers.get('authorization') !== `Bearer ${CRON_SECRET}`) return json({ error: 'unauthorized' }, 401);
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) return json({ error: 'service role non configuré' }, 500);

  const out: any = { ok: true };

  // ── #8 Rappels échus ──
  const today = new Date().toISOString().slice(0, 10);
  const rappels = await readRest(
    `leads?statut=eq.a_recontacter&recontacter_le=not.is.null&recontacter_le=lte.${today}` +
    `&select=nom,telephone,recontacter_le,type_demande,secteur&order=recontacter_le.asc`,
  );
  out.rappels = rappels ? rappels.length : 'erreur';
  if (rappels && rappels.length) {
    const l = rappels.slice(0, 30).map((x) =>
      `• ${x.nom || '(sans nom)'}${x.telephone ? ' — ' + x.telephone : ''} · ${x.type_demande || ''}${x.secteur ? ' (' + x.secteur + ')' : ''} · prévu le ${x.recontacter_le}`,
    ).join('\n');
    out.rappels_tg = await sendTelegramMessage(`🔁 Rappels à faire (${rappels.length})\n\n${l}${rappels.length > 30 ? `\n… +${rappels.length - 30} autres` : ''}`);
  }

  // ── #7 Relances devis ──
  const cutoff = new Date(Date.now() - RELANCE_JOURS * 86400000).toISOString();
  const devis = await readRest(
    `devis?statut=eq.envoye&signed_at=is.null&sent_at=not.is.null&sent_at=lte.${cutoff}` +
    `&select=numero,montant,sent_at,client_nom,client_tel&order=sent_at.asc`,
  );
  out.relances = devis ? devis.length : 'erreur';
  if (devis && devis.length) {
    const l = devis.slice(0, 30).map((d) =>
      `• ${d.client_nom || '(client)'}${d.client_tel ? ' — ' + d.client_tel : ''} · devis ${d.numero || ''}${d.montant ? ' · ' + d.montant + ' €' : ''} · envoyé le ${String(d.sent_at).slice(0, 10)}`,
    ).join('\n');
    out.relances_tg = await sendTelegramMessage(`📄 Devis en attente de signature depuis > ${RELANCE_JOURS} j (${devis.length})\n\n${l}${devis.length > 30 ? `\n… +${devis.length - 30} autres` : ''}`);
  }

  return json(out);
};
