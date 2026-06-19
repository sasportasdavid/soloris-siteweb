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
  intro: string; // contexte local UNIQUE (2-3 phrases factuelles)
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
      'Diagnostic immobilier à Paris 11e : DPE, vente, location, audit. Tarif tout compris, rapport sous 48 h, diagnostiqueur certifié COFRAC.',
    intro:
      "Bastille, Oberkampf, République : le 11e arrondissement est l'un des plus densément peuplés de Paris, avec un parc immobilier majoritairement ancien (immeubles haussmanniens et faubouriens) où dominent studios et deux-pièces. Soloris y réalise vos diagnostics rapidement, avec un rapport clair et opposable, prêt pour votre notaire ou votre bail.",
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
      'Diagnostic immobilier à Montreuil (93) : DPE, vente, location, audit. Tarif tout compris, intervention sous 48 h, diagnostiqueur certifié COFRAC.',
    intro:
      "Limitrophe de Paris, Montreuil mêle anciens ateliers réhabilités, maisons de ville et copropriétés récentes, sur un marché immobilier particulièrement dynamique. Pour une vente ou une mise en location, Soloris intervient à Montreuil sous 48 h, déplacement inclus, avec un rapport pédagogique et opposable.",
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
      'Diagnostic immobilier à Saint-Denis (93) : DPE, vente, location, audit. Tarif tout compris, rapport sous 48 h, diagnostiqueur certifié COFRAC.',
    intro:
      "Aux portes de Paris, Saint-Denis est l'une des principales villes de Seine-Saint-Denis : on y trouve aussi bien des pavillons que de grandes copropriétés et des programmes neufs. Pour vendre ou louer sereinement, Soloris y réunit les diagnostics nécessaires à votre bien, avec un tarif tout compris et un rapport lisible.",
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
      'Diagnostic immobilier à Paris 15e : DPE, vente, location, audit. Tarif tout compris, rapport sous 48 h, diagnostiqueur certifié COFRAC.',
    intro:
      "Plus peuplé des arrondissements parisiens, le 15e (Convention, Vaugirard, Beaugrenelle) présente un parc varié : immeubles haussmanniens, résidences des années 1960-1980 et copropriétés familiales. Soloris y intervient rapidement pour une vente ou une location, avec un rapport clair et opposable.",
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
      'Diagnostic immobilier à Paris 18e : DPE, vente, location, audit. Tarif tout compris, rapport sous 48 h, diagnostiqueur certifié COFRAC.',
    intro:
      "De Montmartre à la Goutte d'Or, le 18e arrondissement réunit un bâti très ancien et une forte demande locative. Ce parc demande des diagnostics rigoureux (plomb et amiante fréquents sur les immeubles anciens) : Soloris les réalise sous 48 h, avec un rapport pédagogique.",
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
      'Diagnostic immobilier à Paris 20e : DPE, vente, location, audit. Tarif tout compris, rapport sous 48 h, diagnostiqueur certifié COFRAC.',
    intro:
      "Belleville, Ménilmontant, Gambetta : le 20e mêle immeubles anciens de faubourg et programmes rénovés, sur un marché en pleine évolution. Pour vendre ou louer, Soloris y réunit les diagnostics applicables à votre bien, déplacement inclus.",
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
      'Diagnostic immobilier à Paris 17e : DPE, vente, location, audit. Tarif tout compris, rapport sous 48 h, diagnostiqueur certifié COFRAC.',
    intro:
      "Des Batignolles aux Ternes, le 17e arrondissement associe bel haussmannien et le nouveau quartier Clichy-Batignolles. Soloris y réalise vos diagnostics avec la même exigence sur l'ancien comme sur le neuf, et un rapport opposable prêt pour le notaire.",
    geo: { latitude: 48.887, longitude: 2.3076 },
  },
  {
    slug: 'saint-ouen',
    name: 'Saint-Ouen',
    prep: 'à',
    longName: 'Saint-Ouen-sur-Seine',
    dept: 'Seine-Saint-Denis (93)',
    postalCodes: ['93400'],
    metaDesc:
      "Diagnostic immobilier à Saint-Ouen (93) : DPE, vente, location, audit. Tarif tout compris, intervention sous 48 h, certifié COFRAC.",
    intro:
      "Aux portes de Paris, Saint-Ouen-sur-Seine conjugue immeubles anciens, anciens sites industriels reconvertis et programmes neufs (docks, quartier des Puces). Soloris y intervient sous 48 h pour accompagner vos ventes et locations, avec un tarif tout compris.",
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
      "Diagnostic immobilier à Aubervilliers (93) : DPE, vente, location, audit. Tarif tout compris, rapport sous 48 h, certifié COFRAC.",
    intro:
      "Portée par le Grand Paris, Aubervilliers voit cohabiter copropriétés anciennes, anciens entrepôts réhabilités et résidences neuves. Pour vendre ou louer dans ce marché en mutation, Soloris réunit les diagnostics nécessaires à votre bien, avec un rapport lisible.",
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
      'Diagnostic immobilier à Paris 16e : DPE, vente, location, audit. Tarif tout compris, rapport sous 48 h, diagnostiqueur certifié COFRAC.',
    intro:
      "Du Trocadéro à Auteuil-Passy, le 16e arrondissement aligne immeubles haussmanniens cossus, hôtels particuliers et résidences Art déco, sur l'un des marchés les plus valorisés de Paris. Soloris y réalise vos diagnostics de vente ou de location avec un rapport soigné et opposable, prêt pour le notaire.",
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
      'Diagnostic immobilier à Paris 9e : DPE, vente, location, audit. Tarif tout compris, rapport sous 48 h, diagnostiqueur certifié COFRAC.',
    intro:
      "De la Nouvelle Athènes aux Grands Boulevards, le 9e arrondissement se distingue par son bel haussmannien et ses immeubles de rapport, prisés à la vente comme à la location. Soloris y réalise vos diagnostics avec un rapport clair et opposable, déplacement inclus.",
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
      'Diagnostic immobilier à Paris 14e : DPE, vente, location, audit. Tarif tout compris, rapport sous 48 h, diagnostiqueur certifié COFRAC.',
    intro:
      "De Montparnasse à Denfert et la Porte d'Orléans, le 14e arrondissement mêle immeubles anciens, copropriétés des années 1930 et résidences d'après-guerre. Soloris y intervient rapidement pour vos projets de vente ou de location, avec un tarif tout compris.",
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
      'Diagnostic immobilier à Paris 19e : DPE, vente, location, audit. Tarif tout compris, rapport sous 48 h, diagnostiqueur certifié COFRAC.',
    intro:
      "Des Buttes-Chaumont au bassin de la Villette, le 19e arrondissement conjugue immeubles anciens, grands ensembles et programmes récents, sur un marché locatif très actif. Soloris y intervient sous 48 h, avec des diagnostics rigoureux et un rapport pédagogique.",
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
      'Diagnostic immobilier à Aulnay-sous-Bois (93) : DPE, vente, location, audit. Tarif tout compris, sous 48 h, certifié COFRAC.',
    intro:
      "Deuxième ville de Seine-Saint-Denis, Aulnay-sous-Bois associe pavillons du Vieux-Pays, grandes copropriétés et quartiers en rénovation urbaine. Soloris y réunit les diagnostics nécessaires à votre vente ou location, sous 48 h et déplacement inclus.",
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
      'Diagnostic immobilier à Noisy-le-Grand (93) : DPE, vente, location, audit. Tarif tout compris, sous 48 h, certifié COFRAC.',
    intro:
      "À l'est de la métropole, Noisy-le-Grand mêle quartiers d'affaires (Mont d'Est), maisons de ville et copropriétés récentes le long du RER A. Soloris y réalise vos diagnostics sous 48 h, avec un rapport lisible et opposable pour votre notaire ou votre bail.",
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
      'Diagnostic immobilier à Drancy (93) : DPE, vente, location, audit. Tarif tout compris, rapport sous 48 h, certifié COFRAC.',
    intro:
      "Ville pavillonnaire du nord du 93, Drancy compte de nombreuses maisons individuelles et copropriétés des années 1960-1980. Pour vendre ou louer sereinement, Soloris y réalise les diagnostics applicables à votre bien, avec un tarif tout compris.",
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
      'Diagnostic immobilier à Pantin (93) : DPE, vente, location, audit. Tarif tout compris, rapport sous 48 h, certifié COFRAC.',
    intro:
      "Aux portes de Paris, le long du canal de l'Ourcq, Pantin transforme ses anciens sites industriels en lofts et bureaux, tout en conservant un parc de copropriétés anciennes. Soloris y intervient sous 48 h pour accompagner vos ventes et locations, avec un rapport clair.",
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
      "Diagnostic immobilier à Boulogne-Billancourt (92) : DPE, vente, location, audit. Tarif tout compris, sous 48 h, certifié COFRAC.",
    intro:
      "Première ville des Hauts-de-Seine, Boulogne-Billancourt mêle immeubles Art déco et des années 1930 au quartier neuf du Trapèze, sur un marché immobilier recherché. Soloris y réalise vos diagnostics avec rigueur et un rapport opposable, déplacement inclus.",
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
      "Diagnostic immobilier à Vincennes (94) : DPE, vente, location, audit. Tarif tout compris, rapport sous 48 h, certifié COFRAC.",
    intro:
      "Aux portes est de Paris, Vincennes séduit par son cadre (proximité du bois) et un bâti de qualité : immeubles haussmanniens et Art déco, copropriétés soignées. Soloris y intervient sous 48 h, avec un rapport clair pour vos projets de vente ou de location.",
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
      "Diagnostic immobilier à Sarcelles (95) : DPE, vente, location, audit. Tarif tout compris, rapport sous 48 h, certifié COFRAC.",
    intro:
      "À Sarcelles, où Soloris est implanté, le parc immobilier va des grands ensembles aux pavillons et copropriétés. Cet ancrage local nous permet d'intervenir très rapidement pour vos diagnostics de vente ou de location, avec un tarif tout compris et un rapport pédagogique.",
    geo: { latitude: 48.9956, longitude: 2.3786 },
  },
];

export function getZone(slug: string): Zone | undefined {
  return ZONES.find((z) => z.slug === slug);
}
