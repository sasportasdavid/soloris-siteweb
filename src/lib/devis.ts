/**
 * Logique « devis » partagée (client + serveur) — AUCUNE dépendance serveur ici
 * (pas de pdf-lib), pour pouvoir l'importer dans le back-office /admin.
 * Construit un brouillon de devis à partir d'un lead (objet, lignes, montant).
 */

import { LOT_ANNEXE_PRICE, TYPE_BIEN_LABELS, isLotAnnexe } from './pricing';

export const DEMANDE_PACK: Record<string, string> = {
  vente: 'Pack diagnostics avant vente',
  location: 'Pack diagnostics location',
  dpe: 'Diagnostic de performance énergétique (DPE)',
  audit: 'Audit énergétique réglementaire',
};

const AGE_TXT: Record<string, string> = {
  avant1949: 'avant 1949',
  intermediaire: '1949 à moins de 15 ans',
  recent: 'moins de 15 ans',
};

const ANNEXE_TXT: Record<string, string> = {
  cave_parking: 'Diagnostic cave / parking / box',
  garage_dependance: 'Diagnostic garage / dépendance',
};

export interface DevisLigne {
  libelle: string;
  montant: number;
}

export interface DevisDraft {
  objet: string;
  lignes: DevisLigne[];
  montant: number;
  validite_jours: number;
}

/** Construit un brouillon de devis à partir d'un lead du CRM. */
export function buildDevisDraftFromLead(l: any): DevisDraft {
  const d = l.type_demande;
  const est = Number(l.estimation) || 0;
  const annexeAmt = l.annexe ? 99 : 0;
  const bienTxt = l.type_bien === 'maison' ? 'Maison' : l.type_bien === 'appartement' ? 'Appartement' : '';
  const surfTxt = l.surface ? `${l.surface} m²` : '';
  const ageTxt = l.age_bien ? AGE_TXT[l.age_bien] || '' : '';
  const pack = DEMANDE_PACK[d] || 'Prestation de diagnostics';
  const lignes: DevisLigne[] = [];
  let objet = pack;

  // Lot annexe vendu/loué seul (cave / parking / box) : tarif unique, PAS de DPE.
  // TODO diagnostics exacts à confirmer : ERP quasi systématique ; amiante selon
  // l'année de construction (permis de construire < 1997) et la présence de matériaux.
  if (isLotAnnexe(l.type_bien)) {
    const label = TYPE_BIEN_LABELS[l.type_bien as keyof typeof TYPE_BIEN_LABELS] || 'Lot annexe';
    objet = `Diagnostics — ${label}`;
    lignes.push({ libelle: `Diagnostics ${label.toLowerCase()} (lot vendu seul, tout compris)`, montant: LOT_ANNEXE_PRICE });
    return { objet, lignes, montant: LOT_ANNEXE_PRICE, validite_jours: 30 };
  }

  if (d === 'vente' || d === 'location') {
    const detail = [bienTxt, surfTxt, ageTxt].filter(Boolean).join(', ');
    objet = `${pack}${bienTxt ? ' — ' + bienTxt : ''}${surfTxt ? ' ' + surfTxt : ''}`;
    lignes.push({ libelle: `${pack}${detail ? ' — ' + detail : ''}`, montant: Math.max(est - annexeAmt, 0) });
    if (l.annexe) lignes.push({ libelle: ANNEXE_TXT[l.annexe_type] || 'Diagnostic annexe', montant: 99 });
  } else if (d === 'dpe') {
    objet = `DPE${bienTxt ? ' — ' + bienTxt : ''}${surfTxt ? ' ' + surfTxt : ''}`;
    lignes.push({ libelle: `Diagnostic de performance énergétique (DPE)${bienTxt ? ' — ' + bienTxt : ''}${surfTxt ? ', ' + surfTxt : ''}`, montant: est });
  } else if (d === 'audit') {
    objet = 'Audit énergétique réglementaire';
    lignes.push({ libelle: 'Audit énergétique réglementaire', montant: est });
  } else {
    lignes.push({ libelle: pack, montant: est });
  }

  const montant = lignes.reduce((s, x) => s + (Number(x.montant) || 0), 0);
  return { objet, lignes, montant, validite_jours: 30 };
}

/** Total d'une liste de lignes. */
export function totalLignes(lignes: DevisLigne[]): number {
  return (lignes || []).reduce((s, l) => s + (Number(l.montant) || 0), 0);
}

export const STATUT_DEVIS_LABELS: Record<string, string> = {
  brouillon: 'Brouillon',
  envoye: 'Envoyé',
  signe: 'Signé',
  refuse: 'Refusé',
};
