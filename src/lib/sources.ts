/**
 * Sources officielles citées par les guides et les fiches diagnostics
 * (catalogue du dossier éditorial V2, oct. 2026). Les règles citées doivent être
 * réexaminées à chaque révision publiée ; la date de contrôle figure dans guides.ts.
 */
export interface Source { label: string; url: string }

export const SOURCES: Record<string, Source> = {
  R01: { label: 'DGCCRF — Faire appel à un diagnostiqueur immobilier', url: 'https://www.economie.gouv.fr/dgccrf/les-fiches-pratiques/faire-appel-un-diagnostiqueur-immobilier' },
  R02: { label: 'Service Public — Diagnostics immobiliers : vente', url: 'https://www.service-public.gouv.fr/particuliers/vosdroits/F10798' },
  R03: { label: 'Service Public — Diagnostic amiante', url: 'https://www.service-public.gouv.fr/particuliers/vosdroits/F742' },
  R04: { label: 'Service Public — État de l’installation intérieure d’électricité', url: 'https://www.service-public.gouv.fr/particuliers/vosdroits/F18692' },
  R05: { label: 'Service Public — Audit énergétique', url: 'https://www.service-public.gouv.fr/particuliers/vosdroits/F37110' },
  R06: { label: 'Service Public — Diagnostic de performance énergétique (DPE)', url: 'https://www.service-public.gouv.fr/particuliers/vosdroits/F16096' },
  R07: { label: 'Service Public — Logement décent', url: 'https://www.service-public.gouv.fr/particuliers/vosdroits/F2042' },
  R08: { label: 'Ministère de la Transition écologique — Facteur de conversion de l’électricité à 1,7 au 1er janvier 2027', url: 'https://www.ecologie.gouv.fr/presse/dpe-audits-energetiques-publication-larrete-abaissant-facteur-conversion-lelectricite-17-1er' },
  R09: { label: 'Légifrance — Arrêté du 19 août 2026', url: 'https://www.legifrance.gouv.fr/loda/id/JORFTEXT000054747079/' },
  R10: { label: 'Service Public — Diagnostics immobiliers : location', url: 'https://www.service-public.gouv.fr/particuliers/vosdroits/F33463' },
  R11: { label: 'Service Public — Bail d’habitation et surface habitable', url: 'https://www.service-public.gouv.fr/particuliers/vosdroits/F920' },
  R12: { label: 'Service Public — Diagnostic termites', url: 'https://www.service-public.gouv.fr/particuliers/vosdroits/F3150' },
  R13: { label: 'Service Public — État des risques', url: 'https://www.service-public.gouv.fr/particuliers/vosdroits/F12239' },
  R14: { label: 'Cofrac — Section Certifications', url: 'https://www.cofrac.fr/a-propos-du-cofrac/organisation/section-certifications' },
};

export const sourcesFor = (ids: string[]): Source[] => ids.map((id) => SOURCES[id]).filter(Boolean);
