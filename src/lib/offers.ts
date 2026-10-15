/**
 * Données des 4 offres Soloris. Source unique pour les cartes home, les pages
 * offres, le menu de navigation et le maillage interne.
 *
 * Textes : dossier éditorial V2 (oct. 2026). Les montants et leurs conditions sont
 * RENDUS depuis pricing.ts (via wording.ts) : aucun prix recopié en dur.
 *
 * ⚠️ Conformité : les listes de diagnostics décrivent ce qui PEUT composer un
 * pack selon la situation du bien. La composition exacte dépend de chaque
 * logement et est confirmée au devis.
 */
import { AUDIT_FROM, AUDIT_TO, DPE_FROM, DPE_MAISON_SUPP, prixDes, AGE_LABELS } from './pricing';
import type { Demande } from './pricing';
import { DPE_FROM_MAX_M2, PACK_FROM_MAX_M2 } from './wording';

export interface Offer {
  slug: string;
  url: string;
  demande: Demande;
  nav: string;
  /** Libellé court du menu « Nos offres » (en-tête). */
  menu: string;
  navDesc: string;
  shortLabel: string; // libellé propre pour « votre … » (titres, CTA)
  h1: string;
  title: string;
  metaDesc: string;
  tagline: string;
  /** CTA héro : si défini, ancre interne (ex. '#simulateur') pour scroller vers le formulaire
   *  embarqué au lieu de naviguer ; défaut = /devis?type=<demande>. */
  heroCtaHref?: string;
  /** Badge du héro (défaut du gabarit si absent). */
  tagpill?: string;
  introTitle: string;
  intro: string;
  // Photo d'intro (optionnelle) — visuel de l'en-tête 2 colonnes
  heroImage?: string;
  heroImageAlt?: string;
  heroImageSide?: 'left' | 'right'; // côté de la photo (défaut : droite)
  introDark?: boolean; // bloc texte sur fond navy (différencie les parcours)
  // « ce qui est inclus / peut être inclus »
  inclusTitle: string;
  inclusIntro: string;
  inclus: { label: string; detail: string }[];
  /** Prix VISIBLE (même montant que le JSON-LD) et ses conditions, au plus près. */
  prixTitle: string;
  prixText: string;
  /** Fourchette haute éventuelle (audit) pour les données structurées. */
  prixTo?: number;
  /** Blocs éditoriaux propres à l'offre (titre + texte, HTML simple autorisé). */
  blocs: { h: string; p: string }[];
  processTitle: string;
  processText: string;
  /** Étape 3 du déroulement (délai propre à la prestation). */
  processStep3: string;
  formTitle: string;
  formIntro: string;
  /** Maillage éditorial vers les pages existantes. */
  liens: { href: string; label: string }[];
  faq: { q: string; a: string }[];
}

const packCond = `Prix d’entrée pour un appartement de ${PACK_FROM_MAX_M2}&nbsp;m² maximum construit depuis ${AGE_LABELS.recent.toLowerCase()}.`;
const rapport24 = 'Le professionnel réalise les diagnostics et vous transmet les rapports, généralement sous 24&nbsp;h après la visite, avec les explications utiles.';

