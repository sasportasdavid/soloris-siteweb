/**
 * Diagnostics à l'unité — hub « Tous les diagnostics » + page par diagnostic
 * (/diagnostics/{slug}). Slugs additifs, aucun slug existant touché.
 *
 * Textes : dossier éditorial V2 (oct. 2026). Prix = grille Soloris (add-ons) lus
 * dans `ADDON_PRICE` (src/lib/pricing.ts) — aucune valeur en dur ici :
 *   amiante · plomb · électricité + gaz (prestation COMBINÉE, pas deux prix à l'unité)
 *   · état des risques (inclus dans les packs) · Carrez/Boutin.
 *   ⚠️ Termites : PAS de prix dans la grille → « sur devis », aucun prix inventé.
 *
 * `ready` contrôle la GÉNÉRATION de la page dédiée.
 */
import { ADDON_PRICE } from './pricing';

export interface Diagnostic {
  slug: string;
  name: string;
  nav: string; // libellé court (menu/hub)
  title: string;
  metaDesc: string;
  h1: string;
  tagline: string; // sous-titre hero
  priceLabel: string; // ex. « dès 90 € », « 30 € · inclus dans les packs », « sur devis » (menu, hub, JSON-LD)
  prixVisible: string; // montant affiché sur la fiche
  prixCond: string; // conditions affichées au plus près du montant
  /** Nom de l'offre dans les données structurées lorsque le prix porte sur une prestation combinée. */
  offerName?: string;
  intro: string;
  when: string[]; // quand le prévoir
  inPack: ('vente' | 'location')[]; // packs qui peuvent l'inclure
  faq: { q: string; a: string }[];
  /** Identifiants de sources officielles (src/lib/sources.ts). */
  sources: string[];
  ready: boolean; // page dédiée générée ?
  image?: string; // photo d'en-tête (fiche 2 colonnes)
  imageAlt?: string;
  diptych?: boolean; // affiche le diptyque mesurage (mesurage-laser + plan-tablette)
}

const ELEC_GAZ = 'Prestation combinée électricité + gaz';

