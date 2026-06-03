/**
 * Grille tarifaire Soloris — SOURCE DE VÉRITÉ.
 * Modèle : PAR ÂGE DU BIEN × SURFACE (TTC, Paris + 93, déplacement inclus).
 *
 * Pourquoi par âge : les diagnostics obligatoires varient selon la date de
 * construction (amiante et plomb) :
 *  - Avant 1949            → amiante + plomb (CREP) requis → prix le plus élevé
 *  - De 1949 à <15 ans     → amiante requis, plomb non    → intermédiaire
 *  - Moins de 15 ans       → ni amiante ni plomb          → le plus accessible
 *
 * Règles : maison = prix appartement (même surface/âge) + 30 €.
 *          > 239 m² = sur devis. Maison en copropriété : + 20 €.
 *          Cave / parking : 99 €. ERP : offert en pack.
 *
 * ⚠️ Jamais de prix barré / promo / -X% / compte à rebours (premium accessible).
 */

export type Demande = 'vente' | 'location' | 'dpe' | 'audit';

export const DEMANDE_LABELS: Record<Demande, string> = {
  vente: 'Vente',
  location: 'Location',
  dpe: 'DPE seul',
  audit: 'Audit énergétique',
};

export type AgeBien = 'avant1949' | 'intermediaire' | 'recent';

export const AGE_LABELS: Record<AgeBien, string> = {
  avant1949: 'Avant 1949',
  intermediaire: 'De 1949 à moins de 15 ans',
  recent: 'Moins de 15 ans',
};

export const AGE_DESC: Record<AgeBien, string> = {
  avant1949: 'Amiante + plomb requis',
  intermediaire: 'Amiante requis',
  recent: 'Sans amiante ni plomb',
};

/** En-têtes de colonnes des tableaux (ordre = avant1949, intermédiaire, récent). */
export const AGE_COLUMNS: { key: AgeBien; label: string }[] = [
  { key: 'avant1949', label: 'Avant 1949' },
  { key: 'intermediaire', label: '1949 à < 15 ans' },
  { key: 'recent', label: 'Moins de 15 ans' },
];

/** Bandes de surface (borne max incluse). */
export const SURFACE_BANDS: { maxIncl: number; label: string }[] = [
  { maxIncl: 20, label: 'Jusqu’à 20 m²' },
  { maxIncl: 39, label: '20 à 39 m²' },
  { maxIncl: 59, label: '40 à 59 m²' },
  { maxIncl: 79, label: '60 à 79 m²' },
  { maxIncl: 99, label: '80 à 99 m²' },
  { maxIncl: 119, label: '100 à 119 m²' },
  { maxIncl: 139, label: '120 à 139 m²' },
  { maxIncl: 159, label: '140 à 159 m²' },
  { maxIncl: 179, label: '160 à 179 m²' },
  { maxIncl: 199, label: '180 à 199 m²' },
  { maxIncl: 219, label: '200 à 219 m²' },
  { maxIncl: 239, label: '220 à 239 m²' },
  { maxIncl: Infinity, label: 'Plus de 239 m²' }, // sur devis
];

/** Prix appartement par bande × âge : [avant1949, intermédiaire, récent]. null = sur devis. */
export const APPART_GRID: (readonly [number, number, number] | null)[] = [
  [199, 189, 159],
  [229, 219, 189],
  [249, 239, 209],
  [269, 259, 229],
  [289, 279, 249],
  [309, 299, 269],
  [329, 319, 289],
  [349, 339, 309],
  [369, 359, 329],
  [389, 379, 349],
  [409, 399, 369],
  [429, 419, 389],
  null,
];

export const MAISON_SUPP = 30; // maison = appartement + 30 €
export const PACK_FLOOR = 159; // plancher d'accroche « dès 159 € » (appart récent ≤ 20 m²)
export const AUDIT_FROM = 590; // audit énergétique dès 590 € (inchangé)
export const DPE_FROM = 120; // DPE seul dès 120 € (inchangé, 120–190 €)

/** Mentions / suppléments fixes. */
export const FIXED = {
  caveParking: 99, // diagnostic cave / parking
  coproSupp: 20, // maison en copropriété : + 20 €
};

/** Diagnostics à l'unité (à la carte) — info page tarifs (cohérent avec /diagnostics). */
export const ADDONS = [
  { key: 'amiante', label: 'Amiante', price: 90, prefix: 'dès ' },
  { key: 'plomb', label: 'Plomb (CREP)', price: 130, prefix: 'dès ' },
  { key: 'elec_gaz', label: 'Électricité + Gaz', price: 190, prefix: '' },
  { key: 'carrez_boutin', label: 'Mesurage Loi Carrez / Boutin', price: 70, prefix: 'dès ' },
  { key: 'erp', label: 'État des Risques et Pollutions (ERP)', price: 30, prefix: '', note: 'offert en pack' },
  { key: 'cave', label: 'Cave / parking', price: 99, prefix: '' },
] as const;

const AGE_INDEX: Record<AgeBien, number> = { avant1949: 0, intermediaire: 1, recent: 2 };

/** Index de la bande de surface correspondant à une surface en m². */
export function surfaceBandIndex(m2: number): number {
  for (let i = 0; i < SURFACE_BANDS.length; i++) {
    if (m2 <= SURFACE_BANDS[i].maxIncl) return i;
  }
  return SURFACE_BANDS.length - 1;
}

/** Prix appartement « brut » pour une bande (index) et un âge. null = sur devis. */
export function appartPrice(bandIndex: number, age: AgeBien): number | null {
  const row = APPART_GRID[bandIndex];
  return row ? row[AGE_INDEX[age]] : null;
}

/**
 * Estimation du pack diagnostics (vente / location) par type de bien, surface et âge.
 * Retourne le prix TTC, ou null = « sur devis » (> 239 m²).
 */
export function estimerPack(
  typeBien: 'appartement' | 'maison',
  m2: number,
  age: AgeBien,
): number | null {
  const base = appartPrice(surfaceBandIndex(m2), age);
  if (base == null) return null;
  return typeBien === 'maison' ? base + MAISON_SUPP : base;
}

/** DPE seul — conservé 120 à 190 € (par surface). */
export function estimerDpe(m2: number): number {
  if (m2 <= 39) return 120;
  if (m2 <= 79) return 150;
  if (m2 <= 119) return 170;
  return 190;
}

/** Prix « à partir de » par type de demande (accroches « dès X € »). */
export function prixDes(demande: Demande): number {
  if (demande === 'dpe') return DPE_FROM;
  if (demande === 'audit') return AUDIT_FROM;
  return PACK_FLOOR; // vente / location
}
