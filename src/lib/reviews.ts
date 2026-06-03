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
    txt: 'Société très compétente et très réactive lors des différents échanges, je recommande cette dernière pour toutes opération de diagnostic.',
    who: 'M. Lambt',
    sub: 'Avis Google',
  },
  {
    txt: 'Travail rapide et bien exécuté. M. Teboul est très sympathique.',
    who: 'Philippe G.',
    sub: 'Avis Google',
  },
  {
    txt: "Vous avez réalisé les diagnostics d'un appartement mis en vente dans mon agence immobilière à Paris.",
    who: 'Julie A.',
    sub: 'Avis Google · agence immobilière',
  },
];
