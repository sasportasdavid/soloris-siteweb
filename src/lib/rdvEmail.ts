/**
 * Email de CONFIRMATION DE RENDEZ-VOUS (Resend) — envoyé par le commercial une fois
 * l'heure validée au téléphone. Réutilise EXACTEMENT la charte de l'email de lead
 * (confirmEmail.ts) : header bleu profond, wordmark soloris, accent or sur le filet
 * du titre uniquement, footer « Une marque du groupe ISDIAG ». AUCUN emoji (premium).
 *
 * ⚠️ CONFORMITÉ : email 100 % logistique. Aucune promesse ni suggestion de résultat de DPE.
 * Le prix affiché est celui réellement convenu (champ éditable).
 */
import { SITE } from './site';
import { SITE_URL } from './serverEnv';

// ── [TODO juridique] Mention rétractation / annulation. Laisser vide tant que le
// texte n'est pas validé : on N'ENVOIE PAS de placeholder à un client. Renseigner
// une phrase (ex. conditions d'annulation) pour l'afficher dans le pied de page.
const ANNULATION_NOTICE = '';

function esc(s: any): string {
  return String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));
}

/** « mardi 10 juin 2026 » (Europe/Paris). */
export function formatDateFr(d: Date): string {
  return new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Paris',
  }).format(d);
}
/** « 14 h 30 » (Europe/Paris). */
export function formatHeureFr(d: Date): string {
  return new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' })
    .format(d).replace(':', ' h ');
}
function formatPrix(v: any): string {
  const n = Number(v);
  if (!Number.isFinite(n)) return '';
  return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(n);
}

export interface RdvEmailParts { subject: string; preheader: string; html: string; text: string; }

