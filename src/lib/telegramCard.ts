/**
 * Carte Telegram d'un lead — SOURCE UNIQUE du texte et du clavier.
 * Utilisée par /api/lead (nouvelle carte), le webhook (boutons), la confirmation de RDV et
 * l'API admin (statut / assignation). Aucune clé ici : pur formatage.
 *
 * Structure : en-tête selon l'état (🟠 partiel / 🟢 complet / 📨 contact / 💬 chat), détails du
 * bien et du contact, acquisition, date de réception ; puis, dès que le lead est traité, une
 * LIGNE DE STATUT (📞 Contacté · par X · date, ✅ RDV pris…, ❌ Perdu…) et l'opérateur assigné.
 */
import { prixDes } from './pricing';
import { formatDateFr, formatHeureFr } from './rdvEmail';
import { leadKeyboard } from './telegram';

export type CardKind = 'partiel' | 'complet' | 'contact' | 'chat';

const DEMANDES = ['vente', 'location', 'dpe', 'audit'];
const AGE_LBL: Record<string, string> = { avant1949: 'avant 1949', intermediaire: '1949 à <15 ans', recent: '<15 ans' };

function fmtDateHeure(d: Date): string {
  try { return d.toLocaleString('fr-FR', { timeZone: 'Europe/Paris', dateStyle: 'short', timeStyle: 'short' }); }
  catch { return d.toISOString(); }
}
function fmtEur(n: any): string { const v = Number(n); return Number.isFinite(v) ? `${Math.round(v)} €` : ''; }
function toDate(v: any, fallback: Date): Date { const d = v ? new Date(v) : null; return d && !Number.isNaN(d.getTime()) ? d : fallback; }

/** Type de carte déduit d'un lead en base (pour une réécriture). */
export function cardKindOf(lead: Record<string, any>): CardKind {
  if (lead.source === 'contact') return 'contact';
  if (lead.source === 'chat') return 'chat';
  return lead.lead_status === 'complet' ? 'complet' : 'partiel';
}

/** Corps de la carte (sans ligne de statut). `receivedAt` = date de réception affichée. */
export function buildLeadCard(lead: Record<string, any>, kind: CardKind, receivedAt: Date = new Date()): string[] {
  const dateHeure = fmtDateHeure(receivedAt);
  const bienLine = [lead.type_demande || '—', lead.type_bien, lead.age_bien ? AGE_LBL[lead.age_bien] || lead.age_bien : '', lead.surface ? `${lead.surface} m²` : '']
    .filter(Boolean).join(' · ');
  const annexeLine = lead.annexe
    ? `🔧 annexe : ${lead.annexe_type === 'garage_dependance' ? 'garage / dépendance' : 'cave / parking / box'} (inclus)`
    : '';
  const acqLine = (lead.gads_keyword || lead.campaign)
    ? `🎯 ${lead.gads_keyword ? 'mot-clé ciblé : ' + lead.gads_keyword : ''}${lead.gads_keyword && lead.campaign ? ' · ' : ''}${lead.campaign ? 'campagne : ' + lead.campaign : ''}`
    : '';
  const prenom = (lead.nom || '').trim().split(/\s+/)[0] || '—';
  // 📍 Lieu : code postal + ville (« 75011 Paris »). Tolère l'absence de l'un ou l'autre.
  const lieuLine = (lead.secteur || lead.ville) ? `📍 ${[lead.secteur, lead.ville].filter(Boolean).join(' ')}` : '';
  // 💶 Toujours un montant : estimation exacte si connue, sinon prix d'entrée de la prestation.
  const demandeOk = lead.type_demande && DEMANDES.includes(lead.type_demande) ? lead.type_demande : null;
  const estimLine = lead.estimation
    ? `💶 estimation ${lead.estimation} €`
    : demandeOk ? `💶 à partir de ${prixDes(demandeOk)} € (estimation à préciser)` : '';

  let lines: string[];
  if (kind === 'partiel') {
    lines = [
      '🟠 Lead PARTIEL à rappeler — Soloris',
      lead.nom ? `👤 ${lead.nom}` : '',
      `📞 ${lead.telephone || '—'}`,
      lead.email ? `✉️ ${lead.email}` : '',
      `📋 ${bienLine}`, annexeLine, estimLine, lieuLine, acqLine,
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
      `📋 ${bienLine}`, annexeLine,
      `👤 ${lead.nom || '—'} (${prenom})`,
      `📞 ${lead.telephone || '—'}`,
      lead.email ? `✉️ ${lead.email}` : '',
      lieuLine, estimLine,
      lead.message ? `💬 ${lead.message}` : '',
      acqLine,
      `🔗 ${lead.landing_path || '/'}`,
      `🕒 ${dateHeure}`,
    ];
  }
  return lines.filter(Boolean);
}

/** Lignes de statut : vides pour un lead « nouveau » non assigné. */
export function statusLines(lead: Record<string, any>, at: Date = new Date()): string[] {
  const out: string[] = [];
  const st = lead.statut || 'nouveau';
  const par = lead.traite_par ? ` · par ${lead.traite_par}` : '';
  const quand = ` · ${fmtDateHeure(at)}`;
  if (st === 'contacte') out.push(`📞 Contacté${par}${quand}`);
  else if (st === 'rdv_pris') {
    const d = lead.rdv_at ? toDate(lead.rdv_at, at) : null;
    const prix = lead.prix_total_ttc != null ? fmtEur(lead.prix_total_ttc) : '';
    out.push(`✅ RDV pris${d ? ` · ${formatDateFr(d)} ${formatHeureFr(d)}` : ''}${lead.prestation ? ' · ' + lead.prestation : ''}${prix ? ' · ' + prix : ''}${par}`);
    if (lead.rdv_adresse) out.push(`🏠 ${lead.rdv_adresse}`);
  }
  else if (st === 'realise') out.push(`🏁 Réalisé${par}${quand}`);
  else if (st === 'facture') out.push(`💶 Facturé${lead.montant ? ' · ' + fmtEur(lead.montant) : ''}${par}${quand}`);
  else if (st === 'perdu') out.push(`❌ Perdu${par}${quand}`);
  if (lead.assigne_nom) out.push(`👷 Assigné à ${lead.assigne_nom}`);
  return out;
}

/** Texte complet de la carte d'un lead en base : corps + séparateur + statut. */
export function cardText(lead: Record<string, any>): string {
  const now = new Date();
  const body = buildLeadCard(lead, cardKindOf(lead), toDate(lead.created_at, now));
  const status = statusLines(lead, toDate(lead.updated_at, now));
  return (status.length ? body.concat(['──────────', ...status]) : body).join('\n');
}

/** Clavier : actions tant que le lead est ouvert ; retiré une fois RDV pris / réalisé / facturé / perdu. */
export function cardKeyboard(lead: Record<string, any>) {
  const st = lead.statut || 'nouveau';
  return st === 'nouveau' || st === 'contacte' ? leadKeyboard(String(lead.id)) : { inline_keyboard: [] as any[] };
}
