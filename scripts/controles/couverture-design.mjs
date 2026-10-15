#!/usr/bin/env node
/**
 * Couverture des URL publiques (cahier Design UX V3 : « couverture des URL », fichier CSV non fourni).
 *
 * Pour CHAQUE page HTML du build : activation de la feuille V3 (attribut body[data-soloris-design]),
 * débordement horizontal, erreurs JavaScript de page, nombre de formulaires rendus.
 * Isolation : toute requête non locale bloquée, /api/* → 204, aucune saisie.
 *
 * Usage : node scripts/controles/couverture-design.mjs <statique> <sortie.csv> [WxH,…]
 */
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync, writeFileSync, readdirSync } from 'node:fs';
import { join, extname, resolve, relative, sep } from 'node:path';
import { createRequire } from 'node:module';

const [STATIC, OUT, SIZES = '390x844,1440x1000'] = process.argv.slice(2);
if (!STATIC || !OUT) { console.error('Usage : couverture-design.mjs <statique> <sortie.csv> [WxH,…]'); process.exit(2); }
const ROOT = resolve(STATIC);
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || (existsSync('/opt/node22/lib/node_modules/playwright') ? '/opt/node22/lib/node_modules/playwright' : 'playwright'));
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2' };
const server = createServer((req, res) => {
  let f = join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (existsSync(f) && statSync(f).isDirectory()) f = join(f, 'index.html');
  if (!existsSync(f)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': MIME[extname(f)] || 'application/octet-stream' }); res.end(readFileSync(f));
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}`;

const routes = [];
(function walk(d) { for (const e of readdirSync(d, { withFileTypes: true })) { const p = join(d, e.name); if (e.isDirectory()) { if (e.name !== '_astro') walk(p); } else if (e.name === 'index.html') routes.push('/' + relative(ROOT, d).split(sep).join('/') + (d === ROOT ? '' : '/')); } })(ROOT);
routes.sort();

const EXCLUDED = /^\/(?:admin|api|rdv)(?:\/|$)|^\/devis\/signer(?:\/|$)/;
const browser = await chromium.launch();
const rows = [['route', 'ecran', 'activation_v3', 'debordement_px', 'erreurs_js', 'formulaires', 'statut']];
let fails = 0;
for (const s of SIZES.split(',')) {
  const [w, h] = s.split('x').map(Number);
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, serviceWorkers: 'block' });
  await ctx.addCookies(['cta', 'steps', 'early'].map((k) => ({ name: 'soloris_ab_' + k, value: 'A', url: BASE })));
  await ctx.route('**/*', (r) => { const u = r.request().url(); if (u.startsWith(BASE + '/api/')) return r.fulfill({ status: 204, body: '' }); return u.startsWith(BASE) ? r.continue() : r.abort(); });
  const page = await ctx.newPage();
  for (const route of routes.map((r) => r.replace(/\/\/$/, '/'))) {
    const errors = []; const onErr = (e) => errors.push(String(e.message || e).slice(0, 80)); page.on('pageerror', onErr);
    await page.goto(BASE + route, { waitUntil: 'load' }); await page.waitForTimeout(150);
    const m = await page.evaluate(() => ({ v3: document.body.getAttribute('data-soloris-design') || '', ov: Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth), forms: document.querySelectorAll('.qform, form').length }));
    page.off('pageerror', onErr);
    // Back-office et parcours privés : la feuille V3 ne doit PAS s'y appliquer (attribut absent attendu) ;
    // leurs erreurs JS locales (variables Supabase absentes du build de recette) sont signalées, pas jugées.
    const excluded = EXCLUDED.test(route);
    const ok = excluded ? m.v3 === '' : m.v3 === 'v3' && m.ov === 0 && errors.length === 0;
    if (!ok) fails++;
    rows.push([route, `${w}x${h}`, m.v3 || 'absente', m.ov, errors.length ? errors.join(' / ').replace(/;/g, ',') : 0, m.forms, ok ? (excluded ? 'PASS (exclue, attribut absent attendu)' : 'PASS') : 'ÉCHEC']);
  }
  await ctx.close();
}
writeFileSync(OUT, rows.map((r) => r.join(';')).join('\n') + '\n');
console.log(`${routes.length} routes × ${SIZES.split(',').length} écrans — ${fails} ÉCHEC(s) → ${OUT}`);
await browser.close(); server.close();
process.exit(fails ? 1 : 0);
