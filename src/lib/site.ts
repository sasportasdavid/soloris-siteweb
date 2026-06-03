/**
 * Configuration centrale du site Soloris.
 * Tous les champs marqués [À REMPLACER] sont à renseigner avant mise en ligne
 * (voir aussi le README.md). Centraliser ici garantit la cohérence NAP
 * (Name / Address / Phone) exigée par le SEO local.
 */

export const SITE = {
  name: 'Soloris', // nom commercial
  tradeName: 'Soloris', // nom commercial (affiché)
  legalName: 'IS DIAG', // raison sociale officielle (RCS) — exploite la marque Soloris
  legalForm: 'SASU', // société par actions simplifiée unipersonnelle
  capital: '100 €', // capital social
  siren: '898 933 353',
  siret: '898 933 353 00010', // SIRET du siège
  vat: 'FR57898933353', // TVA intracommunautaire
  director: 'Yisrael Teboul', // président / directeur de la publication
  ape: '71.20B', // analyses, essais et inspections techniques
  baseline: 'Le diagnostic, en toute clarté.',
  url: 'https://soloris.fr', // [À REMPLACER si domaine différent]
  // Coordonnées NAP — doivent être STRICTEMENT identiques partout (site, Google Business…)
  phone: '+33 1 88 33 95 85', // format international (E.164) pour les liens tel:
  phoneDisplay: '01 88 33 95 85',
  email: 'contact@soloris.fr',
  address: {
    street: '18 allée Léon Paul Fargue',
    postalCode: '95200',
    city: 'Sarcelles',
    region: 'Île-de-France',
    country: 'FR',
  },
  geo: {
    // Coordonnées approximatives de Sarcelles — [À AFFINER si besoin]
    latitude: 48.9956,
    longitude: 2.3786,
  },
  areaServed: ['Paris', 'Île-de-France'],
  openingHours: 'Mo-Sa 08:00-19:00', // horaires par défaut — [À CONFIRMER selon vos horaires réels]
  priceRange: '€€',
  // Avis — note réelle de la fiche Google « is diag » (juin 2026)
  rating: {
    value: '4,9',
    count: '111',
  },
  // Réseaux sociaux / profils (sameAs) — [À REMPLACER]
  sameAs: [
    // 'https://www.google.com/maps/place/...',  // fiche Google Business
    // 'https://www.linkedin.com/company/...',
  ],
  // Certification — allégation de positionnement, sans numéro (non affiché)
  cofracNote: 'Diagnostiqueur certifié COFRAC',
} as const;

/** Construit la chaîne d'adresse postale affichable. */
export function fullAddress(): string {
  const a = SITE.address;
  return [a.street, [a.postalCode, a.city].filter(Boolean).join(' ')]
    .filter(Boolean)
    .join(', ');
}
