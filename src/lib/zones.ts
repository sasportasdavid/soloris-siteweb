/**
 * Zones desservies — pages locales SEO (gabarit /diagnostic-immobilier-{slug}).
 * ⚠️ Chaque zone doit avoir un contenu d'introduction UNIQUE (anti-duplicate content).
 * Phase 1 (à valider) : 3 zones tests prioritaires (Paris + Seine-Saint-Denis,
 * là où tournent les campagnes Ads). Les autres zones du top 12 seront ajoutées
 * après validation du rendu et du SEO.
 */
export interface Zone {
  slug: string; // partie après "diagnostic-immobilier-" → URL /diagnostic-immobilier-{slug}
  name: string; // libellé affiché, ex. "Paris 11e"
  prep: string; // « à », « au »… pour les titres (« Diagnostic immobilier {prep} {name} »)
  longName: string; // forme longue pour le corps de texte
  dept: string; // département
  postalCodes: string[];
  metaDesc: string;
  intro: string; // contexte local UNIQUE (dossier éditorial V2, oct. 2026)
  conseil: string; // « À préparer avant la visite » — rendu dans le bloc contexte local, hors formulaire
  geo: { latitude: number; longitude: number };
}

export const ZONES: Zone[] = [
  {
    slug: 'paris-11e',
    name: 'Paris 11e',
    prep: 'à',
    longName: 'le 11e arrondissement de Paris',
    dept: 'Paris (75)',
    postalCodes: ['75011'],
    metaDesc:
      'DPE et diagnostics de vente ou location à Paris 11e. Prix annoncé avant la visite, déplacement inclus. Demandez votre devis Soloris.',
    intro:
      'Vous vendez ou louez un appartement à Paris 11e ? Indiquez la surface, l’accès au logement et les éventuels lots annexes. Nous faisons le point sur les rapports déjà disponibles pour organiser les diagnostics nécessaires sans multiplier les rendez-vous.',
    conseil:
      'Appartement en copropriété : transmettez les surfaces connues et signalez la cave ou le parking compris dans le projet.',
    geo: { latitude: 48.8594, longitude: 2.3765 },
  },
  {
    slug: 'montreuil',
    name: 'Montreuil',
    prep: 'à',
    longName: 'Montreuil',
    dept: 'Seine-Saint-Denis (93)',
    postalCodes: ['93100'],
    metaDesc:
      'DPE et diagnostics de vente ou location à Montreuil. Prix annoncé avant la visite, déplacement inclus. Demandez votre devis Soloris.',
    intro:
      'À Montreuil, un appartement, une maison et un ancien local transformé en habitation ne se décrivent pas de la même manière. Précisez l’usage actuel du bien, les travaux connus et les annexes : le périmètre est confirmé avant la visite.',
    conseil:
      'Bien transformé ou réaménagé : rassemblez les plans et justificatifs disponibles sans déduire les diagnostics de la seule apparence du bâtiment.',
    geo: { latitude: 48.8638, longitude: 2.4485 },
  },
  {
    slug: 'saint-denis',
    name: 'Saint-Denis',
    prep: 'à',
    longName: 'Saint-Denis',
    dept: 'Seine-Saint-Denis (93)',
    postalCodes: ['93200', '93210'],
    metaDesc:
      'DPE et diagnostics de vente ou location à Saint-Denis. Prix annoncé avant la visite, déplacement inclus. Demandez votre devis Soloris.',
    intro:
      'Pour vos diagnostics à Saint-Denis, commencez par indiquer l’adresse exacte et le projet de vente ou de location. Dans un ensemble de plusieurs bâtiments, précisez le bâtiment et le logement concernés pour préparer une intervention sur le bon périmètre.',
    conseil:
      'Ensemble immobilier : préciser bâtiment, étage, accès et parties effectivement commandées ; le DPE du logement ne se confond pas avec celui de tout l’immeuble.',
    geo: { latitude: 48.9362, longitude: 2.3574 },
  },

  // ── Vague 1 — Paris (75) + Seine-Saint-Denis (93), zones prioritaires Ads ──
  {
    slug: 'paris-15e',
    name: 'Paris 15e',
    prep: 'à',
    longName: 'le 15e arrondissement de Paris',
    dept: 'Paris (75)',
    postalCodes: ['75015'],
    metaDesc:
      'DPE et diagnostics de vente ou location à Paris 15e. Prix annoncé avant la visite, déplacement inclus. Demandez votre devis Soloris.',
    intro:
      'Vous préparez une transaction à Paris 15e ? Nous regroupons les diagnostics convenus pour votre logement et les lots prévus au devis. Les informations sur le chauffage et les rapports déjà disponibles aident à préparer le rendez-vous.',
    conseil:
      'Chauffage collectif : demander au syndic les documents disponibles utiles au DPE, sans garantir que chaque document sera nécessaire dans tous les cas.',
    geo: { latitude: 48.8417, longitude: 2.3009 },
  },
  {
    slug: 'paris-18e',
    name: 'Paris 18e',
    prep: 'à',
    longName: 'le 18e arrondissement de Paris',
    dept: 'Paris (75)',
    postalCodes: ['75018'],
    metaDesc:
      'DPE et diagnostics de vente ou location à Paris 18e. Prix annoncé avant la visite, déplacement inclus. Demandez votre devis Soloris.',
    intro:
      'Pour un logement à Paris 18e, signalez les informations connues sur la construction et les rénovations. La date d’un immeuble ne suffit pas à décrire l’âge de ses installations : nous vérifions les critères propres aux diagnostics commandés.',
    conseil:
      'Installation rénovée : transmettre ses justificatifs et distinguer l’année du bâtiment de celle des installations.',
    geo: { latitude: 48.8925, longitude: 2.3444 },
  },
  {
    slug: 'paris-20e',
    name: 'Paris 20e',
    prep: 'à',
    longName: 'le 20e arrondissement de Paris',
    dept: 'Paris (75)',
    postalCodes: ['75020'],
    metaDesc:
      'DPE et diagnostics de vente ou location à Paris 20e. Prix annoncé avant la visite, déplacement inclus. Demandez votre devis Soloris.',
    intro:
      'À Paris 20e, préparez votre DPE ou votre dossier de vente/location en précisant le type de bien, la surface et les accès. Un logement avec plusieurs niveaux, une annexe ou un usage particulier nécessite un périmètre clairement décrit avant la visite.',
    conseil:
      'Duplex ou pièces réaménagées : préciser la configuration actuelle et fournir les surfaces connues.',
    geo: { latitude: 48.8635, longitude: 2.3984 },
  },
  {
    slug: 'paris-17e',
    name: 'Paris 17e',
    prep: 'à',
    longName: 'le 17e arrondissement de Paris',
    dept: 'Paris (75)',
    postalCodes: ['75017'],
    metaDesc:
      'DPE et diagnostics de vente ou location à Paris 17e. Prix annoncé avant la visite, déplacement inclus. Demandez votre devis Soloris.',
    intro:
      'Vous vendez un appartement à Paris 17e ? Rassemblez les diagnostics et le mesurage déjà en votre possession. Nous vérifions leur périmètre et leur réutilisation possible avant de définir les nouvelles prestations.',
    conseil:
      'Revente d’un appartement : ne pas commander automatiquement tous les diagnostics sans examiner les rapports précédents.',
    geo: { latitude: 48.887, longitude: 2.3076 },
  },
  {
    slug: 'saint-ouen',
    name: 'Saint-Ouen-sur-Seine',
    prep: 'à',
    longName: 'Saint-Ouen-sur-Seine',
    dept: 'Seine-Saint-Denis (93)',
    postalCodes: ['93400'],
    metaDesc:
      'DPE et diagnostics de vente ou location à Saint-Ouen-sur-Seine. Prix annoncé avant la visite, déplacement inclus. Demandez votre devis Soloris.',
    intro:
      'Pour un bien à Saint-Ouen-sur-Seine, la date de construction, les équipements et l’usage du logement orientent la préparation du dossier. Un logement récent n’exclut pas toute obligation ; nous confirmons ce qui s’applique à votre projet.',
    conseil:
      'Construction récente : ne pas confondre une catégorie tarifaire avec une dispense générale de diagnostic.',
    geo: { latitude: 48.9106, longitude: 2.3334 },
  },
  {
    slug: 'aubervilliers',
    name: 'Aubervilliers',
    prep: 'à',
    longName: 'Aubervilliers',
    dept: 'Seine-Saint-Denis (93)',
    postalCodes: ['93300'],
    metaDesc:
      'DPE et diagnostics de vente ou location à Aubervilliers. Prix annoncé avant la visite, déplacement inclus. Demandez votre devis Soloris.',
    intro:
      'À Aubervilliers, décrivez précisément le bien que vous souhaitez vendre ou louer. Si plusieurs logements, ateliers ou annexes partagent une même adresse, indiquez les parties concernées pour éviter un devis établi sur un périmètre incomplet.',
    conseil:
      'Adresse regroupant plusieurs lots : lister les unités et usages réellement concernés par la commande.',
    geo: { latitude: 48.9145, longitude: 2.3835 },
  },

  // ── Vague 1b — extension SEO (juin 2026) : arrondissements + communes 93 ──
  // Prioritaire car recoupe les requêtes payées en Ads (volumes Keyword Planner).
  {
    slug: 'paris-16e',
    name: 'Paris 16e',
    prep: 'à',
    longName: 'le 16e arrondissement de Paris',
    dept: 'Paris (75)',
    postalCodes: ['75016'],
    metaDesc:
      'DPE et diagnostics de vente ou location à Paris 16e. Prix annoncé avant la visite, déplacement inclus. Demandez votre devis Soloris.',
    intro:
      'Pour vos diagnostics à Paris 16e, le prix dépend du bien et non d’une promesse de forfait universel. Précisez la surface et les lots annexes. Un logement de grande surface est étudié selon la grille et, lorsque nécessaire, sur devis.',
    conseil:
      'Grande surface : les packs au-delà de 239 m² sont sur devis ; ne pas afficher le prix d’entrée comme un prix applicable à tout le logement.',
    geo: { latitude: 48.8637, longitude: 2.2769 },
  },
  {
    slug: 'paris-9e',
    name: 'Paris 9e',
    prep: 'à',
    longName: 'le 9e arrondissement de Paris',
    dept: 'Paris (75)',
    postalCodes: ['75009'],
    metaDesc:
      'DPE et diagnostics de vente ou location à Paris 9e. Prix annoncé avant la visite, déplacement inclus. Demandez votre devis Soloris.',
    intro:
      'Vous préparez une location à Paris 9e ? Le DPE, la surface habitable et les autres diagnostics répondent à des objectifs différents. Nous précisons le contenu du dossier de votre logement avant d’organiser la visite.',
    conseil:
      'Location : distinguer les informations du bail, les diagnostics et les autres critères de décence.',
    geo: { latitude: 48.8769, longitude: 2.3378 },
  },
  {
    slug: 'paris-14e',
    name: 'Paris 14e',
    prep: 'à',
    longName: 'le 14e arrondissement de Paris',
    dept: 'Paris (75)',
    postalCodes: ['75014'],
    metaDesc:
      'DPE et diagnostics de vente ou location à Paris 14e. Prix annoncé avant la visite, déplacement inclus. Demandez votre devis Soloris.',
    intro:
      'À Paris 14e, organisez votre intervention en nous indiquant le projet, l’accès au logement et les documents disponibles. Les informations sur les travaux, les équipements et les surfaces facilitent la préparation des diagnostics.',
    conseil:
      'Travaux effectués : rassembler les justificatifs utiles plutôt que supposer une amélioration de la classe DPE.',
    geo: { latitude: 48.8331, longitude: 2.3264 },
  },
  {
    slug: 'paris-19e',
    name: 'Paris 19e',
    prep: 'à',
    longName: 'le 19e arrondissement de Paris',
    dept: 'Paris (75)',
    postalCodes: ['75019'],
    metaDesc:
      'DPE et diagnostics de vente ou location à Paris 19e. Prix annoncé avant la visite, déplacement inclus. Demandez votre devis Soloris.',
    intro:
      'Pour un DPE à Paris 19e, précisez si le logement dispose d’équipements individuels ou collectifs. Nous confirmons avec vous les informations à réunir et le créneau de visite ; la classe énergétique n’est jamais promise à l’avance.',
    conseil:
      'Copropriété : identifier les documents disponibles sur les équipements collectifs et le logement diagnostiqué.',
    geo: { latitude: 48.8839, longitude: 2.3822 },
  },
  {
    slug: 'aulnay-sous-bois',
    name: 'Aulnay-sous-Bois',
    prep: 'à',
    longName: 'Aulnay-sous-Bois',
    dept: 'Seine-Saint-Denis (93)',
    postalCodes: ['93600'],
    metaDesc:
      'DPE et diagnostics de vente ou location à Aulnay-sous-Bois. Prix annoncé avant la visite, déplacement inclus. Demandez votre devis Soloris.',
    intro:
      'Vous vendez une maison à Aulnay-sous-Bois ? Signalez le garage, les dépendances et les installations. Le pack de diagnostics et l’éventuel audit énergétique sont des prestations différentes dont le périmètre doit être confirmé.',
    conseil:
      'Maison avec dépendance : distinguer une annexe comprise dans le pack et une unité diagnostiquée séparément.',
    geo: { latitude: 48.9386, longitude: 2.4944 },
  },
  {
    slug: 'noisy-le-grand',
    name: 'Noisy-le-Grand',
    prep: 'à',
    longName: 'Noisy-le-Grand',
    dept: 'Seine-Saint-Denis (93)',
    postalCodes: ['93160'],
    metaDesc:
      'DPE et diagnostics de vente ou location à Noisy-le-Grand. Prix annoncé avant la visite, déplacement inclus. Demandez votre devis Soloris.',
    intro:
      'Pour un appartement à Noisy-le-Grand, précisez le bâtiment, le logement et les lots compris dans votre projet. Nous préparons les diagnostics de la vente ou de la location en tenant compte du périmètre réellement commandé.',
    conseil:
      'Plusieurs lots à une adresse : décrire aussi les parkings ou caves concernés avant le devis.',
    geo: { latitude: 48.8488, longitude: 2.5527 },
  },
  {
    slug: 'drancy',
    name: 'Drancy',
    prep: 'à',
    longName: 'Drancy',
    dept: 'Seine-Saint-Denis (93)',
    postalCodes: ['93700'],
    metaDesc:
      'DPE et diagnostics de vente ou location à Drancy. Prix annoncé avant la visite, déplacement inclus. Demandez votre devis Soloris.',
    intro:
      'À Drancy, vous pouvez demander un DPE seul ou organiser les diagnostics d’une vente ou d’une location. Indiquez clairement votre objectif : le diagnostic énergétique n’est pas automatiquement un dossier complet de transaction.',
    conseil:
      'Vente ou location : choisir le projet correspondant dans le formulaire afin que l’équipe prépare le bon dossier.',
    geo: { latitude: 48.9239, longitude: 2.4453 },
  },
  {
    slug: 'pantin',
    name: 'Pantin',
    prep: 'à',
    longName: 'Pantin',
    dept: 'Seine-Saint-Denis (93)',
    postalCodes: ['93500'],
    metaDesc:
      'DPE et diagnostics de vente ou location à Pantin. Prix annoncé avant la visite, déplacement inclus. Demandez votre devis Soloris.',
    intro:
      'Pour un bien à Pantin, l’usage du bâtiment et les transformations éventuelles doivent être précisés. Appartement, maison ou local atypique : nous confirmons que les prestations demandées correspondent à la situation du bien.',
    conseil:
      'Local transformé : vérifier l’usage et la documentation avant d’assimiler la mission à un logement standard.',
    geo: { latitude: 48.8966, longitude: 2.409 },
  },

  // ── Vague 2 — 92 / 94 / 95 : pages SEO (hors zones Ads pour l'instant) ──
  {
    slug: 'boulogne-billancourt',
    name: 'Boulogne-Billancourt',
    prep: 'à',
    longName: 'Boulogne-Billancourt',
    dept: 'Hauts-de-Seine (92)',
    postalCodes: ['92100'],
    metaDesc:
      'DPE et diagnostics de vente ou location à Boulogne-Billancourt. Prix annoncé avant la visite, déplacement inclus. Demandez votre devis Soloris.',
    intro:
      'Vous préparez une vente à Boulogne-Billancourt ? Transmettez les diagnostics disponibles et la description des lots concernés. Nous établissons le périmètre de l’intervention et le prix avant la visite, avec déplacement inclus.',
    conseil:
      'Dossier déjà constitué : vérifier dates et conclusions avant de renouveler chaque diagnostic.',
    geo: { latitude: 48.8333, longitude: 2.25 },
  },
  {
    slug: 'vincennes',
    name: 'Vincennes',
    prep: 'à',
    longName: 'Vincennes',
    dept: 'Val-de-Marne (94)',
    postalCodes: ['94300'],
    metaDesc:
      'DPE et diagnostics de vente ou location à Vincennes. Prix annoncé avant la visite, déplacement inclus. Demandez votre devis Soloris.',
    intro:
      'Pour votre location à Vincennes, faites préciser les diagnostics nécessaires et la surface à mentionner au bail. Le prix de la prestation, les documents utiles et le rendez-vous sont confirmés avec vous.',
    conseil:
      'Surface : ne pas reprendre automatiquement la superficie Carrez comme surface habitable du bail.',
    geo: { latitude: 48.8479, longitude: 2.4378 },
  },
  {
    slug: 'sarcelles',
    name: 'Sarcelles',
    prep: 'à',
    longName: 'Sarcelles',
    dept: "Val-d'Oise (95)",
    postalCodes: ['95200'],
    metaDesc:
      'DPE et diagnostics de vente ou location à Sarcelles. Prix annoncé avant la visite, déplacement inclus. Demandez votre devis Soloris.',
    intro:
      'IS DIAG, qui exploite la marque Soloris, est domiciliée à Sarcelles. Pour un bien dans la commune, décrivez votre projet et les caractéristiques du logement : nous préparons l’intervention avec le même périmètre tarifaire que pour les autres secteurs desservis.',
    conseil:
      'Adresse de l’entreprise : ne pas promettre un accueil libre, une disponibilité immédiate ou un tarif spécial local non confirmé.',
    geo: { latitude: 48.9956, longitude: 2.3786 },
  },
  // ── Vague 2 — Hauts-de-Seine (92) : nouvelle zone des campagnes Ads, + Versailles (78). ──
  //    Données chiffrées par commune : src/data/zones-data.json (script : scripts/build-zone-data.mjs).
  {
    slug: 'nanterre',
    name: "Nanterre",
    prep: 'à',
    longName: "Nanterre",
    dept: "Hauts-de-Seine (92)",
    postalCodes: ['92000'],
    metaDesc:
      'DPE et diagnostics de vente ou location à Nanterre. Prix annoncé avant la visite, déplacement inclus. Demandez votre devis Soloris.',
    intro:
      'Pour un diagnostic à Nanterre, précisez si votre demande concerne un logement ou un autre type de local. Les missions et méthodes ne se choisissent pas uniquement à partir de l’adresse : l’usage du bien est à confirmer.',
    conseil:
      'Local professionnel : faire vérifier la mission avant d’utiliser les tarifs résidentiels du simulateur.',
    geo: { latitude: 48.8974, longitude: 2.2018 },
  },
  {
    slug: 'courbevoie',
    name: "Courbevoie",
    prep: 'à',
    longName: "Courbevoie",
    dept: "Hauts-de-Seine (92)",
    postalCodes: ['92400'],
    metaDesc:
      'DPE et diagnostics de vente ou location à Courbevoie. Prix annoncé avant la visite, déplacement inclus. Demandez votre devis Soloris.',
    intro:
      'À Courbevoie, indiquez l’accès et le bâtiment concernés, particulièrement lorsque l’adresse dessert plusieurs entrées. Nous organisons le DPE ou les diagnostics commandés avec un tarif annoncé avant la visite.',
    conseil:
      'Accès : codes d’entrée et modalités d’accueil à transmettre par un canal approprié, pas dans une statistique publique.',
    geo: { latitude: 48.8976, longitude: 2.2574 },
  },
  {
    slug: 'asnieres-sur-seine',
    name: "Asnières-sur-Seine",
    prep: 'à',
    longName: "Asnières-sur-Seine",
    dept: "Hauts-de-Seine (92)",
    postalCodes: ['92600'],
    metaDesc:
      'DPE et diagnostics de vente ou location à Asnières-sur-Seine. Prix annoncé avant la visite, déplacement inclus. Demandez votre devis Soloris.',
    intro:
      'Vous vendez ou louez à Asnières-sur-Seine ? Un pack regroupe les diagnostics convenus pour le bien. Signalez les annexes et les documents existants afin de définir une prestation adaptée, plutôt qu’une liste identique pour tous.',
    conseil:
      'Annexes : distinguer le lot rattaché au logement et le lot vendu seul avant de comparer les prix.',
    geo: { latitude: 48.9181, longitude: 2.2935 },
  },
  {
    slug: 'colombes',
    name: "Colombes",
    prep: 'à',
    longName: "Colombes",
    dept: "Hauts-de-Seine (92)",
    postalCodes: ['92700'],
    metaDesc:
      'DPE et diagnostics de vente ou location à Colombes. Prix annoncé avant la visite, déplacement inclus. Demandez votre devis Soloris.',
    intro:
      'Pour une maison à Colombes, indiquez les dépendances et l’existence éventuelle d’une copropriété. Ces informations influencent le périmètre du dossier et la préparation du devis, indépendamment du résultat futur du DPE.',
    conseil:
      'Maison en copropriété : signaler cette situation au devis ; elle peut changer les pièces et le tarif applicable.',
    geo: { latitude: 48.9218, longitude: 2.2469 },
  },
  {
    slug: 'rueil-malmaison',
    name: "Rueil-Malmaison",
    prep: 'à',
    longName: "Rueil-Malmaison",
    dept: "Hauts-de-Seine (92)",
    postalCodes: ['92500'],
    metaDesc:
      'DPE et diagnostics de vente ou location à Rueil-Malmaison. Prix annoncé avant la visite, déplacement inclus. Demandez votre devis Soloris.',
    intro:
      'À Rueil-Malmaison, préparez votre diagnostic en réunissant les informations sur le logement, les équipements et les travaux connus. Ces éléments aident à organiser une intervention cohérente avec l’état actuel du bien.',
    conseil:
      'Travaux d’isolation ou de chauffage : conserver les justificatifs disponibles ; ne pas promettre un gain de classe sur leur seule mention.',
    geo: { latitude: 48.8717, longitude: 2.1806 },
  },
  {
    slug: 'issy-les-moulineaux',
    name: "Issy-les-Moulineaux",
    prep: 'à',
    longName: "Issy-les-Moulineaux",
    dept: "Hauts-de-Seine (92)",
    postalCodes: ['92130'],
    metaDesc:
      'DPE et diagnostics de vente ou location à Issy-les-Moulineaux. Prix annoncé avant la visite, déplacement inclus. Demandez votre devis Soloris.',
    intro:
      'Pour un appartement à Issy-les-Moulineaux, signalez les équipements collectifs et les documents disponibles auprès de la copropriété. Le DPE de votre logement et les documents de l’immeuble n’ont pas nécessairement le même périmètre.',
    conseil:
      'Documents collectifs : vérifier ceux qui concernent le logement et ne pas remplacer un diagnostic individuel par un document non équivalent.',
    geo: { latitude: 48.8240, longitude: 2.2628 },
  },
  {
    slug: 'levallois-perret',
    name: "Levallois-Perret",
    prep: 'à',
    longName: "Levallois-Perret",
    dept: "Hauts-de-Seine (92)",
    postalCodes: ['92300'],
    metaDesc:
      'DPE et diagnostics de vente ou location à Levallois-Perret. Prix annoncé avant la visite, déplacement inclus. Demandez votre devis Soloris.',
    intro:
      'Pour vos diagnostics à Levallois-Perret, précisez la surface, l’étage et les modalités d’accès. La visite est organisée après confirmation de votre demande ; le formulaire ne réserve pas automatiquement un créneau.',
    conseil:
      'Organisation : préparer l’accès au bien et la présence de la personne qui accueille le diagnostiqueur.',
    geo: { latitude: 48.8946, longitude: 2.2874 },
  },
  {
    slug: 'neuilly-sur-seine',
    name: "Neuilly-sur-Seine",
    prep: 'à',
    longName: "Neuilly-sur-Seine",
    dept: "Hauts-de-Seine (92)",
    postalCodes: ['92200'],
    metaDesc:
      'DPE et diagnostics de vente ou location à Neuilly-sur-Seine. Prix annoncé avant la visite, déplacement inclus. Demandez votre devis Soloris.',
    intro:
      'À Neuilly-sur-Seine, un appartement de grande surface ou plusieurs lots nécessitent une description précise. Nous confirmons les prestations et le devis selon le bien, sans appliquer automatiquement le prix d’entrée à toute configuration.',
    conseil:
      'Surface importante ou multi-lots : obtenir le devis correspondant au périmètre complet avant de confirmer l’intervention.',
    geo: { latitude: 48.8862, longitude: 2.2651 },
  },
  {
    slug: 'clichy',
    name: "Clichy",
    prep: 'à',
    longName: "Clichy",
    dept: "Hauts-de-Seine (92)",
    postalCodes: ['92110'],
    metaDesc:
      'DPE et diagnostics de vente ou location à Clichy. Prix annoncé avant la visite, déplacement inclus. Demandez votre devis Soloris.',
    intro:
      'Vous préparez une location à Clichy ? Indiquez le logement et les rapports déjà disponibles. Nous précisons le DPE et les diagnostics complémentaires nécessaires, sans confondre la réalisation du dossier avec une garantie de mise en location.',
    conseil:
      'Bailleur : vérifier la classe DPE et les autres critères applicables avant de finaliser la mise en location.',
    geo: { latitude: 48.9041, longitude: 2.3041 },
  },
  {
    slug: 'antony',
    name: "Antony",
    prep: 'à',
    longName: "Antony",
    dept: "Hauts-de-Seine (92)",
    postalCodes: ['92160'],
    metaDesc:
      'DPE et diagnostics de vente ou location à Antony. Prix annoncé avant la visite, déplacement inclus. Demandez votre devis Soloris.',
    intro:
      'Pour une vente à Antony, précisez le type de bien, la surface et les installations. Une date de construction ne décrit pas forcément l’âge d’une installation rénovée : les justificatifs disponibles sont utiles à l’étude du dossier.',
    conseil:
      'Installations : identifier les rénovations d’électricité ou de gaz et transmettre les documents utiles.',
    geo: { latitude: 48.7507, longitude: 2.2976 },
  },
  {
    slug: 'montrouge',
    name: "Montrouge",
    prep: 'à',
    longName: "Montrouge",
    dept: "Hauts-de-Seine (92)",
    postalCodes: ['92120'],
    metaDesc:
      'DPE et diagnostics de vente ou location à Montrouge. Prix annoncé avant la visite, déplacement inclus. Demandez votre devis Soloris.',
    intro:
      'Pour votre DPE à Montrouge, nous organisons une visite du logement et expliquons le rapport obtenu. Une petite surface ou un ancien diagnostic peut nécessiter de vérifier d’abord les règles applicables et les attestations officielles disponibles.',
    conseil:
      'Ancien DPE : vérifier sa date, son numéro et les dispositifs officiels avant de commander systématiquement un renouvellement.',
    geo: { latitude: 48.8159, longitude: 2.3163 },
  },
  {
    slug: 'clamart',
    name: "Clamart",
    prep: 'à',
    longName: "Clamart",
    dept: "Hauts-de-Seine (92)",
    postalCodes: ['92140'],
    metaDesc:
      'DPE et diagnostics de vente ou location à Clamart. Prix annoncé avant la visite, déplacement inclus. Demandez votre devis Soloris.',
    intro:
      'Vous vendez une maison à Clamart ? Le dossier peut comprendre des diagnostics et, selon la situation énergétique du bien, un audit distinct. Décrivez aussi les dépendances pour que le devis corresponde au périmètre de la vente.',
    conseil:
      'Audit : vérifier séparément l’obligation et le prix ; ne pas considérer cette mission comme automatiquement incluse dans le pack.',
    geo: { latitude: 48.7957, longitude: 2.2518 },
  },
  {
    slug: 'versailles',
    name: "Versailles",
    prep: 'à',
    longName: "Versailles",
    dept: "Yvelines (78)",
    postalCodes: ['78000'],
    metaDesc:
      'DPE et diagnostics de vente ou location à Versailles. Prix annoncé avant la visite, déplacement inclus. Demandez votre devis Soloris.',
    intro:
      'Pour un diagnostic à Versailles, signalez la configuration du bien, ses équipements et les contraintes d’accès connues. Le rapport décrit le logement évalué ; les éventuelles contraintes du projet de rénovation doivent être examinées séparément.',
    conseil:
      'Rénovation : distinguer les recommandations énergétiques des autorisations ou contraintes propres aux travaux envisagés.',
    geo: { latitude: 48.8039, longitude: 2.1191 },
  },
];

export function getZone(slug: string): Zone | undefined {
  return ZONES.find((z) => z.slug === slug);
}
