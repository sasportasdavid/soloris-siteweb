#!/usr/bin/env node
/**
 * Contrôles éditoriaux — captures d'écran pleine page (vérification de présentation).
 *
 * Sert le dossier statique sur un port local, JavaScript ACTIVÉ, toute requête externe
 * bloquée (aucun tag, aucune conversion, aucun appel API réel : /api/* répond 204).
 * Le bandeau de consentement est refusé avant la capture.
 * Signale aussi les débordements horizontaux (largeur du document > largeur d'écran).
 *
 * Usage :  node scripts/controles/captures.mjs <dossier_sortie> <dossier_statique> <largeurs> <route> [route…]
 *   ex. :  node scripts/controles/captures.mjs /tmp/captures /tmp/static 390x844,1440x1000 / /dpe/ /lp/dpe/
 *   Option : CAPTURE_VIEWPORT_ONLY=1 → capture du premier écran seulement (en plus de la pleine page).
 */
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, extname, resolve } from 'node:path';
import { createRequire } from 'node:module';

const [OUT, STATIC, WIDTHS, ...ROUTES] = process.argv.slice(2);
if (!OUT || !STATIC || !WIDTHS || !ROUTES.length) { console.error('Usage : captures.mjs <sortie> <statique> <largeurs> <route…>'); process.exit(2); }
const ROOT = resolve(STATIC);
mkdirSync(OUT, { recursive: true });

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || (existsSync('/opt/node22/lib/node_modules/playwright') ? '/opt/node22/lib/node_modules/playwright' : 'playwright'));
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.xml': 'application/xml', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.txt': 'text/plain' };

const server = createServer((req, res) => {
  const p = decodeURIComponent(req.url.split('?')[0]);
  if (p.startsWith('/api/')) { res.writeHead(204); return res.end(); }
  let f = join(ROOT, p);
  if (existsSync(f) && statSync(f).isDirectory()) f = join(f, 'index.html');
  if (!existsSync(f)) { res.writeHead(404); return res.end('404'); }
  res.writeHead(200, { 'content-type': MIME[extname(f)] || 'application/octet-stream' });
  res.end(readFileSync(f));
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}`;

const browser = await chromium.launch();
const report = [];
// Largeurs « 390 » ou dimensions « 390x844 » (hauteur du premier écran ; la capture reste pleine page).
for (const spec of WIDTHS.split(',')) {
  const [w, hSpec] = spec.split('x').map(Number);
  const ctx = await browser.newContext({ viewport: { width: w, height: hSpec || (w < 768 ? 800 : 900) }, deviceScaleFactor: 1 });
  await ctx.route('**/*', (route) => (route.request().url().startsWith(BASE) ? route.continue() : route.abort()));
  // Variante d'expérience fixée (AB_VARIANT, A par défaut) : avant et après comparables.
  const v = process.env.AB_VARIANT || 'A';
  await ctx.addCookies(['cta', 'steps', 'early'].map((k) => ({ name: 'soloris_ab_' + k, value: v, url: BASE })));
  const page = await ctx.newPage();
  for (const r of ROUTES) {
    await page.goto(BASE + r, { waitUntil: 'load' });
    const refuse = page.locator('#consent-refuse');
    if (await refuse.isVisible().catch(() => false)) await refuse.click();
    await page.waitForTimeout(300);
    const { sw, cw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
    const name = `${(r.replace(/^\/|\/$/g, '').replace(/\//g, '_') || 'accueil')}-${w}.png`;
    await page.screenshot({ path: join(OUT, name), fullPage: true });
    if (process.env.CAPTURE_VIEWPORT_ONLY) await page.screenshot({ path: join(OUT, name.replace(/\.png$/, '-ecran.png')) });
    report.push({ route: r, largeur: w, debordement: sw > cw ? `${sw - cw}px` : '', capture: name });
    process.stdout.write('.');
  }
  await ctx.close();
}
await browser.close();
server.close();
writeFileSync(join(OUT, 'captures.json'), JSON.stringify(report, null, 2));
console.log(`\n${report.length} captures → ${OUT}`);
const over = report.filter((x) => x.debordement);
console.log(over.length ? `DÉBORDEMENT horizontal : ${over.map((x) => `${x.route} @${x.largeur} (+${x.debordement})`).join(', ')}` : 'Aucun débordement horizontal.');
