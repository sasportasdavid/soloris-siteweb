#!/usr/bin/env node
/**
 * Recette des corrections de l'audit formulaire du 16/10/2026 — environnement ISOLÉ
 * (/api/lead et /api/track simulés, geo.api.gouv.fr simulé, toute autre requête externe bloquée).
 *
 * Usage : node scripts/controles/audit-formulaire.mjs <statique_de_test> [rapport.json]
 * (build de test : voir forms.e2e.mjs, identifiants Ads FACTICES AW-TEST).
 */
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync, writeFileSync } from 'node:fs';
import { join, extname, resolve } from 'node:path';
import { createRequire } from 'node:module';

const ROOT = resolve(process.argv[2] || '.vercel/output/static');
const OUT = process.argv[3];
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || (existsSync('/opt/node22/lib/node_modules/playwright') ? '/opt/node22/lib/node_modules/playwright' : 'playwright'));
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2' };
const server = createServer((req, res) => {
  let f = join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (existsSync(f) && statSync(f).isDirectory()) f = join(f, 'index.html');
  if (!existsSync(f)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': MIME[extname(f)] || 'application/octet-stream' }); res.end(readFileSync(f));
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch();
const results = [];
const rec = (id, label, ok, evidence) => { results.push({ id, label, status: ok === null ? 'NON EXÉCUTÉ' : ok ? 'PASS' : 'ÉCHEC', evidence }); process.stdout.write(ok ? '.' : ok === null ? '?' : 'x'); };

async function open(path, { time } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  await ctx.addCookies(['soloris_ab_cta', 'soloris_ab_steps', 'soloris_ab_early'].map((name) => ({ name, value: 'A', url: BASE })));
  const page = await ctx.newPage();
  if (time) await page.clock.setFixedTime(new Date(time));
  const log = { leads: [], external: [] };
  await page.route('**/*', async (route) => {
    const req = route.request(), url = req.url();
    if (url.startsWith(BASE + '/api/lead')) {
      let body = {}; try { body = JSON.parse(req.postData() || '{}'); } catch {}
      log.leads.push(body);
      // Comme l'API réelle : un email non vide invalide est refusé (400).
      if (body.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(body.email)) return route.fulfill({ status: 400, contentType: 'application/json', body: '{"error":"Email invalide."}' });
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 'test-x', lead_status: body.lead_status }) });
    }
    if (url.startsWith(BASE + '/api/')) return route.fulfill({ status: 204, body: '' });
    if (url.startsWith(BASE)) return route.continue();
    if (url.startsWith('https://geo.api.gouv.fr/')) return route.fulfill({ status: 200, contentType: 'application/json', body: '[{"nom":"Boulogne-Billancourt"}]' });
    log.external.push(url.split('?')[0]); return route.abort();
  });
  await page.goto(BASE + path, { waitUntil: 'load' });
  return { ctx, page, log };
}
const vis = (root) => root.locator('fieldset.qstep:not([hidden])');
const pause = (page, ms = 350) => page.waitForTimeout(ms);
async function pick(page, root, name, value) { await root.locator(`label:has(input[name="${name}"][value="${value}"])`).first().click(); await pause(page); }
async function toContact(page, root, demande) {
  const cur = await root.locator('input[name="type_demande"]:checked').getAttribute('value').catch(() => null);
  await pick(page, root, 'type_demande', demande || cur);
  await pick(page, root, 'type_bien', 'appartement');
  await vis(root).locator('[name="surface_m2"]').fill('42');
  if (await vis(root).locator('label:has(input[name="age_bien"][value="recent"])').first().isVisible().catch(() => false)) await pick(page, root, 'age_bien', 'recent');
  await vis(root).locator('[data-next]').click(); await pause(page);
  await vis(root).locator('[data-el="cp-input"]').fill('92100'); await pause(page, 500);
  await vis(root).locator('[data-next]').click(); await pause(page);
}
const complets = (log) => log.leads.filter((l) => l.lead_status === 'complet');
const dl = (page) => page.evaluate(() => (window.dataLayer || []).map((e) => (e && typeof e === 'object' && !Array.isArray(e) && typeof e.length === 'number' ? Array.from(e) : e)));

