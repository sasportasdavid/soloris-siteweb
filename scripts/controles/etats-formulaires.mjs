#!/usr/bin/env node
/**
 * Captures des ÉTATS des formulaires (cahier Design UX V3 : « états formulaires avant/après »).
 *
 * Même isolation que forms.e2e.mjs : /api/lead simulé (partiels ET complets), /api/* → 204,
 * geo.api.gouv.fr simulé, toute autre requête bloquée ; cookies d'expérience fixés à A.
 * Aucun lead, email, notification ni conversion ne quitte la machine.
 *
 * Usage : node scripts/controles/etats-formulaires.mjs <statique_de_test> <dossier_sortie> [WxH,…]
 * Sortie : <parcours>-<état>-<largeur>.png (capture de la racine du formulaire) + etats.json.
 */
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, extname, resolve } from 'node:path';
import { createRequire } from 'node:module';

const [STATIC, OUTDIR, SIZES = '390x844,1440x1000'] = process.argv.slice(2);
if (!STATIC || !OUTDIR) { console.error('Usage : etats-formulaires.mjs <statique> <sortie> [WxH,…]'); process.exit(2); }
const ROOT = resolve(STATIC); mkdirSync(OUTDIR, { recursive: true });
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
const browser = await chromium.launch();
const shots = [];

/** api : ok | slow | error500 */
async function open(path, vp, api = 'ok') {
  const ctx = await browser.newContext({ viewport: vp, serviceWorkers: 'block' });
  await ctx.addCookies(['cta', 'steps', 'early'].map((k) => ({ name: 'soloris_ab_' + k, value: 'A', url: BASE })));
  const page = await ctx.newPage();
  const log = { leads: 0, external: 0 };
  await page.route('**/*', async (route) => {
    const req = route.request(), url = req.url();
    if (url.startsWith(BASE + '/api/lead')) {
      let body = {}; try { body = JSON.parse(req.postData() || '{}'); } catch {}
      log.leads++;
      if (body.lead_status === 'complet') {
        if (api === 'error500') return route.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"test"}' });
        if (api === 'slow') await new Promise((r) => setTimeout(r, 4000));
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 'test-recette', lead_status: body.lead_status }) });
    }
    if (url.startsWith(BASE + '/api/')) {
      if (api === 'error500' && req.method() === 'POST') return route.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"test"}' });
      if (api === 'slow' && req.method() === 'POST') await new Promise((r) => setTimeout(r, 4000));
      return route.fulfill({ status: req.method() === 'POST' ? 200 : 204, contentType: 'application/json', body: req.method() === 'POST' ? '{"ok":true,"id":"test-recette"}' : '' });
    }
    if (url.startsWith(BASE)) return route.continue();
    if (url.startsWith('https://geo.api.gouv.fr/')) return route.fulfill({ status: 200, contentType: 'application/json', body: '[{"nom":"Paris 11e"},{"nom":"Paris"}]' });
    log.external++; return route.abort();
  });
  await page.goto(BASE + path, { waitUntil: 'load' });
  // Bandeau de consentement : refus (comme la recette), pour ne pas masquer le formulaire.
  const refuse = page.locator('button:has-text("Refuser")').first();
  if (await refuse.isVisible().catch(() => false)) await refuse.click();
  return { ctx, page, log };
}
const pause = (page, ms = 380) => page.waitForTimeout(ms);
const vstep = (root) => root.locator('fieldset.qstep:not([hidden])');
async function pick(page, root, name, value) { await root.locator(`label:has(input[name="${name}"][value="${value}"])`).first().click(); await pause(page); }
async function next(page, root) { await vstep(root).locator('[data-next]').click(); await pause(page, 200); }
async function snap(page, loc, id, w) {
  await loc.scrollIntoViewIfNeeded(); await pause(page, 250);
  const file = `${id}-${w}.png`; await loc.screenshot({ path: join(OUTDIR, file) }); shots.push(file);
}

