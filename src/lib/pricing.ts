/**
 * Grille tarifaire Soloris — TTC, déplacement inclus.
 * Les prix sont des « dès » (à partir de) : honnêtes et atteignables.
 * On affiche toujours « à partir de X € », jamais un montant faussement précis.
 */

export type Demande = 'vente' | 'location' | 'dpe' | 'audit';
export type Typo = 't1' | 't2' | 't3' | 't4';

/** Grille « dès » par type de demande et typologie. Source : grille Soloris. */
export const GRILLE: Record<Demande, Record<Typo, number>> = {
  vente: { t1: 250, t2: 290, t3: 340, t4: 400 },
  location: { t1: 180, t2: 210, t3: 240, t4: 280 },
  dpe: { t1: 120, t2: 150, t3: 170, t4: 190 },
  audit: { t1: 590, t2: 590, t3: 620, t4: 650 },
};

/** Add-ons / diagnostics à l'unité (info page tarifs). */
export const ADDONS = [
  { key: 'amiante', label: 'Amiante (avant vente)', price: 90, prefix: '+' },
  { key: 'plomb', label: 'Plomb (CREP, logements avant 1949)', price: 130, prefix: '+' },
  { key: 'elec_gaz', label: 'Électricité + Gaz (combo)', price: 190, prefix: '' },
  { key: 'erp', label: 'État des Risques et Pollutions (ERP)', price: 30, prefix: '', note: 'offert en pack' },
  { key: 'carrez_boutin', label: 'Mesurage Loi Carrez / Boutin', price: 70, prefix: '' },
] as const;

/** Libellés lisibles des typologies. */
export const TYPO_LABELS: Record<Typo, string> = {
  t1: 'Studio / T1',
  t2: 'T2',
  t3: 'T3',
  t4: 'T4 et +',
};

export const DEMANDE_LABELS: Record<Demande, string> = {
  vente: 'Vente',
  location: 'Location',
  dpe: 'DPE seul',
  audit: 'Audit énergétique',
};

/**
 * Estimation indicative (jamais un prix ferme).
 * Retourne le montant « dès » correspondant, ou null si non calculable.
 */
export function estimer(demande: Demande, typo: Typo): number | null {
  const ligne = GRILLE[demande];
  if (!ligne) return null;
  return ligne[typo] ?? null;
}

/** Le « dès » le plus bas d'une demande donnée (pour les aperçus). */
export function prixDes(demande: Demande): number {
  return Math.min(...Object.values(GRILLE[demande]));
}