export const DIAGNOSTICS: Diagnostic[] = [
  {
    slug: 'amiante',
    name: 'Amiante',
    nav: 'Amiante',
    title: 'Diagnostic amiante à Paris et en IDF | Soloris',
    metaDesc:
      `Diagnostic amiante avant vente à Paris et en Île-de-France. Permis avant juillet 1997 : vérifiez votre situation. Dès ${ADDON_PRICE.amiante} € TTC selon le bien.`,
    h1: 'Diagnostic amiante avant vente',
    tagline: 'Vérifiez les matériaux concernés et préparez le constat à remettre à l’acquéreur.',
    priceLabel: `dès ${ADDON_PRICE.amiante} €`,
    prixVisible: `Dès ${ADDON_PRICE.amiante} € TTC`,
    prixCond: 'Tarif selon le bien et le périmètre, déplacement inclus. Les éventuels prélèvements, analyses ou missions spécifiques doivent être précisés au devis avant intervention.',
    intro:
      'Le constat amiante avant vente concerne les immeubles dont le permis de construire a été délivré avant le 1er juillet 1997. Il porte sur le repérage prévu pour cette mission ; il ne remplace pas un repérage avant travaux ou démolition.',
    when: [
      'Vente d’un bien concerné par le critère du permis de construire antérieur au 1ᵉʳ juillet 1997.',
      'Vérification du rapport existant, de sa date et de son périmètre avant de le réutiliser.',
    ],
    inPack: ['vente'],
    faq: [
      { q: 'Mon logement a plus de 15 ans : faut-il un diagnostic amiante ?', a: 'L’âge de 15 ans n’est pas le critère de l’amiante. Le point à vérifier est la date de délivrance du permis de construire, avant le 1er juillet 1997.' },
      { q: 'Puis-je utiliser mon ancien constat ?', a: 'Un constat réalisé avant le 1er avril 2013 doit être renouvelé pour une vente. Pour un constat plus récent, sa réutilisation dépend notamment de ses conclusions, du périmètre et des modifications du bien ; transmettez-le pour vérification.' },
      { q: 'Le diagnostic de vente suffit-il avant des travaux ?', a: 'Non. Le repérage avant travaux ou démolition répond à une mission spécifique. Précisez votre projet pour que le bon périmètre soit défini.' },
    ],
    sources: ['R03', 'R14'],
    ready: true,
  },
  {
    slug: 'plomb',
    name: 'Plomb (CREP)',
    nav: 'Plomb (CREP)',
    title: 'Diagnostic plomb CREP à Paris et en IDF | Soloris',
    metaDesc:
      `CREP pour les logements construits avant 1949, en vente ou location. Diagnostic plomb dès ${ADDON_PRICE.plomb} € TTC selon le bien, déplacement inclus.`,
    h1: 'Diagnostic plomb : le CREP de votre logement',
    tagline: 'Pour les logements anciens, un constat sur le plomb présent dans les revêtements.',
    priceLabel: `dès ${ADDON_PRICE.plomb} €`,
    prixVisible: `Dès ${ADDON_PRICE.plomb} € TTC`,
    prixCond: 'Tarif selon le logement et le périmètre, déplacement inclus. Le CREP peut être regroupé avec les autres diagnostics nécessaires à votre vente ou location.',
    intro:
      'Le constat de risque d’exposition au plomb recherche le plomb dans les revêtements du logement. Il concerne la vente ou la location des logements construits avant le 1er janvier 1949. Le rapport décrit les résultats et les situations nécessitant une attention particulière.',
    when: [
      'Vente ou location d’un logement construit avant le 1ᵉʳ janvier 1949.',
      'Examen du CREP disponible, de sa date et de ses conclusions avant une nouvelle commande.',
    ],
    inPack: ['vente', 'location'],
    faq: [
      { q: 'Le CREP est-il nécessaire pour un logement récent ?', a: 'Le critère de l’obligation en vente ou location est une construction antérieure au 1er janvier 1949. Un projet de travaux peut relever d’une autre mission.' },
      { q: 'Combien de temps le rapport reste-t-il utilisable ?', a: 'La durée dépend de la transaction et des résultats du constat. Nous examinons la date et les conclusions de votre rapport avant de recommander un renouvellement.' },
      { q: 'Peut-il être réalisé avec mon DPE ?', a: 'Les prestations nécessaires et prévues au devis peuvent être organisées lors du même rendez-vous.' },
    ],
    sources: ['R02', 'R10', 'R01'],
    ready: true,
  },
  {
    slug: 'electricite',
    name: 'Électricité',
    nav: 'Électricité',
    title: 'Diagnostic électricité à Paris et en IDF | Soloris',
    metaDesc:
      'Diagnostic électricité pour vendre ou louer un logement avec une installation de plus de 15 ans. Périmètre et tarif confirmés avant la visite.',
    h1: 'Diagnostic de votre installation électrique',
    tagline: 'Identifiez les anomalies de sécurité à signaler lors de la vente ou de la location.',
    priceLabel: `${ADDON_PRICE.elec_gaz} € (électricité + gaz)`,
    prixVisible: `${ADDON_PRICE.elec_gaz} € TTC pour la prestation électricité + gaz`,
    prixCond: 'Ce montant concerne la prestation combinée, déplacement inclus. Pour l’électricité seule ou l’intégration dans un pack, contactez-nous pour confirmer le périmètre et le prix.',
    offerName: ELEC_GAZ,
    intro:
      'Le diagnostic électricité évalue l’état de l’installation intérieure dans le cadre de la vente ou de la location. Il concerne les installations de plus de 15 ans. Il ne constitue ni une rénovation de l’installation ni une attestation générale de conformité à toutes les normes actuelles.',
    when: [
      'Vente ou location d’un logement dont l’installation intérieure d’électricité a plus de 15 ans.',
      'Vérification des documents existants et des éventuelles équivalences avant de commander.',
    ],
    inPack: ['vente', 'location'],
    faq: [
      { q: 'Le critère porte-t-il sur l’âge du bâtiment ?', a: 'Non : pour ce diagnostic, c’est l’ancienneté de l’installation intérieure d’électricité qui compte.' },
      { q: `Le prix de ${ADDON_PRICE.elec_gaz} € concerne-t-il uniquement l’électricité ?`, a: 'Non. Le tarif présenté correspond à la prestation combinée électricité et gaz. Une demande à l’unité doit être précisée au devis.' },
      { q: 'Quelle est la durée de validité ?', a: 'Le diagnostic électricité est valable 3 ans pour une vente et 6 ans pour une location, sous réserve de la situation du dossier.' },
    ],
    sources: ['R04'],
    ready: true,
    image: '/images/diagnostic-electricite.webp',
    imageAlt: "Contrôle d'un tableau électrique",
  },
  {
    slug: 'gaz',
    name: 'Gaz',
    nav: 'Gaz',
    title: 'Diagnostic gaz à Paris et en Île-de-France | Soloris',
    metaDesc:
      'Diagnostic gaz pour vendre ou louer un logement avec une installation de plus de 15 ans. Un contrôle sur place, avec tarif confirmé au devis.',
    h1: 'Diagnostic de votre installation de gaz',
    tagline: 'Faites vérifier l’installation intérieure concernée avant de vendre ou de louer.',
    priceLabel: `${ADDON_PRICE.elec_gaz} € (électricité + gaz)`,
    prixVisible: `${ADDON_PRICE.elec_gaz} € TTC pour la prestation gaz + électricité`,
    prixCond: 'Ce montant concerne la prestation combinée, déplacement inclus. Pour le gaz seul ou l’intégration dans un pack, nous confirmons le périmètre et le prix au devis.',
    offerName: ELEC_GAZ,
    intro:
      'Le diagnostic gaz évalue l’état de l’installation intérieure de gaz dans le cadre de la vente ou de la location. Il concerne les installations de plus de 15 ans. Cette prestation ne se confond pas avec l’entretien d’une chaudière.',
    when: [
      'Vente ou location d’un logement dont l’installation intérieure de gaz a plus de 15 ans.',
      'Prise en compte des justificatifs et rapports déjà disponibles.',
    ],
    inPack: ['vente', 'location'],
    faq: [
      { q: 'L’entretien de ma chaudière remplace-t-il le diagnostic gaz ?', a: 'L’entretien et le diagnostic gaz n’ont pas le même objet. Transmettez vos documents pour vérifier lesquels répondent à votre situation.' },
      { q: 'Le diagnostic concerne-t-il tout logement équipé d’un appareil au gaz ?', a: 'L’obligation dépend notamment de l’installation intérieure et de son ancienneté. Nous vérifions le périmètre concerné avant la visite.' },
      { q: `Le prix de ${ADDON_PRICE.elec_gaz} € est-il un prix gaz seul ?`, a: 'Non. Il correspond à la prestation combinée gaz et électricité.' },
    ],
    sources: ['R02', 'R10'],
    ready: true,
    // Pas de photo : l'ancien visuel montrait un tableau électrique, sans rapport avec le gaz.
    // À remplacer uniquement par un visuel pertinent et autorisé.
  },
  {
    slug: 'termites',
    name: 'Termites',
    nav: 'Termites',
    title: 'Diagnostic termites à Paris et en IDF | Soloris',
    metaDesc:
      'Vente immobilière : vérifiez si votre bien est dans une zone concernée par le diagnostic termites. Intervention à Paris et en IDF, sur devis.',
    h1: 'Diagnostic termites pour votre vente',
    tagline: 'Un contrôle à prévoir lorsque votre bien se situe dans une zone réglementée.',
    priceLabel: 'sur devis',
    prixVisible: 'Sur devis',
    prixCond: 'Le prix dépend du bien et de la mission. Aucun tarif termites forfaitaire n’est annoncé dans notre grille publique.',
    intro:
      'L’état relatif à la présence de termites concerne la vente de biens situés dans les zones délimitées par arrêté préfectoral. Le périmètre applicable doit être vérifié à l’adresse du bien ; la présence d’une page locale ne suffit pas à établir l’obligation.',
    when: [
      'Vente d’un bien situé dans une zone définie par l’arrêté préfectoral applicable.',
      'Vérification de la date de signature pour disposer d’un état utilisable au bon moment.',
    ],
    inPack: ['vente'],
    faq: [
      { q: 'Est-il obligatoire dans toute l’Île-de-France ?', a: 'Non. L’obligation dépend des zones définies par les arrêtés applicables. L’adresse du bien est vérifiée avant la mission.' },
      { q: 'Quelle est la durée de validité ?', a: 'L’état relatif aux termites a une durée de validité maximale de 6 mois. Sa date doit être vérifiée par rapport à la signature prévue.' },
      { q: 'Ce diagnostic couvre-t-il tous les parasites du bâtiment ?', a: 'Il ne faut pas le confondre avec une expertise générale de tous les parasites ou désordres du bâtiment. Le périmètre de la mission est précisé au devis.' },
    ],
    sources: ['R12'],
    ready: true,
  },
  {
    slug: 'loi-carrez',
    name: 'Loi Carrez',
    nav: 'Mesurage Loi Carrez',
    title: 'Mesurage Loi Carrez à Paris et en IDF | Soloris',
    metaDesc:
      `Vente en copropriété : faites mesurer la superficie privative de votre lot. Mesurage Carrez dès ${ADDON_PRICE.carrez_boutin} € TTC selon le bien, déplacement inclus.`,
    h1: 'La superficie Carrez de votre lot en copropriété',
    tagline: 'Une mesure de la surface privative à communiquer pour les ventes concernées.',
    priceLabel: `dès ${ADDON_PRICE.carrez_boutin} €`,
    prixVisible: `Dès ${ADDON_PRICE.carrez_boutin} € TTC`,
    prixCond: 'Tarif selon le bien, déplacement inclus. Le mesurage peut être intégré au pack vente lorsque le lot est concerné.',
    intro:
      'La superficie Carrez correspond à une définition précise de la surface privative des lots concernés en copropriété. Elle ne se confond pas avec la surface habitable ou une surface approximative utilisée pour demander un devis. Certaines catégories de lots sont exclues : le périmètre doit être vérifié.',
    when: [
      'Vente d’un lot de copropriété entrant dans le champ de la loi Carrez.',
      'Vérification du mesurage disponible, particulièrement après une modification de la configuration du lot.',
    ],
    inPack: ['vente'],
    faq: [
      { q: 'Carrez et surface habitable sont-elles identiques ?', a: 'Non. Les règles de calcul et le périmètre pris en compte diffèrent. Il faut utiliser la surface correspondant à la transaction et au document demandé.' },
      { q: 'Tous les lots de copropriété sont-ils concernés ?', a: 'Non. Des exclusions existent, notamment pour certaines annexes et certains petits lots. Nous vérifions la situation du lot avant la mission.' },
      { q: 'Puis-je reprendre le mesurage précédent ?', a: 'Sa réutilisation doit être examinée si le périmètre ou la configuration a changé. Transmettez le document existant pour vérification.' },
    ],
    sources: ['R02'],
    ready: true,
    diptych: true,
  },
  {
    slug: 'loi-boutin',
    name: 'Loi Boutin',
    nav: 'Mesurage Loi Boutin',
    title: 'Mesurage Loi Boutin à Paris et en IDF | Soloris',
    metaDesc:
      `Location : faites mesurer la surface habitable de votre logement. Mesurage dès ${ADDON_PRICE.carrez_boutin} € TTC selon le bien, déplacement inclus à Paris et en IDF.`,
    h1: 'La surface habitable de votre logement à louer',
    tagline: 'Une mesure claire pour renseigner le bail de votre résidence principale louée.',
    priceLabel: `dès ${ADDON_PRICE.carrez_boutin} €`,
    prixVisible: `Dès ${ADDON_PRICE.carrez_boutin} € TTC`,
    prixCond: 'Tarif selon le logement, déplacement inclus. Le mesurage peut être regroupé avec les diagnostics de location prévus au devis.',
    intro:
      'La surface habitable à mentionner dans le bail doit correspondre à sa définition réglementaire. Le mesurage proposé par Soloris permet de la déterminer ; il ne faut pas confondre l’obligation de mentionner une surface exacte avec une obligation générale de commander un mesurage professionnel.',
    when: [
      'Préparation d’un bail de résidence principale, vide ou meublé, avec la surface habitable requise.',
      'Vérification après une modification des pièces ou lorsque les surfaces disponibles sont contradictoires.',
    ],
    inPack: ['location'],
    faq: [
      { q: 'Le sujet concerne-t-il seulement la location vide ?', a: 'La surface habitable fait aussi partie des informations du bail de résidence principale meublée. Le contrat applicable doit être vérifié selon le projet de location.' },
      { q: 'Puis-je utiliser la superficie Carrez ?', a: 'Pas automatiquement : les définitions ne sont pas identiques. Utilisez la surface habitable appropriée au bail.' },
      { q: 'Le mesurage garantit-il que mon logement est louable ?', a: 'Non. La surface n’est qu’un des éléments à considérer ; les autres critères de décence, dont la performance énergétique, restent à vérifier.' },
    ],
    sources: ['R11'],
    ready: true,
    diptych: true,
  },
  {
    slug: 'erp',
    name: 'État des risques (ERP)',
    nav: 'État des risques (ERP)',
    title: 'État des risques ERP à Paris et en IDF | Soloris',
    metaDesc:
      `État des risques pour vendre ou louer : informations liées à l’adresse du bien. ${ADDON_PRICE.erp} € TTC à l’unité, inclus dans les packs vente et location.`,
    h1: 'L’état des risques de votre bien',
    tagline: 'Informez l’acquéreur ou le locataire des risques et informations applicables à l’adresse.',
    priceLabel: `${ADDON_PRICE.erp} € · inclus dans les packs`,
    prixVisible: `${ADDON_PRICE.erp} € TTC à l’unité — inclus dans les packs`,
    prixCond: 'L’état des risques est inclus dans les packs vente et location prévus au devis. Le tarif à l’unité provient de la grille publique.',
    intro:
      'L’état des risques rassemble les informations réglementaires applicables à la situation du bien. Il doit être établi à partir des données pertinentes pour l’adresse et rester à jour au moment de la transaction. Il ne remplace pas une expertise de la structure du bâtiment.',
    when: [
      'Vente ou location d’un bien situé dans un périmètre ou une situation imposant l’information sur les risques.',
      'Vérification et, si nécessaire, actualisation avant les étapes de la transaction.',
    ],
    inPack: ['vente', 'location'],
    faq: [
      { q: 'L’état des risques est-il inclus dans mon pack ?', a: 'Il est inclus dans les packs vente et location ; les prestations de votre dossier sont confirmées au devis.' },
      { q: 'Combien de temps est-il valable ?', a: 'Il doit dater de moins de 6 mois et être actualisé lorsque les informations applicables l’exigent. Sa situation doit être vérifiée aux étapes de la transaction.' },
      { q: 'Une statistique sur la commune suffit-elle ?', a: 'Non. Les informations doivent correspondre au bien et à son adresse, pas seulement à une moyenne communale.' },
    ],
    sources: ['R13'],
    ready: true,
  },
];

export function getDiagnostic(slug: string): Diagnostic | undefined {
  return DIAGNOSTICS.find((d) => d.slug === slug);
}
