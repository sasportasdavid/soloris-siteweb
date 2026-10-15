/**
 * Landing dynamique (Dynamic Text Replacement).
 * On mappe un paramètre CONTRÔLÉ (?kw= ou utm_term) à une LISTE BLANCHE de
 * variantes rédigées à la main. On n'injecte JAMAIS la requête brute (XSS + marque).
 * Le `default` est pré-rendu pour le SEO ; la variante s'applique côté client.
 *
 * Interdits absolus dans toute variante : « pas cher », « moins cher »,
 * « promo », « discount », nom de concurrent. (Honnêteté + premium.)
 */

export type HeroVariant = { h1: string; sub: string };

// Textes : dossier éditorial V2 (oct. 2026) — seules les valeurs h1/sub changent.
export const HERO_VARIANTS: Record<string, HeroVariant> = {
  dpe: {
    h1: 'Votre <span class="hl">DPE</span> à Paris et en Île-de-France',
    sub: 'Un diagnostic pour votre appartement ou votre maison, un prix annoncé avant la visite et des résultats expliqués.',
  },
  vente: {
    h1: 'Vos <span class="hl">diagnostics de vente</span>, réunis en un seul rendez-vous',
    sub: 'Nous identifions les diagnostics nécessaires à votre bien et préparons les rapports à transmettre à votre notaire.',
  },
  location: {
    h1: 'Préparez les <span class="hl">diagnostics de votre location</span>',
    sub: 'DPE et diagnostics complémentaires selon le logement : un dossier adapté à votre bail et un prix annoncé avant la visite.',
  },
  audit: {
    h1: 'Votre <span class="hl">audit énergétique</span> à Paris et en Île-de-France',
    sub: 'Comprenez les possibilités de rénovation de votre bien grâce à des scénarios de travaux et un rapport détaillé.',
  },
  default: {
    h1: 'Diagnostics immobiliers à <span class="hl">Paris et en Île-de-France</span>',
    sub: 'DPE, vente, location ou audit : préparez votre intervention avec un prix annoncé et un accompagnement clair.',
  },
};

/** Renvoie la clé de variante valide, ou 'default'. */
export function resolveVariantKey(raw: string | null | undefined): string {
  if (!raw) return 'default';
  const k = raw.toLowerCase().trim();
  return Object.prototype.hasOwnProperty.call(HERO_VARIANTS, k) && k !== 'default' ? k : 'default';
}
