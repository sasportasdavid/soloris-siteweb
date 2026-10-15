/**
 * Référentiel de wording commun (dossier éditorial V2, oct. 2026).
 *
 * Les montants et seuils sont LUS dans pricing.ts (aucune grille recopiée ici) : si la
 * grille évolue, les prix d'entrée et leurs conditions affichées suivent automatiquement.
 */
import {
  AGE_LABELS, AUDIT_FROM, AUDIT_TO, DPE_FROM, DPE_MAISON_SUPP, LOT_ANNEXE_PRICE,
  SURFACE_BANDS, estimerDpe, prixDes,
} from './pricing';
import { SITE } from './site';

/** Dernière surface (m²) facturée au prix d'entrée du DPE, déduite d'estimerDpe(). */
export const DPE_FROM_MAX_M2 = (() => { let m = 1; while (m < 1000 && estimerDpe(m + 1) === DPE_FROM) m++; return m; })();
/** Surface maximale du cas d'entrée des packs (1re tranche de la grille). */
export const PACK_FROM_MAX_M2 = SURFACE_BANDS[0].maxIncl;

export const PRIX = {
  dpe: `DPE dès ${DPE_FROM} € TTC`,
  pack: `Pack diagnostics dès ${prixDes('vente')} € TTC`,
  audit: `Audit énergétique : de ${AUDIT_FROM} à ${AUDIT_TO} € TTC selon le bien`,
};

/** Conditions à afficher AU PLUS PRÈS du montant correspondant. */
export const CONDITIONS = {
  dpe: `Prix d’entrée pour un appartement jusqu’à ${DPE_FROM_MAX_M2} m². Le tarif varie selon la surface ; supplément de ${DPE_MAISON_SUPP} € TTC pour une maison. Prix confirmé avant la visite.`,
  pack: `Prix d’entrée pour un appartement de ${PACK_FROM_MAX_M2} m² maximum construit depuis ${AGE_LABELS.recent.toLowerCase()}. Le tarif dépend du bien, de sa surface et des prestations nécessaires. Composition du pack et prix confirmés au devis.`,
  audit: 'Le périmètre, le prix et le délai sont confirmés au devis. L’audit est une prestation distincte du DPE et des autres diagnostics de vente.',
  annexes: `Annexe rattachée au logement : incluse dans le pack. Cave, parking ou box diagnostiqué seul : ${LOT_ANNEXE_PRICE} € TTC.`,
};

export const WORDING = {
  engagementDevis: 'Demande gratuite et sans engagement. Le prix est confirmé avant l’intervention.',
  rendezVous: 'Créneau confirmé avec vous, selon les disponibilités.',
  rapport: 'Rapports généralement remis sous 24 h après la visite. Le délai applicable à votre dossier vous est confirmé au rendez-vous.',
  rapportAudit: 'Le délai de remise de l’audit est confirmé dans votre devis.',
  rappelCourt: 'Rappel pendant nos horaires d’ouverture',
  horaires: SITE.rappel.horaires,
  horsHoraires: 'Votre demande sera traitée à la prochaine ouverture.',
  illustration: 'Exemple de présentation, à titre illustratif. Les résultats dépendent du logement diagnostiqué.',
  certification: 'Les diagnostics soumis à certification sont réalisés par un professionnel certifié dans le domaine concerné.',
};
