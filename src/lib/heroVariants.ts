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

export const HERO_VARIANTS: Record<string, HeroVariant> = {
  dpe: {
    h1: 'Votre DPE à Paris et en Île-de-France, <span class="hl">sous 48 h</span>',
    sub: 'Tarif tout compris, rapport lisible. Diagnostiqueur certifié COFRAC.',
  },
  vente: {
    h1: 'Tous vos diagnostics pour <span class="hl">vendre</span>, en toute clarté',
    sub: 'Pack complet tout compris, rapport opposable sous 48 h.',
  },
  location: {
    h1: 'Vos diagnostics pour <span class="hl">louer</span>, tout compris',
    sub: 'Pack bailleur clair et rapide, à Paris et en Île-de-France.',
  },
  audit: {
    h1: 'Votre <span class="hl">audit énergétique</span>, par un expert certifié',
    sub: "Conseil sur l'étiquette et le plan de travaux, sans jargon.",
  },
  default: {
    h1: 'Vos diagnostics immobiliers, <span class="hl">en toute clarté</span>',
    sub: 'Tarif tout compris, rapport sous 48 h. Paris et Île-de-France.',
  },
};

/** Renvoie la clé de variante valide, ou 'default'. */
export function resolveVariantKey(raw: string | null | undefined): string {
  if (!raw) return 'default';
  const k = raw.toLowerCase().trim();
  return Object.prototype.hasOwnProperty.call(HERO_VARIANTS, k) && k !== 'default' ? k : 'default';
}
