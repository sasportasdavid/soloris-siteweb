/**
 * Métadonnées des guides (hub + articles + JSON-LD).
 * Textes : dossier éditorial V2 (oct. 2026).
 *
 * datePublished = première publication réelle (inchangée).
 * dateModified  = date de la révision éditoriale ; À METTRE À JOUR au jour de la mise en
 *                 ligne effective si elle est postérieure (jamais une date artificielle).
 */
export interface GuideMeta {
  slug: string;
  url: string;
  title: string; // <title>
  h1: string;
  description: string;
  excerpt: string;
  datePublished: string; // ISO
  dateModified?: string; // ISO — révision réelle
  readMin: number;
  /** Identifiants de sources officielles (src/lib/sources.ts). */
  sources: string[];
}

const REVISION = '2026-10-15';

export const GUIDES: GuideMeta[] = [
  {
    slug: 'prix-diagnostic-immobilier-paris',
    url: '/guides/prix-diagnostic-immobilier-paris',
    title: 'Prix des diagnostics à Paris en 2026 | Soloris',
    h1: 'Combien coûtent vos diagnostics immobiliers à Paris ?',
    description:
      'DPE, packs vente et location, audit : les prix Soloris à Paris et en IDF, leurs conditions et les points à vérifier avant de choisir un devis.',
    excerpt:
      'Les prix de Soloris, leurs conditions et les éléments à comparer avant de commander. Ce guide présente notre grille, pas une moyenne de tout le marché.',
    datePublished: '2026-06-03',
    dateModified: REVISION,
    readMin: 5,
    sources: ['R01'],
  },
  {
    slug: 'diagnostics-obligatoires-vente',
    url: '/guides/diagnostics-obligatoires-vente',
    title: 'Diagnostics obligatoires pour vendre | Soloris',
    h1: 'Quels diagnostics préparer pour vendre votre bien ?',
    description:
      'DPE, amiante, plomb, installations, risques et mesurage : comprenez quels documents préparer pour vendre et ce qui dépend de votre bien.',
    excerpt:
      'La liste dépend du logement et de la vente. Voici les critères à examiner avant de commander votre dossier.',
    datePublished: '2026-06-03',
    dateModified: REVISION,
    readMin: 5,
    sources: ['R01', 'R02', 'R03', 'R04', 'R05'],
  },
  {
    slug: 'comprendre-etiquette-dpe',
    url: '/guides/comprendre-etiquette-dpe',
    title: 'Comprendre votre étiquette DPE | Soloris',
    h1: 'Comprendre votre étiquette DPE',
    description:
      'Classes A à G, consommation conventionnelle, émissions et recommandations : lisez votre DPE sans confondre classement et facture réelle.',
    excerpt:
      'Votre rapport décrit une performance conventionnelle et des pistes d’amélioration. Il ne prédit pas à lui seul votre facture ou le prix de vente du logement.',
    datePublished: '2026-06-03',
    dateModified: REVISION,
    readMin: 4,
    sources: ['R06', 'R07'],
  },
  {
    slug: 'reforme-dpe',
    url: '/guides/reforme-dpe',
    title: 'Réformes DPE : règles 2026 et évolution 2027 | Soloris',
    h1: 'Réformes du DPE : ce qui s’applique en 2026 et ce qui change en 2027',
    description:
      'DPE : distinguez les règles applicables en 2026, le coefficient prévu en 2027 et les attestations ADEME avant de commander un nouveau diagnostic.',
    excerpt:
      'Les règles applicables en 2026, le coefficient prévu au 1er janvier 2027 et les attestations officielles, avant de commander un nouveau DPE.',
    datePublished: '2026-06-03',
    dateModified: REVISION,
    readMin: 5,
    sources: ['R06', 'R07', 'R08', 'R09'],
  },
];

export function getGuide(slug: string): GuideMeta | undefined {
  return GUIDES.find((g) => g.slug === slug);
}

/** Date lisible (« 15 octobre 2026 ») pour l'affichage de la révision. */
export function dateFr(iso: string): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Paris' });
}
