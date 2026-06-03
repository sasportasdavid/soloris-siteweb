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
];

export function getZone(slug: string): Zone | undefined {
  return ZONES.find((z) => z.slug === slug);
}
