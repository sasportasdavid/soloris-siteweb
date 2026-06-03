/** Métadonnées des guides (hub + articles + JSON-LD). */
export interface GuideMeta {
  slug: string;
  url: string;
  title: string; // <title>
  h1: string;
  description: string;
  excerpt: string;
  datePublished: string; // ISO
  readMin: number;
}

export const GUIDES: GuideMeta[] = [
  {
    slug: 'diagnostics-obligatoires-vente',
    url: '/guides/diagnostics-obligatoires-vente',
    title: 'Quels diagnostics obligatoires pour vendre un appartement ? | Soloris',
    h1: 'Quels diagnostics sont obligatoires pour vendre un appartement ?',
    description:
      "Liste claire des diagnostics à prévoir pour vendre un appartement à Paris et en Île-de-France : DPE, ERP, amiante, plomb, électricité, gaz, Loi Carrez.",
    excerpt:
      "DPE, ERP, amiante, plomb, électricité, gaz, mesurage… On vous explique simplement quels diagnostics composent le dossier de vente, et lesquels dépendent de votre bien.",
    datePublished: '2026-06-03',
    readMin: 6,
  },
  {
    slug: 'comprendre-etiquette-dpe',
    url: '/guides/comprendre-etiquette-dpe',
    title: 'DPE : comprendre votre étiquette énergétique | Soloris',
    h1: 'DPE : comprendre votre étiquette énergétique',
    description:
      "Comment lire votre DPE : étiquettes A à G, énergie et climat, méthode 3CL. Un guide pédagogique et neutre, sans promesse de résultat.",
    excerpt:
      "De A à G, énergie et climat : on décode l'étiquette de votre DPE, ce qu'elle mesure vraiment, et comment l'interpréter sereinement.",
    datePublished: '2026-06-03',
    readMin: 5,
  },
  {
    slug: 'reforme-dpe',
    url: '/guides/reforme-dpe',
    title: 'Réforme DPE : ce qui change | Soloris',
    h1: 'Réforme DPE : ce qui change',
    description:
      "Réforme du DPE et calendrier sur les logements énergivores : une trame claire. Chaque point daté est signalé pour vérification de l'état en vigueur.",
    excerpt:
      "Le cadre du DPE évolue. Voici une trame neutre des sujets à suivre — chaque affirmation datée est marquée « à vérifier » tant qu'elle n'est pas confirmée en vigueur.",
    datePublished: '2026-06-03',
    readMin: 5,
  },
];

export function getGuide(slug: string): GuideMeta | undefined {
  return GUIDES.find((g) => g.slug === slug);
}
