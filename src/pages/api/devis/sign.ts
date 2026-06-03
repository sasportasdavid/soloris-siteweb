/**
 * POST /api/devis/sign — signature « bon pour accord » (ou refus) d'un devis par
 * son token. Enregistre nom + horodatage + IP via la fonction SECURITY DEFINER
 * sign_devis (anti-rejeu). Notifie l'équipe sur Telegram. Aucune donnée marketing.
 */
import type { APIRoute } from 'astro';
import { SUPABASE_URL, SUPABASE_ANON, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID } from '../../../lib/serverEnv';

export const prerender = false;

const isUuid = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

async function notify(message: string): Promise<void> {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) return;
  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text: message, disable_web_page_preview: true }),
    });
  } catch { /* notif non bloquante */ }
}

export const POST: APIRoute = async ({ request, clientAddress }) => {
  let body: any;
  try { body = await request.json(); } catch { return json({ error: 'Requête invalide.' }, 400); }

  const token = String(body.token || '').trim();
  const nom = String(body.nom || '').trim().slice(0, 120);
  const refuse = body.action === 'refuse';
  if (!isUuid(token)) return json({ error: 'Lien invalide.' }, 400);
  if (!refuse && nom.length < 2) return json({ error: 'Veuillez indiquer votre nom complet.' }, 400);

  let ip = 'inconnue';
  try { ip = clientAddress || 'inconnue'; } catch { /* */ }

  const fn = refuse ? 'refuse_devis' : 'sign_devis';
  const payload = refuse ? { p_token: token, p_ip: ip } : { p_token: token, p_nom: nom, p_ip: ip };

  let r: any;
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
      method: 'POST',
      headers: { apikey: SUPABASE_ANON as string, Authorization: `Bearer ${SUPABASE_ANON}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) return json({ error: 'Une erreur est survenue.' }, 500);
    r = await res.json();
  } catch {
    return json({ error: 'Une erreur est survenue.' }, 500);
  }

  if (!r || r.ok === false) {
    const msg = r && r.error === 'refuse' ? 'Ce devis a déjà été refusé.' : 'Devis introuvable ou déjà traité.';
    return json({ error: msg }, 400);
  }

  if (refuse) {
    notify(`🔴 Devis REFUSÉ — Soloris\nN° ${r.numero || '?'}`);
  } else if (!r.already) {
    notify(`✍️ Devis SIGNÉ — Soloris\nN° ${r.numero}\n👤 ${r.client_nom || nom}\n💶 ${r.montant || '?'} €\n📋 ${r.objet || ''}`);
  }

  return json({ ok: true, already: !!r.already, refused: refuse, numero: r.numero, montant: r.montant });
};
