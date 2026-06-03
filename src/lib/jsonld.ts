/**
 * Fabriques de données structurées JSON-LD (schema.org).
 * Les champs [À REMPLACER] proviennent de src/lib/site.ts.
 */
import { SITE, fullAddress } from './site';

const ORG_ID = `${SITE.url}/#business`;

/** LocalBusiness — identité de l'entreprise, SEO local. */
export function localBusiness() {
  const ld: Record<string, any> = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    '@id': ORG_ID,
    name: SITE.name,
    legalName: SITE.legalName,
    description:
      'Diagnostics immobiliers (DPE, packs vente et location, audit énergétique) à Paris et en Île-de-France. Tarif tout compris, rapport sous 48 h, diagnostiqueur certifié COFRAC.',
    url: SITE.url,
    telephone: SITE.phone,
    email: SITE.email,
    image: `${SITE.url}/og-default.png`,
    logo: `${SITE.url}/icon-512.png`,
    priceRange: SITE.priceRange,
    address: {
      '@type': 'PostalAddress',
      streetAddress: SITE.address.street || undefined,
      postalCode: SITE.address.postalCode || undefined,
      addressLocality: SITE.address.city,
      addressRegion: SITE.address.region,
      addressCountry: SITE.address.country,
    },
    geo: {
      '@type': 'GeoCoordinates',
      latitude: SITE.geo.latitude,
      longitude: SITE.geo.longitude,
    },
    areaServed: SITE.areaServed.map((name) => ({ '@type': 'AdministrativeArea', name })),
    openingHoursSpecification: [
      {
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
        opens: '08:00',
        closes: '19:00',
      },
    ],
  };
  if (SITE.sameAs.length) ld.sameAs = SITE.sameAs;
  // AggregateRating — uniquement si des avis réels existent ([À REMPLACER])
  if (Number(SITE.rating.count) > 0) {
    ld.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: SITE.rating.value.replace(',', '.'),
      reviewCount: SITE.rating.count,
    };
  }
  return ld;
}

/** LocalBusiness ciblé sur une zone précise (pages locales). */
export function localBusinessArea(areaName: string) {
  return {
    ...localBusiness(),
    areaServed: { '@type': 'City', name: areaName },
  };
}

/** Service pour une offre donnée. */
export function service(opts: { name: string; description: string; url: string; priceFrom: number }) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Service',
    serviceType: opts.name,
    name: opts.name,
    description: opts.description,
    url: new URL(opts.url, SITE.url).href,
    provider: { '@id': ORG_ID },
    areaServed: SITE.areaServed.map((name) => ({ '@type': 'AdministrativeArea', name })),
    offers: {
      '@type': 'Offer',
      priceCurrency: 'EUR',
      price: String(opts.priceFrom),
      priceSpecification: {
        '@type': 'PriceSpecification',
        priceCurrency: 'EUR',
        price: String(opts.priceFrom),
        valueAddedTaxIncluded: true,
      },
      availability: 'https://schema.org/InStock',
    },
  };
}

/** FAQPage à partir d'une liste question/réponse. */
export function faqPage(items: { q: string; a: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((it) => ({
      '@type': 'Question',
      name: it.q,
      acceptedAnswer: { '@type': 'Answer', text: it.a },
    })),
  };
}

/** Fil d'Ariane BreadcrumbList. */
export function breadcrumb(items: { name: string; url: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: it.name,
      item: new URL(it.url, SITE.url).href,
    })),
  };
}

/** Article (guides). */
export function article(opts: { headline: string; description: string; url: string; datePublished: string; dateModified?: string }) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: opts.headline,
    description: opts.description,
    url: new URL(opts.url, SITE.url).href,
    datePublished: opts.datePublished,
    dateModified: opts.dateModified ?? opts.datePublished,
    author: { '@type': 'Organization', name: SITE.name, '@id': ORG_ID },
    publisher: { '@id': ORG_ID },
    image: `${SITE.url}/og-default.png`,
  };
}
