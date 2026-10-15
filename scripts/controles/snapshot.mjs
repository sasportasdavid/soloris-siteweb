#!/usr/bin/env node
/**
 * Contrôles éditoriaux — instantané du site construit (aucun appel réseau externe).
 *
 * Sert le dossier statique produit par `astro build` sur un port local, ouvre chaque page
 * avec JavaScript DÉSACTIVÉ (HTML initial, tel que vu par Google et avant tout script),
 * et enregistre par route : title, meta description, robots, canonical, H1/H2, JSON-LD,
 * montants visibles, liens internes, et la SIGNATURE TECHNIQUE des formulaires et scripts
 * (attributs de chaque élément de formulaire, empreinte de chaque <script>).
 *
 * Usage :  node scripts/controles/snapshot.mjs <sortie.json> [dossier_statique]
 * Le dossier par défaut est .vercel/output/static (sortie de `npx astro build`).
 * Playwright : module global (PLAYWRIGHT_MODULE) ou `playwright` résolu normalement.
 */
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { readFileSync, existsSync, statSync, writeFileSync, readdirSync } from 'node:fs';
import { join, extname, resolve } from 'node:path';
import { createRequire } from 'node:module';

const OUT = process.argv[2];
const ROOT = resolve(process.argv[3] || '.vercel/output/static');
if (!OUT) { console.error('Usage : snapshot.mjs <sortie.json> [dossier_statique]'); process.exit(2); }

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || (existsSync('/opt/node22/lib/node_modules/playwright') ? '/opt/node22/lib/node_modules/playwright' : 'playwright'));

const sha = (s) => createHash('sha256').update(s).digest('hex').slice(0, 16);
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.xml': 'application/xml', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.txt': 'text/plain' };

function fileFor(urlPath) {
  const p = decodeURIComponent(urlPath.split('?')[0]);
  let f = join(ROOT, p);
  if (existsSync(f) && statSync(f).isDirectory()) f = join(f, 'index.html');
  return existsSync(f) ? f : null;
}

const server = createServer((req, res) => {
  const f = fileFor(req.url);
  if (!f) { res.writeHead(404); return res.end('404'); }
  res.writeHead(200, { 'content-type': MIME[extname(f)] || 'application/octet-stream' });
  res.end(readFileSync(f));
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}`;

// Routes publiques = toutes les pages statiques hors back-office.
function walk(dir, acc = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, acc);
    else if (e.name === 'index.html') acc.push('/' + p.slice(ROOT.length + 1).replace(/index\.html$/, ''));
  }
  return acc;
}
const routes = walk(ROOT).map((r) => r.replace(/\/+/g, '/')).filter((r) => !r.startsWith('/admin')).sort();

const browser = await chromium.launch();
const ctx = await browser.newContext({ javaScriptEnabled: false });
const page = await ctx.newPage();
// Aucun appel hors du serveur local (pas de tag, pas d'API).
await page.route('**/*', (route) => (route.request().url().startsWith(BASE) ? route.continue() : route.abort()));

const result = { generatedAt: new Date().toISOString(), root: ROOT, routes: {} };
for (const r of routes) {
  const resp = await page.goto(BASE + r, { waitUntil: 'domcontentloaded' });
  const data = await page.evaluate(() => {
    const q = (s) => document.querySelector(s);
    const txt = (el) => (el ? el.textContent.replace(/\s+/g, ' ').trim() : null);
    const attrs = (el) => Object.fromEntries([...el.attributes].map((a) => [a.name, a.value]).sort((a, b) => a[0].localeCompare(b[0])));
    // Texte visible sans scripts/styles/éléments cachés (approximation du rendu initial).
    const clone = document.body.cloneNode(true);
    clone.querySelectorAll('script,style,noscript,template,[hidden],[aria-hidden="true"]').forEach((n) => n.remove());
    const bodyText = clone.textContent.replace(/\s+/g, ' ').trim();
    const formRoots = [...document.querySelectorAll('.qform, form')].filter((el, i, all) => !all.some((o) => o !== el && o.contains(el)));
    return {
      title: document.title,
      description: q('meta[name="description"]')?.content ?? null,
      robots: q('meta[name="robots"]')?.content ?? null,
      canonical: q('link[rel="canonical"]')?.href ?? null,
      h1: [...document.querySelectorAll('h1')].map(txt),
      h2: [...document.querySelectorAll('h2')].map(txt),
      jsonld: [...document.querySelectorAll('script[type="application/ld+json"]')].map((s) => s.textContent),
      prices: [...new Set((bodyText.match(/\d[\d  ]*(?:,\d+)?\s?€/g) || []).map((s) => s.replace(/[  ]/g, ' ')))],
      bodyText,
      links: [...new Set([...document.querySelectorAll('a[href]')].map((a) => a.getAttribute('href')))],
      telLinks: [...document.querySelectorAll('a[href^="tel:"]')].map(attrs),
      images: [...document.querySelectorAll('img')].map((i) => ({ src: i.getAttribute('src'), alt: i.getAttribute('alt') })),
      ids: [...document.querySelectorAll('[id]')].map((e) => e.id),
      forms: formRoots.map((root) => ({
        root: root.tagName.toLowerCase() + (root.id ? '#' + root.id : '') + '.' + [...root.classList].join('.'),
        elements: [root, ...root.querySelectorAll('*')]
          .filter((el) => !['svg', 'path', 'circle', 'rect', 'line', 'polyline', 'g'].includes(el.tagName.toLowerCase()) || el.attributes.length)
          .map((el) => [el.tagName.toLowerCase(), attrs(el)]),
        text: txt(root),
      })),
      scripts: [...document.querySelectorAll('script')].map((s) => ({ type: s.getAttribute('type') || '', src: s.getAttribute('src') || '', inline: s.src ? null : s.textContent })),
    };
  });
  for (const f of data.forms) { f.signature = f.elements.map((e) => JSON.stringify(e)).join('\n'); f.sigHash = sha(f.signature); }
  data.scripts = data.scripts.map((s) => {
    let content = s.inline;
    if (s.src && !/^https?:/.test(s.src)) { const f = fileFor(s.src); content = f ? readFileSync(f, 'utf8') : '[introuvable]'; }
    return { type: s.type, src: s.src.replace(/\.[A-Za-z0-9_-]{8}\.js$/, '.[hash].js'), hash: content == null ? null : sha(content), len: content?.length ?? 0, content: s.type === 'application/ld+json' ? undefined : content };
  });
  result.routes[r] = { status: resp.status(), ...data };
  process.stdout.write('.');
}
await browser.close();

// Sitemap et robots, tels que générés.
const sm = [];
for (const f of readdirSync(ROOT).filter((n) => /^sitemap-\d+\.xml$/.test(n))) sm.push(...[...readFileSync(join(ROOT, f), 'utf8').matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]));
result.sitemap = sm.sort();
result.robotsTxt = existsSync(join(ROOT, 'robots.txt')) ? readFileSync(join(ROOT, 'robots.txt'), 'utf8') : null;
server.close();
writeFileSync(OUT, JSON.stringify(result, null, 1));
console.log(`\n${routes.length} routes → ${OUT}`);
