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
      // On exclut le back-office et les endpoints du sitemap public.
      filter: (page) => !page.includes('/admin'),
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