for (const s of SIZES.split(',')) {
  const [w, h] = s.split('x').map(Number); const vp = { width: w, height: h };

  // QuoteForm — LP vente A (estimation révélée au succès) : tous les états intermédiaires
  { const { ctx, page } = await open('/lp/vente-prix/', vp); const root = page.locator('.qform').first();
    await snap(page, root, 'qf-venteA-1-initial', w);
    await pick(page, root, 'type_demande', 'vente'); await snap(page, root, 'qf-venteA-2-choix', w);
    await pick(page, root, 'type_bien', 'appartement'); await root.locator('[name="surface_m2"]').fill('20'); await pick(page, root, 'age_bien', 'recent');
    await snap(page, root, 'qf-venteA-3-bien', w);
    await next(page, root); await root.locator('[data-el="cp-input"]').fill('75011'); await pause(page, 300);
    await snap(page, root, 'qf-venteA-4-adresse', w);
    await next(page, root); await snap(page, root, 'qf-venteA-5-coordonnees', w);
    await root.locator('[data-el="qsubmit"]').click(); await pause(page, 400);
    await snap(page, root, 'qf-venteA-6-erreur-champs', w);
    await root.locator('[name="nom"]').fill('Test Recette'); await root.locator('[name="telephone"]').fill('0612345678');
    await root.locator('[name="nom"]').focus(); await snap(page, root, 'qf-venteA-7-focus', w);
    await root.locator('[data-el="qsubmit"]').click(); await pause(page, 900);
    await snap(page, root, 'qf-venteA-8-succes-prix-revele', w);
    await ctx.close(); }

  // QuoteForm — envoi lent (bouton pendant l'attente) puis échec API
  { const { ctx, page } = await open('/lp/vente-prix/', vp, 'slow'); const root = page.locator('.qform').first();
    await pick(page, root, 'type_demande', 'vente'); await pick(page, root, 'type_bien', 'appartement'); await root.locator('[name="surface_m2"]').fill('20'); await pick(page, root, 'age_bien', 'recent');
    await next(page, root); await root.locator('[data-el="cp-input"]').fill('75011'); await pause(page, 300); await next(page, root);
    await root.locator('[name="nom"]').fill('Test Recette'); await root.locator('[name="telephone"]').fill('0612345678');
    await root.locator('[data-el="qsubmit"]').click(); await pause(page, 600);
    await snap(page, root, 'qf-venteA-9-envoi-lent', w); await pause(page, 4200);
    await ctx.close(); }
  { const { ctx, page } = await open('/lp/vente-prix/', vp, 'error500'); const root = page.locator('.qform').first();
    await pick(page, root, 'type_demande', 'vente'); await pick(page, root, 'type_bien', 'appartement'); await root.locator('[name="surface_m2"]').fill('20'); await pick(page, root, 'age_bien', 'recent');
    await next(page, root); await root.locator('[data-el="cp-input"]').fill('75011'); await pause(page, 300); await next(page, root);
    await root.locator('[name="nom"]').fill('Test Recette'); await root.locator('[name="telephone"]').fill('0612345678');
    await root.locator('[data-el="qsubmit"]').click(); await pause(page, 900);
    await snap(page, root, 'qf-venteA-10-echec-api', w);
    await ctx.close(); }

  // QuoteForm — LP vente B (aucun montant visible) et LP DPE (revealEstimation=false) : succès
  for (const [path, id, demande, surface] of [['/lp/vente-sans-prix/', 'qf-venteB', 'vente', '20'], ['/lp/dpe/', 'qf-dpe', 'dpe', '35']]) {
    const { ctx, page } = await open(path, vp); const root = page.locator('.qform').first();
    await snap(page, root, `${id}-1-initial`, w);
    await pick(page, root, 'type_demande', demande); await pick(page, root, 'type_bien', 'appartement'); await root.locator('[name="surface_m2"]').fill(surface);
    if (demande === 'vente') await pick(page, root, 'age_bien', 'recent');
    await snap(page, root, `${id}-3-bien`, w);
    await next(page, root); await root.locator('[data-el="cp-input"]').fill('75011'); await pause(page, 300); await next(page, root);
    await root.locator('[name="nom"]').fill('Test Recette'); await root.locator('[name="telephone"]').fill('0612345678');
    await root.locator('[data-el="qsubmit"]').click(); await pause(page, 900);
    await snap(page, root, `${id}-8-succes`, w);
    await ctx.close(); }

  // CallbackForm (accueil, #rappel) : initial, erreur, succès
  { const { ctx, page } = await open('/', vp); const root = page.locator('.cbform').first();
    if (await root.count()) {
      await snap(page, root, 'cb-1-initial', w);
      await root.locator('button[type="submit"], .cbform-submit').first().click(); await pause(page, 400);
      await snap(page, root, 'cb-2-erreur', w);
      await root.locator('[name="telephone"]').fill('0612345678');
      const cp = root.locator('[name="secteur"]').first();
      if (await cp.count() && await cp.isVisible()) { await cp.fill('75011'); await pause(page, 300); }
      await root.locator('button[type="submit"], .cbform-submit').first().click(); await pause(page, 900);
      await snap(page, root, 'cb-3-apres-envoi', w);
    }
    await ctx.close(); }

  // ContactForm (/contact) : initial, erreur, succès
  { const { ctx, page } = await open('/contact/', vp); const root = page.locator('#cform');
    await snap(page, root, 'ct-1-initial', w);
    await root.locator('button[type="submit"]').first().click(); await pause(page, 400);
    await snap(page, root, 'ct-2-erreur', w);
    await root.locator('[name="nom"]').fill('Test Recette'); await root.locator('[name="telephone"]').fill('0612345678');
    await root.locator('[name="email"]').fill('recette@example.test'); await root.locator('[name="message"]').fill('Message de recette isolée.');
    await root.locator('button[type="submit"]').first().click(); await pause(page, 900);
    await snap(page, root, 'ct-3-apres-envoi', w);
    await ctx.close(); }
}
writeFileSync(join(OUTDIR, 'etats.json'), JSON.stringify({ static: ROOT, shots }, null, 1));
console.log(`${shots.length} captures → ${OUTDIR}`);
await browser.close(); server.close();
