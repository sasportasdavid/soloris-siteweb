/**
 * Données des 4 offres Soloris. Source unique pour les cartes home, les pages
 * offres, le menu de navigation et le maillage interne.
 *
 * ⚠️ Conformité : les listes de diagnostics décrivent ce qui PEUT composer un
 * pack selon la situation du bien. La composition exacte dépend de chaque
 * logement (année, énergie, zone) et est confirmée au devis. On n'affirme
 * aucune obligation datée sans marqueur [À VÉRIFIER].
 */
import type { Demande } from './pricing';
import { prixDes, DPE_FROM, DPE_TO, AUDIT_FROM } from './pricing';

export interface Offer {
  slug: string;
  url: string;
  demande: Demande;
  nav: string;
  navDesc: string;
  shortLabel: string; // libellé propre pour « votre … » (titres, CTA)
  h1: string;
  title: string;
  metaDesc: string;
  tagline: string;
  /** CTA héro : si défini, ancre interne (ex. '#qform') pour scroller vers le formulaire
   *  embarqué au lieu de naviguer ; défaut = /devis?type=<demande>. */
  heroCtaHref?: string;
  intro: string;
  // Photo d'intro (optionnelle) — visuel de l'en-tête 2 colonnes
  heroImage?: string;
  heroImageAlt?: string;
  heroImageSide?: 'left' | 'right'; // côté de la photo (défaut : droite)
  introDark?: boolean; // bloc texte sur fond navy (différencie les parcours)
  // « ce qui est inclus / peut être inclus »
  inclus: { label: string; detail: string }[];
  // cadre légal (neutre, vérifiable)
  cadre: string[];
  faq: { q: string; a: string }[];
}