export const OFFERS: Offer[] = [
  {
    slug: 'diagnostics-vente',
    url: '/diagnostics-vente',
    demande: 'vente',
    nav: 'Diagnostics pour vendre',
    menu: 'Pour vendre',
    navDesc: 'Les diagnostics de votre vente, en un rendez-vous',
    shortLabel: 'dossier de diagnostics pour vendre',
    h1: 'Vos diagnostics de vente, réunis en un seul rendez-vous',
    title: 'Diagnostics pour vendre à Paris et en IDF | Soloris',
    metaDesc: `Préparez votre vente : diagnostics adaptés au bien, réunis en une visite. Pack dès ${prixDes('vente')} € TTC selon le logement, déplacement inclus.`,
    tagline: 'Appartement ou maison : nous identifions les diagnostics nécessaires et préparons les rapports à transmettre à votre notaire.',
    // CTA héro : scroll vers le simulateur embarqué (#simulateur), même tunnel, sans quitter la page.
    heroCtaHref: '#simulateur',
    introTitle: 'Un dossier adapté à votre vente',
    intro: 'Vous n’avez pas à commander une liste de diagnostics au hasard. Nous faisons le point sur votre bien, les rapports déjà disponibles et votre projet pour préciser les prestations nécessaires.',
    heroImage: '/images/vendeur-salon-vide.webp',
    heroImageAlt: 'Propriétaire dans son appartement parisien, clés en main',
    inclusTitle: 'Quels diagnostics peut comprendre le pack ?',
    inclusIntro: 'DPE et état des risques selon le bien ; amiante pour les permis de construire antérieurs au 1er juillet 1997 ; plomb pour les logements construits avant 1949 ; électricité et gaz selon l’ancienneté des installations ; mesurage Carrez pour les lots concernés ; termites selon la zone. La composition exacte est confirmée au devis.',
    inclus: [
      { label: 'DPE — Performance énergétique', detail: 'Étiquette A à G, selon la méthode réglementaire.' },
      { label: 'État des risques', detail: 'Information sur les risques liés à l’adresse du bien, incluse dans le pack.' },
      { label: 'Amiante', detail: 'Pour les biens dont le permis de construire est antérieur au 1ᵉʳ juillet 1997.' },
      { label: 'Plomb (CREP)', detail: 'Pour les logements construits avant le 1ᵉʳ janvier 1949.' },
      { label: 'Électricité & Gaz', detail: 'Selon l’ancienneté des installations intérieures (plus de 15 ans).' },
      { label: 'Loi Carrez', detail: 'Mesurage de la surface privative, pour les lots de copropriété concernés.' },
      { label: 'Termites', detail: 'Dans les zones définies par arrêté préfectoral.' },
    ],
    prixTitle: 'Le prix de votre pack vente',
    prixText: `Pack dès ${prixDes('vente')}&nbsp;€ TTC, déplacement inclus. ${packCond} Le montant varie selon la surface, le type de bien et les prestations nécessaires. Annexe rattachée au logement incluse dans le pack ; lot vendu seul traité séparément.`,
    blocs: [
      { h: 'Vous vendez un appartement ?', p: 'Signalez les caves, parkings ou autres lots compris dans la vente et les diagnostics que vous possédez déjà. Nous vérifions le périmètre utile, y compris le mesurage de la superficie privative lorsque le lot est concerné.' },
      { h: 'Vous vendez une maison ?', p: 'Précisez les dépendances, les installations et l’existence éventuelle d’une copropriété. Un audit énergétique peut être requis pour certaines ventes de maisons classées E, F ou G ; cette prestation est distincte du pack.' },
    ],
    processTitle: 'Une intervention préparée, des rapports transmis',
    processText: 'Nous confirmons le créneau et les documents utiles. Les diagnostics prévus sont regroupés lors de la visite. Les rapports sont généralement remis sous 24&nbsp;h après la visite ; le délai de votre dossier est confirmé selon son périmètre.',
    processStep3: rapport24,
    formTitle: 'Préparez votre dossier de vente',
    formIntro: 'Décrivez votre bien en quelques étapes. Nous confirmons les diagnostics, le prix et les disponibilités avant l’intervention.',
    liens: [
      { href: '/diagnostics', label: 'Tous les diagnostics' },
      { href: '/diagnostics/amiante', label: 'Diagnostic amiante' },
      { href: '/diagnostics/plomb', label: 'Diagnostic plomb (CREP)' },
      { href: '/diagnostics/loi-carrez', label: 'Mesurage Loi Carrez' },
      { href: '/audit-energetique', label: 'Audit énergétique' },
    ],
    faq: [
      {
        q: 'Tous les diagnostics sont-ils nécessaires pour chaque vente ?',
        a: 'Non. La liste dépend notamment des caractéristiques du bien, de la date du permis, de sa construction, des installations et de la zone. Nous confirmons les prestations applicables au devis.',
      },
      {
        q: 'Puis-je réutiliser un ancien diagnostic ?',
        a: 'Cela dépend du diagnostic, de sa date, de ses conclusions et d’éventuels changements du bien. Transmettez les rapports existants pour vérification avant de commander une nouvelle intervention.',
      },
      {
        q: 'L’audit énergétique est-il compris ?',
        a: 'L’audit est une prestation distincte. Il peut être requis pour la vente de certaines maisons ou d’immeubles en monopropriété classés E, F ou G en métropole.',
      },
      {
        q: 'Le rendez-vous est-il réservé à l’envoi du formulaire ?',
        a: 'Non. L’envoi constitue une demande. Le prix, le périmètre et le créneau sont confirmés avec vous.',
      },
    ],
  },
  {
    slug: 'diagnostics-location',
    url: '/diagnostics-location',
    demande: 'location',
    nav: 'Diagnostics pour louer',
    menu: 'Pour louer',
    navDesc: 'Le dossier de diagnostics de votre bail',
    shortLabel: 'dossier de diagnostics pour louer',
    h1: 'Préparez les diagnostics de votre location',
    title: 'Diagnostics location à Paris et en IDF | Soloris',
    metaDesc: `DPE et diagnostics nécessaires pour louer à Paris et en Île-de-France. Pack dès ${prixDes('location')} € TTC selon le bien, prix annoncé avant la visite.`,
    tagline: 'DPE et diagnostics complémentaires selon votre logement : un dossier adapté à votre bail, un prix annoncé et une seule intervention organisée.',
    introTitle: 'Un dossier locatif adapté au logement',
    intro: 'Nous vérifions les diagnostics nécessaires selon le logement et les rapports existants. Vous disposez des documents utiles à votre bail, sans confondre le DPE seul avec l’ensemble du dossier locatif.',
    heroImage: '/images/salon-meuble.webp',
    heroImageAlt: "Salon meublé d'un appartement à louer",
    heroImageSide: 'left',
    introDark: true,
    inclusTitle: 'Les prestations à prévoir selon le bien',
    inclusIntro: 'Le dossier peut comprendre le DPE, l’état des risques, le constat plomb, les états des installations d’électricité et de gaz. Le mesurage de la surface habitable est traité selon votre besoin.',
    inclus: [
      { label: 'DPE — Performance énergétique', detail: 'Étiquette A à G, à annexer au bail.' },
      { label: 'État des risques', detail: 'Information sur les risques liés à l’adresse du logement, incluse dans le pack.' },
      { label: 'Plomb (CREP)', detail: 'Pour les logements construits avant le 1ᵉʳ janvier 1949.' },
      { label: 'Électricité & Gaz', detail: 'Pour les installations intérieures de plus de 15 ans.' },
      { label: 'Surface habitable (Loi Boutin)', detail: 'Mesurage de la surface habitable, selon votre besoin.' },
      { label: 'Amiante', detail: 'Informations éventuellement tenues à disposition selon le bien : ce n’est pas une annexe identique pour tous les baux.' },
    ],
    prixTitle: 'Le prix de votre pack location',
    prixText: `Pack dès ${prixDes('location')}&nbsp;€ TTC, déplacement inclus. ${packCond} Les prestations et le montant sont confirmés avant la visite.`,
    blocs: [
      { h: 'Ce que le DPE change pour votre location', p: 'La réalisation d’un DPE ne garantit pas qu’un logement peut être loué. En métropole, les exigences de décence énergétique dépendent notamment de la classe et de la date de signature, de renouvellement ou de reconduction du bail. Nous vous expliquons le résultat ; une situation particulière doit être vérifiée avant la mise en location.' },
    ],
    processTitle: 'Vos diagnostics en trois étapes',
    processText: 'Nous confirmons les accès, les prestations et le rendez-vous avec vous avant l’intervention.',
    processStep3: rapport24,
    formTitle: 'Préparez la visite',
    formIntro: 'Indiquez le code postal, la surface, les installations et les diagnostics déjà disponibles. Nous confirmons les accès, les prestations et le rendez-vous avec vous.',
    liens: [
      { href: '/dpe', label: 'DPE seul' },
      { href: '/diagnostics/loi-boutin', label: 'Mesurage Loi Boutin' },
      { href: '/diagnostics/electricite', label: 'Diagnostic électricité' },
      { href: '/diagnostics/gaz', label: 'Diagnostic gaz' },
      { href: '/guides/reforme-dpe', label: 'Guide : les évolutions du DPE' },
    ],
    faq: [
      {
        q: 'Le pack location est-il le même que le pack vente ?',
        a: 'Non. La composition répond à un projet différent. Les diagnostics et leur durée de validité peuvent varier selon la vente ou la location.',
      },
      {
        q: 'Un DPE G permet-il de louer ?',
        a: 'En métropole, pour les baux concernés signés, renouvelés ou reconduits depuis le 1er janvier 2025, le logement doit respecter le seuil de décence énergétique applicable. Les logements G ne répondent pas à ce seuil. Le DPE seul ne régularise pas la situation.',
      },
      {
        q: 'Faut-il refaire tous les diagnostics à chaque locataire ?',
        a: 'Pas automatiquement. Leur validité et la situation du logement doivent être vérifiées. Préparez les rapports existants avant notre échange.',
      },
      {
        q: 'Le prix est-il connu avant la visite ?',
        a: 'Oui, le prix et les prestations sont confirmés avec vous avant l’intervention. Le montant « dès » correspond à un cas d’entrée de grille.',
      },
    ],
  },
  {
    slug: 'dpe',
    url: '/dpe',
    demande: 'dpe',
    nav: 'DPE seul',
    menu: 'DPE',
    navDesc: 'Votre DPE, prix annoncé avant la visite',
    shortLabel: 'DPE',
    h1: 'Votre DPE à Paris et en Île-de-France',
    title: `DPE à Paris et en Île-de-France dès ${DPE_FROM} € | Soloris`,
    metaDesc: `DPE pour appartement ou maison à Paris et en Île-de-France. Dès ${DPE_FROM} € TTC selon le bien, déplacement inclus. Demandez votre devis.`,
    tagline: 'Un diagnostic pour votre appartement ou votre maison, un prix annoncé avant la visite et des résultats expliqués.',
    introTitle: 'Pour vendre ou louer',
    intro: 'Le DPE peut être nécessaire à votre projet de vente ou de location. D’autres diagnostics peuvent compléter le dossier selon le bien. Nous vous aidons à préciser ce qui est nécessaire sans vous promettre une classe énergétique.',
    inclusTitle: 'Ce que comprend votre DPE',
    inclusIntro: 'Une visite du logement, les relevés nécessaires, l’évaluation réglementaire et le rapport. Nous vous expliquons l’étiquette et les recommandations figurant dans le document. Le DPE ne se limite pas à une simulation à distance.',
    inclus: [
      { label: 'Visite et relevés sur place', detail: 'Mesures et caractéristiques du logement.' },
      { label: 'Évaluation réglementaire', detail: 'Calcul selon la méthode réglementaire en vigueur.' },
      { label: 'Étiquette énergie A→G', detail: 'Énergie et climat (émissions de gaz à effet de serre).' },
      { label: 'Rapport expliqué', detail: 'Lecture de l’étiquette et des recommandations, sans promesse de résultat.' },
    ],
    prixTitle: `DPE dès ${DPE_FROM} € TTC`,
    prixText: `Prix d’entrée pour un appartement jusqu’à ${DPE_FROM_MAX_M2}&nbsp;m², déplacement inclus. Le tarif varie selon la surface ; supplément de ${DPE_MAISON_SUPP}&nbsp;€ TTC pour une maison. Le prix de votre intervention est confirmé au devis.`,
    blocs: [
      { h: 'Vous avez déjà un DPE ?', p: 'Avant d’en commander un nouveau, vérifiez sa date et son identifiant ADEME. Un DPE encore valide peut, dans certains cas, bénéficier d’une attestation officielle de mise à jour sans nouvelle visite. Consultez <a href="/guides/reforme-dpe">notre guide sur les évolutions du DPE</a>.' },
      { h: 'Votre rapport, expliqué', p: 'Le rapport est généralement remis sous 24&nbsp;h après la visite, selon le dossier. Votre résultat dépend des caractéristiques du logement et de la méthode réglementaire, pas d’un objectif de note choisi à l’avance.' },
    ],
    processTitle: 'Comment se déroule votre demande ?',
    processText: 'Vous décrivez votre bien et laissez vos coordonnées. Nous confirmons le tarif et le créneau lors de notre échange. Vous pouvez ajouter votre email pour recevoir les informations par écrit.',
    processStep3: 'Le DPE est réalisé sur place ; le rapport est généralement remis sous 24&nbsp;h après la visite, avec les explications utiles.',
    formTitle: 'Demandez votre devis DPE',
    formIntro: 'Le tarif personnalisé vous est confirmé lors de notre échange, avant l’intervention.',
    liens: [
      { href: '/tarifs', label: 'Tous les tarifs' },
      { href: '/guides/comprendre-etiquette-dpe', label: 'Guide : comprendre l’étiquette DPE' },
      { href: '/guides/reforme-dpe', label: 'Guide : les évolutions du DPE' },
      { href: '/diagnostics-vente', label: 'Diagnostics pour vendre' },
      { href: '/diagnostics-location', label: 'Diagnostics pour louer' },
    ],
    faq: [
      {
        q: 'Le tarif est-il affiché après le formulaire ?',
        a: 'Sur cette page, le formulaire permet de demander votre devis. Le tarif personnalisé vous est confirmé lors de notre échange, avant l’intervention.',
      },
      {
        q: 'Combien de temps un DPE est-il valable ?',
        a: 'Un DPE réalisé depuis le 1er juillet 2021 est en principe valable 10 ans. Les DPE antérieurs ne sont plus valides. La validité et une éventuelle attestation doivent être vérifiées pour votre document.',
      },
      {
        q: 'Dois-je refaire mon DPE uniquement à cause de la réforme ?',
        a: 'Pas nécessairement. Les DPE encore valides restent utilisables ; les mécanismes officiels d’attestation peuvent actualiser certaines étiquettes. Vérifiez votre situation sur l’Observatoire ADEME.',
      },
      {
        q: 'Garantissez-vous une meilleure étiquette ?',
        a: 'Non. Notre engagement concerne la réalisation du diagnostic et l’explication des résultats, pas une amélioration de la classe.',
      },
    ],
  },
  {
    slug: 'audit-energetique',
    url: '/audit-energetique',
    demande: 'audit',
    nav: 'Audit énergétique',
    menu: 'Audit énergétique',
    navDesc: 'Scénarios de travaux, sur devis',
    shortLabel: 'audit énergétique',
    h1: 'Votre audit énergétique à Paris et en Île-de-France',
    title: 'Audit énergétique à Paris et en IDF | Soloris',
    metaDesc: `Audit énergétique à Paris et en Île-de-France : scénarios de travaux et rapport détaillé. De ${AUDIT_FROM} à ${AUDIT_TO} € TTC selon le bien, sur devis.`,
    tagline: 'Comprenez les possibilités de rénovation de votre bien avec des scénarios de travaux, un budget indicatif et un rapport détaillé.',
    tagpill: 'Audit énergétique · Paris et Île-de-France',
    introTitle: 'Un audit pour éclairer votre projet',
    intro: 'L’audit va au-delà de l’étiquette du DPE. Il étudie les caractéristiques du bâtiment et présente des propositions de travaux pour améliorer sa performance énergétique.',
    inclusTitle: 'Ce que contient votre audit',
    inclusIntro: 'L’état initial du bien, les scénarios de travaux prévus par la mission, les évaluations énergétiques et les estimations de coûts correspondantes. Les montants sont indicatifs ; ils ne remplacent pas des devis d’entreprises ni une garantie d’aides.',
    inclus: [
      { label: 'État initial du bien', detail: 'Enveloppe, systèmes, ventilation, déperditions.' },
      { label: 'Scénarios de travaux', detail: 'Les scénarios prévus par la mission pour améliorer la performance énergétique.' },
      { label: 'Évaluations énergétiques', detail: 'Performance attendue pour chaque scénario.' },
      { label: 'Estimations de coûts', detail: 'Montants indicatifs, qui ne remplacent pas des devis d’entreprises.' },
    ],
    prixTitle: 'Un devis précisant le périmètre et le délai',
    prixText: `Audit de ${AUDIT_FROM} à ${AUDIT_TO}&nbsp;€ TTC selon le bien. Le prix, le périmètre et le délai de remise sont confirmés avant l’intervention. L’audit n’est pas inclus automatiquement dans un pack diagnostics.`,
    prixTo: AUDIT_TO,
    blocs: [
      { h: 'Quand l’audit réglementaire est-il nécessaire ?', p: 'En métropole, la vente de maisons individuelles ou d’immeubles d’habitation en monopropriété classés E, F ou G peut nécessiter un audit énergétique réglementaire. Cette obligation ne vise pas indistinctement chaque appartement en copropriété. Nous vérifions le type de bien et le périmètre de la mission.' },
      { h: 'Un professionnel habilité pour la mission', p: 'La qualification de l’intervenant doit correspondre au type de bâtiment et d’audit demandé. Nous précisons ces éléments avant de confirmer l’intervention.' },
    ],
    processTitle: 'Vos démarches en trois étapes',
    processText: 'Nous précisons la mission, son périmètre et le délai de remise dans le devis, avant l’intervention.',
    processStep3: 'L’audit est réalisé selon la mission convenue. Le délai de remise de l’audit est confirmé dans votre devis.',
    formTitle: 'Préparez votre demande d’audit',
    formIntro: 'Indiquez le type de bien, sa surface et votre projet. Nous vous recontactons pour préciser la mission et établir le devis.',
    liens: [
      { href: '/dpe', label: 'DPE seul' },
      { href: '/diagnostics-vente', label: 'Diagnostics pour vendre' },
      { href: '/guides/reforme-dpe', label: 'Guide : les évolutions du DPE' },
    ],
    faq: [
      {
        q: 'Quelle différence entre le DPE et l’audit ?',
        a: 'Le DPE évalue la performance du logement. L’audit étudie des propositions de rénovation avec des évaluations et des coûts indicatifs.',
      },
      {
        q: 'L’audit est-il remis sous 24 h ?',
        a: 'Le délai propre à votre audit est confirmé dans le devis. Le délai annoncé pour un DPE ou un pack de diagnostics ne s’applique pas automatiquement à l’audit.',
      },
      {
        q: 'L’audit garantit-il une aide ou une économie ?',
        a: 'Non. Les aides dépendent de conditions d’éligibilité et les économies réelles dépendent notamment des travaux, du bâtiment et des usages.',
      },
      {
        q: 'Dois-je accepter une entreprise de travaux ?',
        a: 'L’audit ne vous oblige pas à commander les travaux auprès d’une entreprise déterminée. Le périmètre du conseil et les éventuels liens d’intérêt doivent être expliqués.',
      },
    ],
  },
];

export function getOffer(slug: string): Offer | undefined {
  return OFFERS.find((o) => o.slug === slug);
}