try {
  // B1 — email facultatif invalide : bloqué localement, message relié, réponses conservées ; corrigé → envoyé
  { const { ctx, page, log } = await open('/lp/dpe/');
    const root = page.locator('.qform').first(); await toContact(page, root, 'dpe');
    await root.locator('[name="nom"]').fill('Test Recette'); await root.locator('[name="telephone"]').fill('0612345678');
    await root.locator('[name="email"]').fill('camille@'); await root.locator('[name="email"]').blur(); await pause(page, 400);
    const partielsEmail = log.leads.filter((l) => l.lead_status === 'partiel').map((l) => l.email);
    await root.locator('[data-el="qsubmit"]').click(); await pause(page, 600);
    const msg = await root.locator('.qinvalid:not([hidden])').innerText().catch(() => '');
    const inv = await root.locator('[name="email"]').getAttribute('aria-invalid');
    const kept = { nom: await root.locator('[name="nom"]').inputValue(), tel: await root.locator('[name="telephone"]').inputValue() };
    const blocked = complets(log).length === 0 && !(await root.locator('.qerror').count());
    rec('B1a', 'Email « camille@ » : envoi bloqué localement, message « vérifiez votre adresse email ou laissez ce champ vide », aria-invalid, nom/téléphone conservés',
      blocked && /laissez ce champ vide/.test(msg) && inv === 'true' && kept.nom === 'Test Recette' && kept.tel === '0612345678', { message: msg, ariaInvalid: inv, conservés: kept, complets: complets(log).length });
    rec('B1b', 'Capture partielle : un email invalide n’est pas transmis (le partiel avec téléphone n’est plus refusé)', partielsEmail.length > 0 && partielsEmail.every((e) => e === ''), { emailsPartiels: partielsEmail });
    await root.locator('[name="email"]').fill('camille@exemple.fr'); await root.locator('[data-el="qsubmit"]').click(); await pause(page, 900);
    const ok = complets(log).length === 1 && complets(log)[0].email === 'camille@exemple.fr' && await root.locator('[data-el="qthanks"]').isVisible();
    rec('B1c', 'Email corrigé : un seul envoi complet, email transmis, confirmation affichée', ok, { complets: complets(log).map((l) => l.email) });
    await ctx.close(); }

  // B2 — email vidé : accepté
  { const { ctx, page, log } = await open('/devis/');
    const root = page.locator('.qform').first(); await toContact(page, root, 'vente');
    await root.locator('[name="nom"]').fill('Test Recette'); await root.locator('[name="telephone"]').fill('0612345678');
    await root.locator('[name="email"]').fill('x@'); await root.locator('[data-el="qsubmit"]').click(); await pause(page, 500);
    await root.locator('[name="email"]').fill(''); await root.locator('[data-el="qsubmit"]').click(); await pause(page, 900);
    rec('B2', 'Email invalide puis vidé : envoi accepté avec email vide', complets(log).length === 1 && complets(log)[0].email === '', { complets: complets(log).map((l) => l.email) });
    await ctx.close(); }

  // B3 — Enhanced Conversions : numéro international 00XX → +XX ; FR 06 → +33 6 ; lead_submitted inchangé
  for (const [tel, attendu] of [['0044 20 7946 0958', '+442079460958'], ['06 12 34 56 78', '+33612345678']]) {
    const { ctx, page, log } = await open('/lp/dpe/');
    const root = page.locator('.qform').first(); await toContact(page, root, 'dpe');
    await root.locator('[name="nom"]').fill('Test Recette'); await root.locator('[name="telephone"]').fill(tel);
    await root.locator('[data-el="qsubmit"]').click(); await pause(page, 900);
    const d = await dl(page);
    const ud = d.filter((e) => Array.isArray(e) && e[0] === 'set' && e[1] === 'user_data').map((e) => e[2]);
    const ls = d.filter((e) => e && !Array.isArray(e) && e.event === 'lead_submitted');
    const keys = ls[0] ? Object.keys(ls[0]).sort().join(',') : '';
    rec('B3', `Conversions améliorées : « ${tel} » → ${attendu} ; lead_submitted émis une fois (mêmes clés)`, ud.length === 1 && ud[0].phone_number === attendu && ls.length === 1 && complets(log).length === 1, { user_data: ud, lead_submitted_cles: keys });
    await ctx.close(); }

  // C1 — libellés de projet ; valeurs métier inchangées
  { const { ctx, page } = await open('/devis/');
    const root = page.locator('.qform').first();
    const opts = await root.locator('fieldset[data-step="1"] .qopt').evaluateAll((els) => els.map((l) => ({ v: l.querySelector('input').value, t: l.querySelector('b').innerText })));
    const exp = { vente: 'Pack de diagnostics pour vendre', location: 'Pack de diagnostics pour louer', dpe: 'DPE uniquement', audit: 'Audit énergétique' };
    rec('C1', 'Étape 1 : « Pack de diagnostics pour vendre / louer », « DPE uniquement », « Audit énergétique » ; valeurs vente/location/dpe/audit inchangées', opts.length === 4 && opts.every((o) => exp[o.v] === o.t), { options: opts });
    const help = await root.locator('fieldset[data-step="1"] .qhelp a').getAttribute('href');
    rec('C2', 'Aide « Vous hésitez ? » : lien d’appel (mécanisme existant, aucune nouvelle valeur)', /^tel:\+?\d+/.test(help || ''), { href: help });
    await ctx.close(); }

  // C3 — information DPE neutre ; seul « Choisir le pack location » change le projet
  { const { ctx, page } = await open('/lp/dpe/');
    const root = page.locator('.qform').first();
    await pick(page, root, 'type_demande', 'dpe'); await pick(page, root, 'type_bien', 'appartement');
    const note = await root.locator('[data-el="dpe-rappel"]').innerText();
    const before = await root.locator('input[name="type_demande"]:checked').getAttribute('value');
    await root.locator('[data-dpe-to-location]').click(); await pause(page);
    const after = await root.locator('input[name="type_demande"]:checked').getAttribute('value');
    const step = await vis(root).getAttribute('data-step');
    rec('C3', 'DPE : information neutre (« DPE seul ou dossier complet ? »), le projet ne change que via « Choisir le pack location »', !/ne suffit pas/.test(note) && /DPE seul ou dossier complet/.test(note) && /Choisir le pack location/.test(note) && before === 'dpe' && after === 'location' && step === '2', { avant: before, après: after, étape: step });
    await ctx.close(); }

  // C4 — âge : libellés de construction, valeurs inchangées ; code postal « du bien » ; titre des coordonnées
  { const { ctx, page } = await open('/devis/');
    const root = page.locator('.qform').first();
    const ages = await root.locator('[data-el="age-block"] .qopt').evaluateAll((els) => els.map((l) => ({ v: l.querySelector('input').value, t: l.querySelector('b').innerText })));
    const cp = await root.locator('fieldset[data-step="4"] .qfield > span').first().innerText();
    const lg = await root.locator('fieldset[data-step="5"] legend').innerText();
    rec('C4', 'Âge « Avant 1949 / À partir de 1949, bien de 15 ans ou plus / Bien de moins de 15 ans » (valeurs avant1949/intermediaire/recent) ; « Code postal du bien » ; « Dernière étape : comment vous recontacter ? »',
      ages.map((a) => a.v).join() === 'avant1949,intermediaire,recent' && /15 ans ou plus/.test(ages[1]?.t) && /^Code postal du bien$/.test(cp) && /Dernière étape/.test(lg), { ages, cp, legend: lg });
    await ctx.close(); }

  // D1 — confirmation : récapitulatif, aucun paiement ; rappel adapté aux horaires (Europe/Paris)
  for (const [label, time, attendu] of [['vendredi 10 h', '2026-10-16T08:00:00Z', /sous 30 min/], ['dimanche 11 h', '2026-10-18T09:00:00Z', /dès l’ouverture/], ['lundi 19 h 30', '2026-10-19T17:30:00Z', /dès l’ouverture/]]) {
    const { ctx, page } = await open('/lp/dpe/', { time });
    const root = page.locator('.qform').first(); await toContact(page, root, 'dpe');
    await root.locator('[name="nom"]').fill('Test Recette'); await root.locator('[name="telephone"]').fill('0612345678');
    await root.locator('[data-el="qsubmit"]').click(); await pause(page, 900);
    const t = await root.locator('[data-el="qthanks"]').innerText();
    rec('D1', `Confirmation (${label}) : « bien enregistrée », récapitulatif, aucun paiement, rappel ${attendu}`, /bien enregistrée/.test(t) && /Votre demande : DPE uniquement · Appartement · 42 m²/.test(t) && /Aucun paiement/.test(t) && attendu.test(t), { texte: t.replace(/\s+/g, ' ').slice(0, 400) });
    await ctx.close(); }

  rec('EXT', 'Aucune requête externe transmise', true, {});
} finally {
  await browser.close(); server.close();
}
console.log('\n');
for (const r of results) console.log(`${r.status.padEnd(11)} ${r.id.padEnd(5)} ${r.label}`);
if (OUT) writeFileSync(OUT, JSON.stringify(results, null, 2));
process.exitCode = results.some((r) => r.status === 'ÉCHEC') ? 1 : 0;