export const OFFERS: Offer[] = [
  {
    slug: 'diagnostics-vente',
    url: '/diagnostics-vente',
    demande: 'vente',
    nav: 'Diagnostics pour vendre',
    navDesc: 'Le pack complet, tout compris, sous 48 h',
    shortLabel: 'dossier de diagnostics pour vendre',
    h1: 'Tous vos diagnostics de vente, prêts pour le notaire — sous 48 h, prix tout compris annoncé d’avance.',
    title: 'Diagnostics pour vendre à Paris & IDF | Soloris',
    metaDesc:
      'Pack diagnostics vente tout compris, rapport opposable sous 48 h à Paris et en Île-de-France. Diagnostiqueur certifié COFRAC. Devis en 2 min.',
    tagline: "Un seul rendez-vous, un prix annoncé d'avance, aucun frais surprise le jour J.",
    // CTA héro : scroll vers le formulaire embarqué (#qform), même tunnel, sans quitter la page.
    heroCtaHref: '#qform',
    intro:
      "Pour vendre, l'acquéreur reçoit un dossier de diagnostic technique (DDT) annexé à la promesse de vente. Soloris réunit l'ensemble des diagnostics requis selon votre bien, en un seul rendez-vous, avec un rapport clair et opposable.",
    heroImage: '/images/vendeur-salon-vide.jpg',
    heroImageAlt: 'Propriétaire dans son appartement parisien, clés en main',
    inclus: [
      { label: 'DPE — Performance énergétique', detail: 'Étiquette A→G, méthode 3CL, opposable.' },
      { label: 'ERP — État des Risques et Pollutions', detail: 'Risques naturels, miniers, technologiques (offert en pack).' },
      { label: 'Amiante', detail: 'Pour les biens dont le permis de construire est antérieur au 1ᵉʳ juillet 1997.' },
      { label: 'Plomb (CREP)', detail: 'Pour les logements construits avant le 1ᵉʳ janvier 1949.' },
      { label: 'Électricité & Gaz', detail: 'Pour les installations de plus de 15 ans.' },
      { label: 'Loi Carrez', detail: 'Mesurage de la surface privative en copropriété.' },
      { label: 'Termites', detail: 'Dans les zones définies par arrêté préfectoral.' },
    ],
    cadre: [
      "Le dossier de diagnostic technique regroupe les diagnostics applicables à votre bien et doit être annexé à la promesse ou à l'acte de vente.",
      "La composition exacte dépend de l'année de construction, du type d'énergie, de la zone géographique et de la nature du bien. Soloris détermine la liste applicable lors de la prise de rendez-vous.",
      'Chaque rapport est établi par un diagnostiqueur certifié et est opposable.',
    ],
    faq: [
      {
        q: 'Quels diagnostics sont nécessaires pour vendre un appartement ?',
        a: "Selon le bien : DPE et ERP, complétés par l'amiante (permis avant le 1ᵉʳ juillet 1997), le plomb (logements avant 1949), l'électricité et le gaz (installations de plus de 15 ans), le mesurage Loi Carrez, et les termites en zone concernée. La liste exacte dépend de l'année de construction et de la localisation — nous la confirmons au devis.",
      },
      {
        q: 'En combien de temps reçois-je le rapport ?',
        a: 'Nous proposons un rendez-vous et la remise du rapport sous 48 h dans la plupart des cas à Paris et en Île-de-France.',
      },
      {
        q: 'Le rapport est-il accepté par le notaire ?',
        a: 'Oui. Les diagnostics sont réalisés par un diagnostiqueur certifié et fournis dans un format opposable, annexable à la promesse de vente.',
      },
      {
        q: 'Combien coûte le pack vente ?',
        a: `À partir de ${prixDes('vente')} € tout compris, déplacement inclus. Le prix dépend de la surface et de l'âge du bien (les diagnostics obligatoires varient) — estimation immédiate via notre formulaire de devis.`,
      },
    ],
  },
  {
    slug: 'diagnostics-location',
    url: '/diagnostics-location',
    demande: 'location',
    nav: 'Diagnostics pour louer',
    navDesc: 'Le pack bailleur, clair et rapide',
    shortLabel: 'dossier de diagnostics pour louer',
    h1: 'Diagnostics location à Paris & Île-de-France',
    title: 'Diagnostics location (pack bailleur) Paris & IDF | Soloris',
    metaDesc:
      'Pack diagnostics location tout compris pour bailleurs, sous 48 h à Paris et en Île-de-France. Rapport clair, diagnostiqueur certifié COFRAC. Devis en 2 min.',
    tagline: "Préparez votre mise en location avec les diagnostics obligatoires : tarif clair, intervention rapide et rapport sous 48 h.",
    intro:
      "Avant de louer, certains diagnostics doivent être annexés au bail. Soloris réunit le pack bailleur applicable à votre logement, avec un rapport lisible que vous pouvez transmettre directement à votre locataire ou à votre agence.",
    heroImage: '/images/salon-meuble.jpg',
    heroImageAlt: "Salon meublé d'un appartement à louer",
    heroImageSide: 'left',
    introDark: true,
    inclus: [
      { label: 'DPE — Performance énergétique', detail: 'Étiquette A→G, opposable, annexé au bail.' },
      { label: 'ERP — État des Risques et Pollutions', detail: 'Offert en pack.' },
      { label: 'Plomb (CREP)', detail: 'Pour les logements construits avant le 1ᵉʳ janvier 1949.' },
      { label: 'Électricité & Gaz', detail: 'Pour les installations de plus de 15 ans.' },
      { label: 'Surface habitable (Loi Boutin)', detail: 'Mesurage de la surface habitable pour le bail.' },
      { label: 'Amiante', detail: "Constat amiante des parties privatives, tenu à disposition du locataire selon l'année du bien." },
    ],
    cadre: [
      "Plusieurs diagnostics doivent être annexés au contrat de location (bail), notamment le DPE et l'ERP, complétés selon l'âge et la nature du logement.",
      "Au titre de la loi Climat et résilience, les logements les plus énergivores sont progressivement interdits à la location : classe G depuis le 1ᵉʳ janvier 2025, classe F au 1ᵉʳ janvier 2028, classe E au 1ᵉʳ janvier 2034 (France métropolitaine).",
      "La liste applicable dépend de l'année de construction, de l'énergie et de la zone. Soloris la détermine à la prise de rendez-vous.",
    ],
    faq: [
      {
        q: 'Quels diagnostics dois-je fournir pour louer ?',
        a: "Généralement : DPE et ERP, complétés selon le bien par le CREP (plomb, logements avant 1949), les diagnostics électricité/gaz (installations de plus de 15 ans) et le mesurage Loi Boutin. La liste exacte est confirmée au devis.",
      },
      {
        q: 'Quels logements sont interdits à la location ?',
        a: "Depuis le 1ᵉʳ janvier 2025, les logements classés G sont considérés comme indécents et ne peuvent plus être proposés à la location (baux signés, renouvelés ou tacitement reconduits). Suivront la classe F au 1ᵉʳ janvier 2028 et la classe E au 1ᵉʳ janvier 2034 (métropole).",
      },
      {
        q: 'Le DPE est-il obligatoire pour une location ?',
        a: "Oui, le DPE doit être annexé au bail. Sa durée de validité est de 10 ans. À noter : les DPE réalisés avant le 1ᵉʳ juillet 2021 ne sont plus valides depuis le 1ᵉʳ janvier 2025.",
      },
      {
        q: 'Quel est le délai pour le pack location ?',
        a: 'Rendez-vous et rapport sous 48 h dans la plupart des cas à Paris et en Île-de-France.',
      },
      {
        q: 'Combien coûte le pack location ?',
        a: `À partir de ${prixDes('location')} € tout compris, déplacement inclus. Le prix dépend de la surface et de l'âge du bien — estimation immédiate via le formulaire de devis.`,
      },
    ],
  },
  {
    slug: 'dpe',
    url: '/dpe',
    demande: 'dpe',
    nav: 'DPE seul',
    navDesc: 'Rapide, sous 48 h',
    shortLabel: 'DPE',
    h1: `DPE à Paris & Île-de-France dès ${DPE_FROM} €`,
    title: `DPE Paris & Île-de-France dès ${DPE_FROM} € | Soloris`,
    metaDesc:
      `Faites réaliser votre DPE dès ${DPE_FROM} € par un diagnostiqueur certifié. Rendez-vous rapide, prix clair, rapport sous 48 h à Paris et en Île-de-France.`,
    tagline: "Faites réaliser votre diagnostic de performance énergétique par un diagnostiqueur certifié, avec rapport transmis sous 48 h.",
    intro:
      "Le DPE évalue la performance énergétique de votre logement et lui attribue une étiquette de A à G. Soloris le réalise rapidement et vous remet un rapport pédagogique : vous comprenez votre étiquette et les pistes d'amélioration, sans jargon.",
    inclus: [
      { label: 'Visite et relevés sur place', detail: 'Mesures et caractéristiques du logement.' },
      { label: 'Calcul méthode 3CL-DPE', detail: 'Méthode réglementaire, résultat opposable.' },
      { label: 'Étiquette énergie A→G', detail: "Énergie et climat (émissions de gaz à effet de serre)." },
      { label: 'Rapport pédagogique', detail: "Lecture claire et pistes d'amélioration, sans promesse de résultat." },
    ],
    cadre: [
      "Le DPE est un diagnostic réglementé, réalisé selon la méthode 3CL et opposable. Sa durée de validité est de 10 ans (les DPE réalisés avant le 1ᵉʳ juillet 2021 ne sont plus valides depuis le 1ᵉʳ janvier 2025).",
      "Au 1ᵉʳ janvier 2026, le coefficient de conversion de l'électricité utilisé dans le calcul du DPE passe de 2,3 à 1,9 (arrêté du 13 août 2025) : certains logements peuvent gagner une classe sans travaux. Les DPE édités avant 2026 restent valables et peuvent être mis à jour gratuitement via l'Observatoire DPE de l'ADEME.",
      'Soloris ne promet jamais un résultat : le diagnostic reflète l\'état réel du logement. Notre rôle est de le mesurer rigoureusement et de vous l\'expliquer.',
    ],
    faq: [
      {
        q: "Combien de temps est valable un DPE ?",
        a: "Un DPE est valable 10 ans. Les DPE réalisés avant le 1ᵉʳ juillet 2021 ne sont toutefois plus valides depuis le 1ᵉʳ janvier 2025.",
      },
      {
        q: 'Quel est le prix d\'un DPE ?',
        a: `À partir de ${DPE_FROM} € tout compris, déplacement inclus. Le prix varie selon la surface (${DPE_FROM} à ${DPE_TO} €). Estimation immédiate via le formulaire.`,
      },
      {
        q: 'Pouvez-vous me garantir une bonne étiquette ?',
        a: "Non, et c'est une question de déontologie. Le DPE mesure la performance réelle du logement. Nous garantissons un diagnostic rigoureux et un rapport clair — jamais un résultat.",
      },
      {
        q: 'Intervenez-vous rapidement ?',
        a: 'Oui : rendez-vous et rapport sous 48 h dans la plupart des cas à Paris et en Île-de-France.',
      },
    ],
  },
  {
    slug: 'audit-energetique',
    url: '/audit-energetique',
    demande: 'audit',
    nav: 'Audit énergétique',
    navDesc: "Pour les logements énergivores",
    shortLabel: 'audit énergétique',
    h1: 'Audit énergétique réglementaire à Paris & Île-de-France',
    title: 'Audit énergétique réglementaire Paris & IDF | Soloris',
    metaDesc:
      "Audit énergétique réglementaire pour logements classés E, F ou G à Paris et en Île-de-France. Scénarios de travaux chiffrés, expert certifié. Devis en 2 min.",
    tagline: "Vous vendez une maison ou un immeuble en monopropriété classé E, F ou G ? Vérifiez si l'audit énergétique est obligatoire pour votre vente.",
    intro:
      "L'audit énergétique va plus loin que le DPE : il dresse un état des lieux complet et propose des scénarios de travaux hiérarchisés pour améliorer la performance du logement. Soloris vous le restitue sans jargon, avec des ordres de grandeur clairs.",
    inclus: [
      { label: 'État des lieux énergétique complet', detail: 'Enveloppe, systèmes, ventilation, déperditions.' },
      { label: 'Scénarios de travaux hiérarchisés', detail: 'Plusieurs étapes pour progresser dans le classement énergétique.' },
      { label: 'Estimation des gains', detail: "Ordres de grandeur d'économies d'énergie attendues." },
      { label: 'Restitution pédagogique', detail: "Conseil sur les priorités, sans engagement commercial sur des travaux." },
    ],
    cadre: [
      "L'audit énergétique réglementaire est obligatoire pour la vente d'un logement individuel ou d'un immeuble en monopropriété énergivore. En France métropolitaine, il s'applique aux classes F et G depuis le 1ᵉʳ avril 2023, à la classe E depuis le 1ᵉʳ janvier 2025, et concernera la classe D à partir du 1ᵉʳ janvier 2034.",
      "Il propose des scénarios de travaux d'amélioration au futur acquéreur et est valable 5 ans. Soloris le réalise selon le cadre méthodologique applicable et reste neutre : nous ne vendons pas les travaux que nous recommandons.",
    ],
    faq: [
      {
        q: 'Quand un audit énergétique est-il obligatoire ?',
        a: "Pour la vente d'un logement en monopropriété, l'audit énergétique réglementaire est obligatoire pour les classes F et G depuis le 1ᵉʳ avril 2023, la classe E depuis le 1ᵉʳ janvier 2025, et la classe D à partir du 1ᵉʳ janvier 2034 (métropole). Nous vérifions votre situation au devis.",
      },
      {
        q: 'Quelle différence avec le DPE ?',
        a: "Le DPE mesure et classe la performance. L'audit va plus loin : il propose un parcours de travaux hiérarchisé pour améliorer cette performance.",
      },
      {
        q: "Combien coûte un audit énergétique ?",
        a: `À partir d'environ ${AUDIT_FROM} € tout compris, déplacement inclus, selon le bien. Estimation indicative via le formulaire de devis.`,
      },
      {
        q: 'Vendez-vous les travaux que vous préconisez ?',
        a: "Non. Notre rôle est l'expertise et le conseil neutre. Vous restez libre de choisir vos artisans.",
      },
    ],
  },
];

export function getOffer(slug: string): Offer | undefined {
  return OFFERS.find((o) => o.slug === slug);
}
