/**
 * Avis Google RÉELS issus de la fiche « is diag » (note 4,9 / 111 avis, 5/5 chacun).
 * Source unique — réutilisée sur l'accueil et les pages offres (pas de duplication).
 * ⚠️ N'ajouter ici que des avis authentiques. Orthographe/ponctuation peuvent être
 * normalisées, mais JAMAIS le sens ni les faits.
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

export const REVIEWS_EXTRA: Review[] = [
  {
    txt: "Service très professionnel et échange chaleureux — j'ai obtenu mes documents de diagnostics très rapidement après le rendez-vous !",
    who: 'Sofia G.',
    sub: 'Avis Google',
  },
  {
    txt: 'Société réactive et professionnelle. Diagnostics livrés rapidement. Je recommande +++',
    who: 'Charles',
    sub: 'Avis Google',
  },
  {
    txt: 'Après un diagnostic complet, je suis pleinement satisfaite. Monsieur T. est très compétent, professionnel, sympathique, rapide, efficace, disponible par messages et mails. Je recommande à 100 % !',
    who: 'Laure L.',
    sub: 'Avis Google',
  },
  {
    txt: 'Rapide, efficace et bien placé en termes de tarif, je recommande :)',
    who: 'Arnaud C.',
    sub: 'Avis Google',
  },
  {
    txt: 'Merci pour votre intervention, très rapide, efficace, ponctuel et sympathique. Je recommande vivement !',
    who: 'Anouk H.',
    sub: 'Avis Google',
  },
  {
    txt: 'Excellente société de diagnostic à tout point de vue. Je recommande à 100 % — Bravo !',
    who: 'B. Soum',
    sub: 'Avis Google',
  },
];
