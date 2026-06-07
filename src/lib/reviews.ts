/**
 * Avis Google RÉELS issus de la fiche « is diag » (note 4,9 / 111 avis, 5/5 chacun).
 * Source unique — réutilisée sur l'accueil et les pages offres (pas de duplication).
 * ⚠️ N'ajouter ici que des avis authentiques.
 */
export interface Review {
  txt: string;
  who: string;
  sub: string;
}

export const REVIEWS: Review[] = [
  {
    txt: 'Merci à M. Teboul, il nous a sauvé la vente : RDV express avec des tarifs compétitifs.',
    who: 'Samuel M.',
    sub: 'Avis Google',
  },
  {
    txt: 'Très réactif. A refait le DPE de notre appartement acheté récemment. Pas de surprise et très professionnel. Je recommande.',
    who: 'Didier T.',
    sub: 'Avis Google',
  },
  {
    txt: 'Très satisfaite, RV pris rapidement et le rapport envoyé le jour même. Je recommande fortement.',
    who: 'Elisa E.',
    sub: 'Avis Google',
  },
];
