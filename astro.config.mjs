// @ts-check
import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel';
import sitemap from '@astrojs/sitemap';

// Domaine canonique du site — [À REMPLACER] par le domaine de production réel.
const SITE_URL = process.env.SITE_URL || 'https://www.soloris.fr';

// https://astro.build/config
export default defineConfig({
  site: SITE_URL,
  // 'static' = rendu statique par défaut (idéal SEO / Core Web Vitals).
  // Les routes serveur (formulaire, admin) optent via `export const prerender = false`.
  output: 'static',
  adapter: vercel({
    webAnalytics: { enabled: false },
    imageService: true,
  }),
  integrations: [
    sitemap({
      // On exclut du sitemap les pages non indexables : back-office, pages de
      // signature de devis (tokenisées, noindex) et landing pages Ads (/lp/*,
      // noindex via LandingLayout). Mentions légales & confidentialité
      // sont désormais indexées → elles RESTENT dans le sitemap.
      filter: (page) =>
        !page.includes('/admin') && !page.includes('/devis/signer') && !page.includes('/lp/'),
    }),
  ],
  prefetch: {
    prefetchAll: true,
    defaultStrategy: 'hover',
  },
  build: {
    inlineStylesheets: 'auto',
  },
});
