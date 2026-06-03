/**
 * Diagnostics à l'unité — hub « Tous les diagnostics » + page par diagnostic
 * (/diagnostics/{slug}). Slugs additifs, aucun slug existant touché.
 *
 * Prix = grille Soloris (add-ons) :
 *   amiante 90 € · plomb 130 € · électricité+gaz (combo) 190 € · ERP 30 € (offert
 *   en pack) · Carrez/Boutin 70 €. ⚠️ Termites : PAS de prix dans la grille → « sur
 *   devis », aucun prix inventé.
 *
 * `ready` contrôle la GÉNÉRATION de la page dédiée (phase de validation : on
 * publie d'abord le hub + 2 pages types, puis on passe les autres à true).
 */
export interface Diagnostic {
  slug: string;
  name: string;
  nav: string; // libellé court (menu/hub)
  title: string;
  metaDesc: string;
  h1: string;
  tagline: string; // sous-titre hero
  priceLabel: string; // ex. « dès 90 € », « 30 € · offert en pack », « sur devis »
  intro: string;
  when: string[]; // quand c'est requis (vente / location / travaux)
  inPack: ('vente' | 'location')[]; // packs qui l'incluent
  faq: { q: string; a: string }[];
  ready: boolean; // page dédiée générée ?
}

export const DIAGNOSTICS: Diagnostic[] = [
  {
    slug: 'amiante',
    name: 'Amiante',
    nav: 'Amiante',
    title: 'Diagnostic amiante à Paris & Île-de-France | Soloris',
    metaDesc:
      "Diagnostic amiante pour la vente : repérage des matériaux amiantés (permis avant juillet 1997). Tarif tout compris dès 90 €, certifié COFRAC.",
    h1: 'Diagnostic amiante',
    tagline: 'Le repérage des matériaux susceptibles de contenir de l’amiante.',
    priceLabel: 'dès 90 €',
    intro:
      "Le diagnostic amiante repère la présence de matériaux et produits susceptibles de contenir de l'amiante dans le logement. Il protège l'acquéreur comme l'occupant et figure au dossier de diagnostic technique.",
    when: [
      'À la vente, pour les biens dont le permis de construire a été délivré avant le 1ᵉʳ juillet 1997.',
      'En location, un constat amiante des parties privatives est tenu à la disposition du locataire selon l’année du bien.',
      'Avant certains travaux ou une démolition (repérage spécifique).',
    ],
    inPack: ['vente'],
    faq: [
      { q: 'Quand le diagnostic amiante est-il obligatoire ?', a: "À la vente, pour les logements dont le permis de construire est antérieur au 1ᵉʳ juillet 1997. Nous vérifions votre situation au devis." },
      { q: 'Combien coûte un diagnostic amiante ?', a: 'Dès 90 € tout compris, déplacement inclus. Il est généralement réalisé avec les autres diagnostics du pack vente.' },
      { q: 'Quelle est sa durée de validité ?', a: "Lorsqu'aucune trace d'amiante n'est repérée, le constat n'a pas à être renouvelé pour une vente. En présence d'amiante, des contrôles périodiques peuvent s'appliquer." },
    ],
    ready: true,
  },
  {
    slug: 'plomb',
    name: 'Plomb (CREP)',
    nav: 'Plomb (CREP)',
    title: 'Diagnostic plomb (CREP) à Paris & Île-de-France | Soloris',
    metaDesc:
      'Constat de risque d’exposition au plomb (CREP) pour les logements avant 1949, vente et location. Tarif tout compris dès 130 €, certifié COFRAC.',
    h1: 'Diagnostic plomb (CREP)',
    tagline: 'Le constat de risque d’exposition au plomb, pour les logements anciens.',
    priceLabel: 'dès 130 €',
    intro:
      "Le CREP (Constat de Risque d'Exposition au Plomb) recherche la présence de plomb dans les revêtements, principalement les anciennes peintures. Il vise à protéger les occupants, notamment les jeunes enfants.",
    when: [
      'À la vente et à la location, pour les logements construits avant le 1ᵉʳ janvier 1949.',
      'Avant certains travaux dans les parties concernées.',
    ],
    inPack: ['vente', 'location'],
    faq: [
      { q: 'Quels logements sont concernés par le CREP ?', a: 'Les logements dont la construction est antérieure au 1ᵉʳ janvier 1949, en vente comme en location.' },
      { q: 'Combien coûte un diagnostic plomb ?', a: 'Dès 130 € tout compris, déplacement inclus. Il s’intègre au pack vente ou location selon votre projet.' },
      { q: 'Quelle validité ?', a: "Pour une vente, le CREP est valable 1 an s'il révèle la présence de plomb ; il est sans limite de durée s'il est négatif. Pour une location, les durées peuvent différer. Nous faisons le point au devis." },
    ],
    ready: true,
  },
  {
    slug: 'electricite',
    name: 'Électricité',
    nav: 'Électricité',
    title: 'Diagnostic électricité à Paris & Île-de-France | Soloris',
    metaDesc:
      "Diagnostic électricité pour les installations de plus de 15 ans, vente et location. Réalisé avec le gaz (190 € le combo), certifié COFRAC.",
    h1: 'Diagnostic électricité',
    tagline: 'L’état de l’installation intérieure d’électricité.',
    priceLabel: '190 € (électricité + gaz)',
    intro:
      "Le diagnostic électricité évalue la sécurité de l'installation intérieure d'électricité du logement. Il est le plus souvent réalisé en même temps que le diagnostic gaz.",
    when: [
      'À la vente et à la location, lorsque l’installation a plus de 15 ans.',
    ],
    inPack: ['vente', 'location'],
    faq: [
      { q: 'Quand le diagnostic électricité est-il requis ?', a: 'À la vente et à la location, pour les installations de plus de 15 ans.' },
      { q: 'Combien coûte-t-il ?', a: "Électricité et gaz sont réalisés ensemble : 190 € tout compris pour le combo, déplacement inclus." },
    ],
    ready: true,
  },
  {
    slug: 'gaz',
    name: 'Gaz',
    nav: 'Gaz',
    title: 'Diagnostic gaz à Paris & Île-de-France | Soloris',
    metaDesc:
      'Diagnostic gaz pour les installations de plus de 15 ans, vente et location. Réalisé avec l’électricité (190 € le combo), certifié COFRAC.',
    h1: 'Diagnostic gaz',
    tagline: 'L’état de l’installation intérieure de gaz.',
    priceLabel: '190 € (électricité + gaz)',
    intro:
      "Le diagnostic gaz évalue la sécurité de l'installation intérieure de gaz du logement. Il est généralement réalisé conjointement avec le diagnostic électricité.",
    when: [
      'À la vente et à la location, lorsque l’installation a plus de 15 ans.',
    ],
    inPack: ['vente', 'location'],
    faq: [
      { q: 'Quand le diagnostic gaz est-il requis ?', a: 'À la vente et à la location, pour les installations de plus de 15 ans.' },
      { q: 'Combien coûte-t-il ?', a: 'Gaz et électricité sont réalisés ensemble : 190 € tout compris pour le combo, déplacement inclus.' },
    ],
    ready: true,
  },
  {
    slug: 'termites',
    name: 'Termites',
    nav: 'Termites',
    title: 'Diagnostic termites / état parasitaire | Soloris',
    metaDesc:
      'Diagnostic termites (état parasitaire) à la vente, dans les zones définies par arrêté préfectoral à Paris et en Île-de-France. Sur devis, certifié COFRAC.',
    h1: 'Diagnostic termites',
    tagline: 'La recherche de termites, dans les zones concernées.',
    priceLabel: 'sur devis',
    intro:
      "Le diagnostic termites recherche la présence de termites et, plus largement, l'état parasitaire du bâti. Il s'applique dans les communes classées par arrêté préfectoral.",
    when: [
      'À la vente, dans les zones délimitées par arrêté préfectoral.',
    ],
    inPack: ['vente'],
    faq: [
      { q: 'Le diagnostic termites est-il obligatoire partout ?', a: "Non : uniquement dans les communes classées par arrêté préfectoral. Nous vérifions si votre bien est concerné au moment du devis." },
      { q: 'Combien coûte-t-il ?', a: 'Sur devis, selon votre bien et votre secteur. Demandez votre estimation, c’est sans engagement.' },
    ],
    ready: true,
  },
  {
    slug: 'loi-carrez',
    name: 'Loi Carrez',
    nav: 'Mesurage Loi Carrez',
    title: 'Mesurage Loi Carrez à Paris & Île-de-France | Soloris',
    metaDesc:
      'Mesurage Loi Carrez : surface privative d’un lot de copropriété pour la vente. Tarif tout compris dès 70 €, certifié COFRAC.',
    h1: 'Mesurage Loi Carrez',
    tagline: 'La surface privative d’un lot en copropriété, pour la vente.',
    priceLabel: 'dès 70 €',
    intro:
      "Le mesurage Loi Carrez détermine la surface privative d'un lot de copropriété. Cette superficie doit figurer dans l'acte de vente : une erreur peut avoir des conséquences sur la transaction.",
    when: [
      'À la vente d’un lot de copropriété (appartement, etc.).',
    ],
    inPack: ['vente'],
    faq: [
      { q: 'La Loi Carrez est-elle obligatoire pour vendre ?', a: 'Oui, pour la vente d’un lot de copropriété : la surface privative doit être mentionnée dans l’acte.' },
      { q: 'Combien coûte le mesurage ?', a: 'Dès 70 € tout compris, déplacement inclus.' },
    ],
    ready: true,
  },
  {
    slug: 'loi-boutin',
    name: 'Loi Boutin',
    nav: 'Mesurage Loi Boutin',
    title: 'Mesurage Loi Boutin à Paris & Île-de-France | Soloris',
    metaDesc:
      'Mesurage Loi Boutin : surface habitable pour le bail de location. Tarif tout compris dès 70 €, certifié COFRAC.',
    h1: 'Mesurage Loi Boutin',
    tagline: 'La surface habitable, à mentionner dans le bail de location.',
    priceLabel: 'dès 70 €',
    intro:
      "Le mesurage Loi Boutin détermine la surface habitable d'un logement loué vide. Cette superficie doit être indiquée dans le contrat de location.",
    when: [
      'À la location (bail d’un logement vide).',
    ],
    inPack: ['location'],
    faq: [
      { q: 'Quand la Loi Boutin s’applique-t-elle ?', a: 'Pour la location d’un logement vide : la surface habitable doit figurer dans le bail.' },
      { q: 'Combien coûte le mesurage ?', a: 'Dès 70 € tout compris, déplacement inclus.' },
    ],
    ready: true,
  },
  {
    slug: 'erp',
    name: 'ERP',
    nav: 'ERP (État des Risques)',
    title: 'État des Risques et Pollutions (ERP) | Soloris',
    metaDesc:
      'État des Risques et Pollutions (ERP) : risques naturels, miniers et technologiques, vente et location. 30 € · offert dans nos packs, certifié COFRAC.',
    h1: 'État des Risques et Pollutions (ERP)',
    tagline: 'L’information sur les risques auxquels le bien est exposé.',
    priceLabel: '30 € · offert en pack',
    intro:
      "L'État des Risques et Pollutions informe l'acquéreur ou le locataire des risques naturels, miniers et technologiques auxquels le bien est exposé. Chez Soloris, il est offert dans les packs vente et location.",
    when: [
      'À la vente et à la location, lorsque le bien est situé dans une zone concernée.',
    ],
    inPack: ['vente', 'location'],
    faq: [
      { q: 'L’ERP est-il payant chez Soloris ?', a: 'Il est offert dans nos packs vente et location. À l’unité, il est proposé à 30 €.' },
      { q: 'Quelle est sa validité ?', a: "L'ERP doit être daté de moins de 6 mois au moment de la signature." },
    ],
    ready: true,
  },
];

export function getDiagnostic(slug: string): Diagnostic | undefined {
  return DIAGNOSTICS.find((d) => d.slug === slug);
}
