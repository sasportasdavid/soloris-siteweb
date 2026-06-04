/**
 * Email de confirmation envoyé au LEAD après soumission complète (Resend).
 * - Côté serveur uniquement (la clé Resend ne fuit jamais côté client).
 * - NON bloquant : l'appelant l'enveloppe dans un try/catch ; un échec d'envoi
 *   ne doit jamais empêcher l'enregistrement du lead ni la réponse à l'utilisateur.
 * - ⚠️ CONFORMITÉ : l'email confirme un RAPPEL, jamais un résultat de DPE.
 *   Aucune allégation non vérifiable. La copie ci-dessous est figée (verbatim).
 */
import { RESEND_API_KEY, CONFIRM_FROM_EMAIL, SITE_URL } from './serverEnv';
import { SITE } from './site';

const BIEN_LBL: Record<string, string> = {
  appartement: 'Appartement', maison: 'Maison', cave: 'Cave', parking: 'Parking', box: 'Box',
};

function esc(s: any): string {
  return String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));
}

/** Envoie l'email de confirmation. Ne fait rien si Resend n'est pas configuré ou si le lead n'a pas d'email. */
export async function sendLeadConfirmation(lead: Record<string, any>): Promise<void> {
  if (!RESEND_API_KEY || !lead || !lead.email) return;

  const prenom = (lead.nom || '').trim().split(/\s+/)[0] || '';
  const greeting = prenom ? `Bonjour ${prenom}, merci pour votre demande.` : 'Bonjour, merci pour votre demande.';

  const bien = lead.type_bien ? BIEN_LBL[lead.type_bien] || lead.type_bien : '';
  const adresse = lead.secteur ? `code postal ${lead.secteur}` : '';
  const contact = [lead.telephone, lead.email].filter(Boolean).join(' · ');
  const recap = [bien, adresse, contact].filter(Boolean).join(' · ') || '—';

  const logoUrl = `${SITE_URL}/soloris-logo-google.png`;

  // ── Version texte ──
  const text = `${greeting}

Un diagnostiqueur certifié vous rappelle très rapidement pour convenir d'un rendez-vous et finaliser votre devis tout compris.

Voici ce que nous avons reçu : ${recap}.

Pas de mauvaise surprise : tarif tout compris, rapport clair et opposable, en général sous 48 h après le passage. À très vite.

L'équipe Soloris — Le diagnostic, en toute clarté.
soloris.fr · Paris & Île-de-France · Une marque du groupe ISDIAG
Cet email est automatique, merci de ne pas y répondre directement.`;

  // ── Version HTML (web-safe Arial/Helvetica, couleurs de la charte) ──
  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#FBFAF6;font-family:Arial,Helvetica,sans-serif;color:#0B1F33">
  <span style="display:none!important;opacity:0;color:#FBFAF6;font-size:1px;line-height:1px;max-height:0;max-width:0;overflow:hidden">Un diagnostiqueur certifié vous rappelle pour caler votre rendez-vous.</span>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FBFAF6"><tr><td align="center" style="padding:28px 12px">
    <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#fff;border:1px solid #E7ECF1;border-radius:16px;overflow:hidden">
      <tr><td style="background:#0B2A4A;padding:22px 28px">
        <table role="presentation" cellpadding="0" cellspacing="0"><tr>
          <td style="padding-right:12px;vertical-align:middle"><img src="${logoUrl}" width="40" height="40" alt="Soloris" style="display:block;border-radius:9px"></td>
          <td style="vertical-align:middle">
            <div style="font-size:22px;font-weight:bold;color:#fff;letter-spacing:.2px;line-height:1">soloris</div>
            <div style="font-size:12px;color:#C3D2E2;margin-top:3px">Le diagnostic, en toute clarté.</div>
          </td>
        </tr></table>
      </td></tr>
      <tr><td style="padding:28px 28px 8px">
        <h1 style="margin:0 0 16px;font-size:21px;color:#0B2A4A">Votre demande est bien reçue.</h1>
        <p style="margin:0 0 14px;font-size:15px;line-height:1.6">${esc(greeting)}</p>
        <p style="margin:0 0 16px;font-size:15px;line-height:1.6">Un diagnostiqueur certifié vous rappelle très rapidement pour convenir d'un rendez-vous et finaliser votre devis tout compris.</p>
        <p style="margin:0 0 8px;font-size:14px;color:#5B6B7C">Voici ce que nous avons reçu :</p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 18px"><tr>
          <td style="background:#FBFAF6;border-left:3px solid #F5A623;border-radius:8px;padding:12px 16px;font-size:14px;color:#0B1F33">${esc(recap)}</td>
        </tr></table>
        <p style="margin:0 0 20px;font-size:15px;line-height:1.6">Pas de mauvaise surprise : tarif tout compris, rapport clair et opposable, en général sous 48 h après le passage. À très vite.</p>
        <p style="margin:0 0 4px;font-size:15px;color:#0B2A4A"><strong>L'équipe Soloris</strong> — <span style="color:#5B6B7C">Le diagnostic, en toute clarté.</span></p>
      </td></tr>
      <tr><td style="padding:18px 28px 24px">
        <table role="presentation" width="100%"><tr><td style="border-top:1px solid #E7ECF1;padding-top:16px">
          <p style="margin:0 0 6px;font-size:12px;color:#5B6B7C;line-height:1.6">soloris.fr · Paris &amp; Île-de-France · <span style="color:#2E6FAE;font-weight:bold">Une marque du groupe ISDIAG</span></p>
          <p style="margin:0;font-size:12px;color:#8a93a0;line-height:1.6">Cet email est automatique, merci de ne pas y répondre directement.</p>
        </td></tr></table>
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`;

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: CONFIRM_FROM_EMAIL,
      to: [lead.email],
      reply_to: SITE.email,
      subject: 'Votre demande est bien reçue — on vous rappelle',
      html,
      text,
    }),
  });
}
