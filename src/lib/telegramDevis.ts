/**
 * Message Telegram « aperçu du devis » (posté en réponse à la carte du lead après un clic
 * sur 📄 Devis). L'email part UNIQUEMENT sur le bouton de confirmation (dvs|{devisId}).
 * Pur formatage : aucune clé ici.
 */
import { SITE_URL } from './serverEnv';
import { devisPdfUrl } from './devisSend';
import { STATUT_DEVIS_LABELS } from './devis';

function fmtDateHeure(v: any): string {
  const d = v ? new Date(v) : null;
  if (!d || Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('fr-FR', { timeZone: 'Europe/Paris', dateStyle: 'short', timeStyle: 'short' });
}
const eur = (n: any) => `${Math.round(Number(n) || 0)} €`;

/** Raisons qui empêchent l'envoi depuis Telegram (à corriger dans /admin). */
export function devisBlockers(d: any): string[] {
  const out: string[] = [];
  if (!d.client_email) out.push("pas d'email client");
  if (!(Number(d.montant) > 0)) out.push('montant à 0 €');
  if (d.statut === 'signe') out.push('devis déjà signé');
  return out;
}

export function devisPreviewText(d: any): string {
  const lignes = (d.lignes || []).map((l: any) => `• ${l.libelle} — ${eur(l.montant)}`);
  const blockers = devisBlockers(d);
  return [
    `📄 Devis ${d.numero} · ${STATUT_DEVIS_LABELS[d.statut] || d.statut}`,
    `👤 ${d.client_nom || '—'}${d.client_email ? ' · ✉️ ' + d.client_email : ''}`,
    d.objet ? `📋 ${d.objet}` : '',
    ...lignes,
    `💶 Total TTC : ${eur(d.montant)} · valable ${d.validite_jours || 30} j`,
    d.sent_at ? `📨 Déjà envoyé le ${fmtDateHeure(d.sent_at)} — un nouvel envoi renvoie ce même devis.` : '',
    blockers.length ? `⚠️ Envoi impossible : ${blockers.join(', ')}. Corrigez le devis dans l'admin.` : '',
  ].filter(Boolean).join('\n');
}

export function devisPreviewKeyboard(d: any) {
  const rows: any[][] = [];
  if (!devisBlockers(d).length) {
    rows.push([{ text: `✅ ${d.sent_at ? 'Renvoyer' : 'Envoyer'} à ${d.client_email}`.slice(0, 64), callback_data: `dvs|${d.id}` }]);
  }
  rows.push([
    { text: '📄 Voir le PDF', url: devisPdfUrl(d) },
    { text: '✏️ Modifier', url: `${SITE_URL}/admin?lead=${d.lead_id}` },
  ]);
  rows.push([{ text: '✖️ Fermer', callback_data: 'dvx' }]);
  return { inline_keyboard: rows };
}

/** Texte final une fois l'email parti (le clavier est retiré). */
export function devisSentText(d: any, to: string, par: string): string {
  return [
    `✅ Devis ${d.numero} envoyé à ${to}`,
    `💶 ${eur(d.montant)} TTC${d.objet ? ' · ' + d.objet : ''}`,
    `📨 par ${par} · ${fmtDateHeure(new Date())}`,
  ].join('\n');
}
