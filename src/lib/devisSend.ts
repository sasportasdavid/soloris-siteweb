/**
 * Envoi d'un devis au client par email (Resend) : PDF en pièce jointe + lien de signature
 * « bon pour accord ». Partagé par /api/devis/send (back-office) et le webhook Telegram.
 * Ne touche pas à la base : l'appelant marque le devis « envoyé » avec ses propres droits.
 */
import { RESEND_API_KEY, DEVIS_FROM_EMAIL, SITE_URL } from './serverEnv';
import { generateDevisPdf } from './devisPdf';
import { SITE } from './site';

function esc(s: any): string {
  return String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));
}

export const devisSignUrl = (d: any) => `${SITE_URL}/devis/signer/${d.sign_token}`;
export const devisPdfUrl = (d: any) => `${SITE_URL}/api/devis/${d.sign_token}.pdf`;

function emailHtml(d: any, signUrl: string): string {
  const lignes = (d.lignes || []).map((l: any) =>
    `<tr><td style="padding:6px 0;color:#2a2f36">${esc(l.libelle)}</td><td style="padding:6px 0;text-align:right;white-space:nowrap;color:#2a2f36">${esc(l.montant)} €</td></tr>`
  ).join('');
  return `<!doctype html><html><body style="margin:0;background:#f4f6f8;font-family:Arial,Helvetica,sans-serif;color:#2a2f36">
  <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:28px 12px">
    <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border-radius:14px;overflow:hidden;border:1px solid #e6e9ee">
      <tr><td style="background:#0B2A4A;padding:22px 28px;color:#fff">
        <div style="font-size:22px;font-weight:bold;letter-spacing:.3px">Soloris</div>
        <div style="font-size:12px;color:#C3D2E2;margin-top:2px">Le diagnostic, en toute clarté.</div>
      </td></tr>
      <tr><td style="padding:26px 28px">
        <p style="margin:0 0 14px;font-size:15px">Bonjour ${esc(d.client_nom || '')},</p>
        <p style="margin:0 0 18px;font-size:14px;line-height:1.6">Voici votre devis <strong>${esc(d.numero)}</strong> pour votre demande de diagnostics. Vous le trouverez en pièce jointe (PDF) et pouvez le valider en ligne en un clic.</p>
        <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e6e9ee;border-radius:10px;padding:6px 14px;margin-bottom:18px">
          <tr><td style="padding:10px 0 4px;font-size:12px;color:#7a828c;text-transform:uppercase;letter-spacing:.06em">${esc(d.objet || 'Prestation de diagnostics')}</td></tr>
          ${lignes}
          <tr><td style="border-top:1px solid #e6e9ee;padding:10px 0 12px;font-weight:bold;color:#0B2A4A">Total TTC</td><td style="border-top:1px solid #e6e9ee;padding:10px 0 12px;text-align:right;font-weight:bold;color:#0B2A4A">${esc(d.montant)} €</td></tr>
        </table>
        <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:6px 0 18px">
          <a href="${esc(signUrl)}" style="display:inline-block;background:#F5A623;color:#0B2A4A;font-weight:bold;font-size:15px;text-decoration:none;padding:13px 26px;border-radius:10px">Voir et signer mon devis</a>
        </td></tr></table>
        <p style="margin:0 0 6px;font-size:12.5px;color:#7a828c;line-height:1.6">Devis valable ${esc(d.validite_jours || 30)} jours. Tarifs TTC, déplacement inclus. Rapport transmis sous 24 h après la visite, dès réception du règlement.</p>
        <p style="margin:0;font-size:12.5px;color:#7a828c;line-height:1.6">Une question ? Répondez à cet email ou appelez-nous au ${esc(SITE.phoneDisplay)}.</p>
      </td></tr>
      <tr><td style="background:#f4f6f8;padding:16px 28px;font-size:11px;color:#9aa1aa;line-height:1.5">
        ${esc(SITE.legalName)} (${esc(SITE.legalForm)}) — marque ${esc(SITE.tradeName)} · SIRET ${esc(SITE.siret)} · ${esc(SITE.email)}
      </td></tr>
    </table>
  </td></tr></table></body></html>`;
}

export type SendResult = { ok: true; to: string } | { ok: false; status: number; error: string; detail?: string };

/** Génère le PDF et envoie l'email au client du devis `d` (ligne complète de la table devis). */
export async function sendDevisEmail(d: any): Promise<SendResult> {
  if (!RESEND_API_KEY) return { ok: false, status: 503, error: 'Envoi email non configuré : ajoutez la variable RESEND_API_KEY dans Vercel.' };
  if (!d.client_email) return { ok: false, status: 400, error: "Ce lead n'a pas d'adresse email." };

  const signUrl = devisSignUrl(d);
  let b64: string;
  try {
    const pdf = await generateDevisPdf(d, { signUrl: d.statut === 'signe' ? undefined : signUrl });
    b64 = Buffer.from(pdf).toString('base64');
  } catch {
    return { ok: false, status: 500, error: 'Génération du PDF impossible.' };
  }

  const emailRes = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: DEVIS_FROM_EMAIL,
      to: [d.client_email],
      subject: `Votre devis Soloris ${d.numero}`,
      html: emailHtml(d, signUrl),
      attachments: [{ filename: `devis-${d.numero}.pdf`, content: b64 }],
    }),
  });
  if (!emailRes.ok) {
    const detail = await emailRes.text().catch(() => '');
    return { ok: false, status: 502, error: "L'envoi de l'email a échoué.", detail: detail.slice(0, 300) };
  }
  return { ok: true, to: d.client_email };
}

/** Champs à écrire après un envoi réussi (sans rétrograder un devis déjà signé). */
export function sentPatch(d: any, nowIso: string = new Date().toISOString()) {
  return { statut: d.statut === 'signe' ? 'signe' : 'envoye', sent_at: nowIso, updated_at: nowIso };
}