/** Construit l'email de confirmation de RDV à partir d'un lead enrichi. */
export function buildRdvConfirmation(lead: Record<string, any>): RdvEmailParts {
  const d = new Date(lead.rdv_at);
  const dateStr = formatDateFr(d);
  const heureStr = formatHeureFr(d);
  const prenom = (lead.nom || '').trim().split(/\s+/)[0] || '';
  const adresse = lead.rdv_adresse || '';
  const prestation = lead.prestation || '';
  const diagnostiqueur = lead.diagnostiqueur || '';
  const prix = formatPrix(lead.prix_total_ttc);
  const duree = (lead.duree_estimee || '').trim();
  const consignes = (lead.consignes || '').trim();
  const tel = SITE.phoneDisplay;

  const subject = `Votre rendez-vous est confirmé — ${dateStr} à ${heureStr}`;
  const preheader = `${dateStr} à ${heureStr} · ${adresse} · on s'occupe de tout.`;

  // Phrase « durée » masquée si vide ; suffixe « — consignes » masqué si vide.
  const phraseDuree = duree ? `Le rendez-vous dure en général ${duree}. ` : '';
  const suffixeConsignes = consignes ? ` — ${consignes}` : '';

  // ── Version texte ──
  const text = `Votre rendez-vous est confirmé.

Bonjour ${prenom},
Comme convenu par téléphone, votre rendez-vous est confirmé. Voici le récapitulatif :

Date : ${dateStr} à ${heureStr}
Adresse : ${adresse}
Prestation : ${prestation}
Diagnostiqueur : ${diagnostiqueur}, certifié COFRAC
Tarif tout compris : ${prix} € TTC · déplacement inclus

${phraseDuree}Merci de prévoir un accès au logement (clés, badge) le jour J${suffixeConsignes}.

Un imprévu, un changement d'horaire ? Appelez-nous au ${tel}, on s'adapte.

Votre rapport vous sera remis, clair et opposable, en général sous 48 h après notre passage.

L'équipe Soloris — Le diagnostic, en toute clarté.
soloris.fr · Paris & Île-de-France · Une marque du groupe ISDIAG${ANNULATION_NOTICE ? '\n' + ANNULATION_NOTICE : ''}
Email automatique — pour toute question, appelez le ${tel}.`;

  const logoUrl = `${SITE_URL}/soloris-logo-google.png`;

  // Ligne du bloc récap : libellé en bleu (#2E6FAE), valeur en encre (#0B1F33).
  const row = (label: string, value: string) =>
    `<tr>
      <td style="padding:9px 0;font-size:13px;color:#2E6FAE;width:140px;vertical-align:top">${esc(label)}</td>
      <td style="padding:9px 0;font-size:14px;color:#0B1F33;vertical-align:top">${value}</td>
    </tr>`;

  const annulationFooter = ANNULATION_NOTICE
    ? `<p style="margin:0 0 6px;font-size:12px;color:#8a93a0;line-height:1.6">${esc(ANNULATION_NOTICE)}</p>` : '';

  // ── Version HTML (charte identique à confirmEmail.ts) ──
  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#FBFAF6;font-family:Arial,Helvetica,sans-serif;color:#0B1F33">
  <span style="display:none!important;opacity:0;color:#FBFAF6;font-size:1px;line-height:1px;max-height:0;max-width:0;overflow:hidden">${esc(preheader)}</span>
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
        <h1 style="margin:0 0 10px;font-size:21px;color:#0B2A4A">Votre rendez-vous est confirmé.</h1>
        <div style="width:46px;height:3px;background:#F5A623;border-radius:3px;margin:0 0 18px"></div>
        <p style="margin:0 0 14px;font-size:15px;line-height:1.6">Bonjour ${esc(prenom)},</p>
        <p style="margin:0 0 16px;font-size:15px;line-height:1.6">Comme convenu par téléphone, votre rendez-vous est confirmé. Voici le récapitulatif :</p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 18px;border:1px solid #E7ECF1;border-left:3px solid #F5A623;border-radius:10px">
          <tr><td style="padding:6px 16px">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              ${row('Date', `${esc(dateStr)} à ${esc(heureStr)}`)}
              ${row('Adresse', esc(adresse))}
              ${row('Prestation', esc(prestation))}
              ${row('Diagnostiqueur', `${esc(diagnostiqueur)}, certifié COFRAC`)}
              ${row('Tarif tout compris', `<strong>${esc(prix)} € TTC</strong> · déplacement inclus`)}
            </table>
          </td></tr>
        </table>
        <p style="margin:0 0 14px;font-size:15px;line-height:1.6">${phraseDuree ? esc(phraseDuree.trim()) + ' ' : ''}Merci de prévoir un accès au logement (clés, badge) le jour J${esc(suffixeConsignes)}.</p>
        <p style="margin:0 0 14px;font-size:15px;line-height:1.6">Un imprévu, un changement d'horaire ? Appelez-nous au <a href="tel:${esc(SITE.phone.replace(/\s/g, ''))}" style="color:#2E6FAE;text-decoration:none;font-weight:bold">${esc(tel)}</a>, on s'adapte.</p>
        <p style="margin:0 0 20px;font-size:15px;line-height:1.6">Votre rapport vous sera remis, clair et opposable, en général sous 48 h après notre passage.</p>
        <p style="margin:0 0 4px;font-size:15px;color:#0B2A4A"><strong>L'équipe Soloris</strong> — <span style="color:#5B6B7C">Le diagnostic, en toute clarté.</span></p>
      </td></tr>
      <tr><td style="padding:18px 28px 24px">
        <table role="presentation" width="100%"><tr><td style="border-top:1px solid #E7ECF1;padding-top:16px">
          <p style="margin:0 0 6px;font-size:12px;color:#5B6B7C;line-height:1.6">soloris.fr · Paris &amp; Île-de-France · <span style="color:#2E6FAE;font-weight:bold">Une marque du groupe ISDIAG</span></p>
          ${annulationFooter}
          <p style="margin:0;font-size:12px;color:#8a93a0;line-height:1.6">Email automatique — pour toute question, appelez le ${esc(tel)}.</p>
        </td></tr></table>
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`;

  return { subject, preheader, html, text };
}
