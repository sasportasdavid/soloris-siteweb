#!/usr/bin/env node
/**
 * Recette navigateur des formulaires — environnement ISOLÉ (aucun lead, aucune notification,
 * aucune conversion ne quitte la machine).
 *
 * - Sert un build local (à produire avec des identifiants Ads FACTICES, voir plus bas).
 * - Intercepte /api/lead et /api/track (réponses simulées), simule geo.api.gouv.fr et
 *   BLOQUE toute autre requête externe (Google, Meta, etc.) : les tentatives sont seulement
 *   journalisées. Les conversions sont observées dans window.dataLayer (gtag les y empile).
 *
 * Build de test :
 *   PUBLIC_GADS_ID=AW-TEST PUBLIC_GADS_CONVERSION_LABEL=FORMTEST PUBLIC_GADS_PHONE_LABEL=PHONETEST \
 *     npx astro build && cp -r .vercel/output/static /tmp/static-test
 * Usage :  node scripts/controles/forms.e2e.mjs /tmp/static-test [rapport.json]
 *
 * Chaque cas renvoie PASS / ÉCHEC / NON EXÉCUTÉ avec sa preuve. Un cas non couvert reste
 * NON EXÉCUTÉ : il n'est jamais supposé réussi.
 */
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync, writeFileSync } from 'node:fs';
import { join, extname, resolve } from 'node:path';
import { createRequire } from 'node:module';

const ROOT = resolve(process.argv[2] || '.vercel/output/static');
const OUT = process.argv[3];
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || (existsSync('/opt/node22/lib/node_modules/playwright') ? '/opt/node22/lib/node_modules/playwright' : 'playwright'));
const FORM_LABEL = 'AW-TEST/FORMTEST', DPE_LABEL = 'AW-TEST/jvpdCNyZ4cAcEJXottlD', PHONE_LABEL = 'AW-TEST/PHONETEST';

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
const results = [];
const rec = (id, label, ok, evidence) => { results.push({ id, label, status: ok === null ? 'NON EXÉCUTÉ' : ok ? 'PASS' : 'ÉCHEC', evidence }); process.stdout.write(ok ? '.' : ok === null ? '?' : 'x'); };

/** Ouvre une page isolée. api : ok | error500 | noid | abort ; geo : ok | fail. */
async function open(path, { api = 'ok', geo = 'ok', cookies = { soloris_ab_cta: 'A', soloris_ab_steps: 'A', soloris_ab_early: 'A' }, viewport } = {}) {
  const ctx = await browser.newContext({ viewport: viewport || { width: 1280, height: 900 } });
  if (cookies) await ctx.addCookies(Object.entries(cookies).map(([name, value]) => ({ name, value, url: BASE })));
  const page = await ctx.newPage();
  const log = { leads: [], external: [], track: 0 };
  await page.route('**/*', async (route) => {
    const req = route.request(), url = req.url();
    if (url.startsWith(BASE + '/api/lead')) {
      let body = {}; try { body = JSON.parse(req.postData() || '{}'); } catch {}
      log.leads.push(body);
      if (body.lead_status === 'complet') {
        if (api === 'abort') return route.abort();
        if (api === 'error500') return route.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"test"}' });
        if (api === 'noid') return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 'test-' + (body.lead_uid || 'x').slice(0, 8), lead_status: body.lead_status }) });
    }
    if (url.startsWith(BASE + '/api/')) { log.track++; return route.fulfill({ status: 204, body: '' }); }
    if (url.startsWith(BASE)) return route.continue();
    if (url.startsWith('https://geo.api.gouv.fr/')) return geo === 'ok' ? route.fulfill({ status: 200, contentType: 'application/json', body: '[{"nom":"Paris 11e"},{"nom":"Paris"}]' }) : route.abort();
    log.external.push(url.split('?')[0]); return route.abort();
  });
  await page.goto(BASE + path, { waitUntil: 'load' });
  return { ctx, page, log };
}
const dl = (page) => page.evaluate(() => (window.dataLayer || []).map((e) => (e && typeof e === 'object' && !Array.isArray(e) && typeof e.length === 'number' ? Array.from(e) : e)));
const conversions = (d) => d.filter((e) => Array.isArray(e) && e[0] === 'event' && e[1] === 'conversion').map((e) => e[2]);
const events = (d, name) => d.filter((e) => e && !Array.isArray(e) && e.event === name);
const complets = (log) => log.leads.filter((l) => l.lead_status === 'complet');
const visibleStep = (root) => root.locator('fieldset.qstep:not([hidden])');
const pause = (page, ms = 380) => page.waitForTimeout(ms);

async function pick(page, root, name, value) { await root.locator(`label:has(input[name="${name}"][value="${value}"])`).first().click(); await pause(page); }
async function next(page, root) { await visibleStep(root).locator('[data-next]').click(); await pause(page, 150); }
/** Parcours complet A (5 étapes). Renvoie la racine. */
async function fill(page, idx, o) {
  const root = page.locator('.qform').nth(idx);
  await root.scrollIntoViewIfNeeded();
  await pick(page, root, 'type_demande', o.demande);
  await pick(page, root, 'type_bien', o.bien || 'appartement');
  if (o.surface != null) await root.locator('[name="surface_m2"]').fill(String(o.surface));
  if (o.age) await pick(page, root, 'age_bien', o.age);
  if (o.copro) await root.locator('[name="copropriete"]').check();
  if (o.annexe) await root.locator(o.bien === 'maison' ? '[name="annexe_maison"]' : '[name="annexe_appart"]').check();
  await next(page, root);
  await root.locator('[data-el="cp-input"]').fill(o.cp || '75011'); await pause(page, 300);
  await next(page, root);
  await root.locator('[name="nom"]').fill('Test Recette');
  await root.locator('[name="telephone"]').fill(o.tel || '0612345678');
  if (o.email) await root.locator('[name="email"]').fill(o.email);
  return root;
}
async function submit(page, root, { double = false } = {}) {
  const btn = root.locator('[data-el="qsubmit"]');
  if (double) await btn.dblclick(); else await btn.click();
  await page.waitForTimeout(700);
}
const isVisible = (loc) => loc.evaluate((el) => !el.hidden && !el.closest('[hidden]'));
const est = (root) => root.locator('[name="estimation"]').inputValue();

try {
  // F01 + F07 + F11 — Devis DPE complet sur /lp/dpe (formulaire 1), email vide
  { const { ctx, page, log } = await open('/lp/dpe/');
    const root = await fill(page, 0, { demande: 'dpe', surface: 35 });
    await submit(page, root); const d = await dl(page); const c = conversions(d); const ls = events(d, 'lead_submitted');
    const okF01 = complets(log).length === 1 && complets(log)[0].type_demande === 'dpe' && ls.length === 1 && ls[0].projet === 'dpe' && ls[0].prix_estime === 150 && ls[0].currency === 'EUR'
      && c.length === 1 && c[0].send_to === DPE_LABEL && !c.some((x) => x.send_to === FORM_LABEL);
    rec('F01', 'Devis DPE complet : 1 écriture complète, 1 lead_submitted, 1 conversion DPE, aucune Vente', okF01, { complets: complets(log).length, lead_submitted: ls, conversions: c });
    const thanks = await isVisible(root.locator('[data-el="qthanks"]')), estimShown = await isVisible(root.locator('[data-el="qthanks-estim"]'));
    rec('F07', 'LP DPE : DPE présélectionné, aucun tarif personnalisé révélé après succès (revealEstimation=false)', thanks && !estimShown && complets(log)[0]?.estimation === '150', { thanks, estimShown, estimationTransmise: complets(log)[0]?.estimation });
    rec('F11', 'Email vide accepté par QuoteForm', thanks && complets(log)[0]?.email === '', { email: complets(log)[0]?.email });
    rec('EXT', 'Aucune requête externe transmise (toutes bloquées et journalisées)', true, { bloquées: [...new Set(log.external)] });
    await ctx.close(); }

  // F02 — vente (LP prix), location et audit (/devis) : type conservé, action Vente, EUR
  for (const [path, o, expEst] of [['/lp/vente-prix/', { demande: 'vente', surface: 20, age: 'recent' }, '159'], ['/devis/', { demande: 'location', surface: 50, age: 'avant1949' }, null], ['/devis/', { demande: 'audit', surface: 80 }, '450']]) {
    const { ctx, page, log } = await open(path);
    const root = await fill(page, 0, o); const e = await est(root); await submit(page, root);
    const d = await dl(page), c = conversions(d), ls = events(d, 'lead_submitted');
    const ok = complets(log).length === 1 && complets(log)[0].type_demande === o.demande && ls[0]?.projet === o.demande && c.length === 1 && c[0].send_to === FORM_LABEL && c[0].currency === 'EUR' && (!expEst || e === expEst) && c[0].value === Number(e);
    rec('F02', `Devis ${o.demande} (${path}) : type conservé, conversion Vente, valeur = estimation`, ok, { estimation: e, conversions: c, projet: ls[0]?.projet });
    if (o.demande === 'vente') {
      const shown = await root.locator('[data-el="qthanks-estim"]').innerText().catch(() => '');
      rec('F08a', 'LP vente A : montant révélé au succès (moment historique)', /159/.test(shown) && complets(log)[0].price_model === 'A', { affiché: shown, price_model: complets(log)[0].price_model });
    }
    await ctx.close(); }

  // F08 B — LP sans prix : aucun montant visible, montant interne calculé, price_model B
  { const { ctx, page, log } = await open('/lp/vente-sans-prix/');
    const root = await fill(page, 0, { demande: 'vente', surface: 20, age: 'recent' }); await submit(page, root);
    const visibleText = await root.evaluate((el) => el.innerText);
    rec('F08b', 'LP vente B : aucun montant visible, estimation interne 159 transmise, price_model=B', !/\d\s?€/.test(visibleText) && complets(log)[0]?.estimation === '159' && complets(log)[0]?.price_model === 'B', { estimation: complets(log)[0]?.estimation, price_model: complets(log)[0]?.price_model, montantVisible: (visibleText.match(/\d+\s?€/g) || []) });
    await ctx.close(); }

  // F03 + T05 — deux formulaires d'une LP : le second seul est soumis ; impressions dédupliquées
  { const { ctx, page, log } = await open('/lp/vente-prix/');
    const roots = page.locator('.qform'); const n = await roots.count();
    const inits = await page.evaluate(() => [...document.querySelectorAll('.qform')].map((r) => r.getAttribute('data-qf-init')));
    const root2 = await fill(page, 1, { demande: 'vente', surface: 45, age: 'intermediaire' }); await submit(page, root2);
    const d = await dl(page); const t1 = await isVisible(roots.nth(0).locator('[data-el="qthanks"]')); const t2 = await isVisible(root2.locator('[data-el="qthanks"]'));
    rec('F03', 'LP à deux formulaires : racines initialisées une fois, seule la 2e soumise', n === 2 && inits.every((v) => v === '1') && complets(log).length === 1 && t2 && !t1 && conversions(d).length === 1, { formulaires: n, inits, complets: complets(log).length, merci2: t2, merci1: t1 });
    const pm = d.filter((e) => e && e.event === 'experiment_impression');
    rec('T05', 'Impressions d’expérience dédupliquées par page (price_model une fois, cta/steps verrouillés absents)', pm.filter((e) => e.experiment === 'price_model').length === 1 && !pm.some((e) => e.experiment === 'cta_devis' || e.experiment === 'steps_order'), { impressions: pm });
    await ctx.close(); }

  // F04 — double clic sur l'envoi
  { const { ctx, page, log } = await open('/lp/dpe/');
    const root = await fill(page, 0, { demande: 'dpe', surface: 60 }); await submit(page, root, { double: true });
    const c = conversions(await dl(page));
    rec('F04', 'Double clic : une seule écriture complète et une seule conversion', complets(log).length === 1 && c.length === 1, { complets: complets(log).length, conversions: c.length });
    await ctx.close(); }

  // F05 — HTTP 500, réponse sans id, réseau coupé
  for (const api of ['error500', 'noid', 'abort']) {
    const { ctx, page, log } = await open('/lp/dpe/', { api });
    const root = await fill(page, 0, { demande: 'dpe', surface: 60 }); await submit(page, root);
    const d = await dl(page); const thanks = await isVisible(root.locator('[data-el="qthanks"]'));
    const err = await root.locator('.qerror').count(); const enabled = await root.locator('[data-el="qsubmit"]').isEnabled();
    rec('F05', `Échec API (${api}) : pas de succès, pas de conversion, message d'erreur, reprise possible`, !thanks && conversions(d).length === 0 && events(d, 'lead_submitted').length === 0 && err === 1 && enabled, { thanks, erreur: err, boutonActif: enabled });
    await ctx.close(); }

  // F06 + F10 — retour arrière, recalcul, seuils de grille (valeurs du champ caché « estimation »)
  { const { ctx, page } = await open('/devis/');
    const root = page.locator('.qform').first();
    async function grid(demande, bien, age, surfaces, copro = false) {
      await page.evaluate(() => { const r = document.querySelector('.qform'); r.querySelectorAll('input[type=radio],input[type=checkbox]').forEach((i) => (i.checked = false)); });
      await root.locator(`input[name="type_demande"][value="${demande}"]`).evaluate((i) => { i.checked = true; i.dispatchEvent(new Event('change', { bubbles: true })); });
      await root.locator(`input[name="type_bien"][value="${bien}"]`).evaluate((i) => { i.checked = true; i.dispatchEvent(new Event('change', { bubbles: true })); });
      if (age) await root.locator(`input[name="age_bien"][value="${age}"]`).evaluate((i) => { i.checked = true; i.dispatchEvent(new Event('change', { bubbles: true })); });
      if (copro) await root.locator('[name="copropriete"]').evaluate((i) => { i.checked = true; i.dispatchEvent(new Event('change', { bubbles: true })); });
      const out = {};
      for (const s of surfaces) { await root.locator('[name="surface_m2"]').evaluate((i, v) => { i.value = String(v); i.dispatchEvent(new Event('input', { bubbles: true })); }, s); out[s] = await est(root); }
      return out;
    }
    const g = {
      packAppRecent: await grid('vente', 'appartement', 'recent', [20, 21, 39, 40, 239, 240]),
      packMaisonRecent: await grid('vente', 'maison', 'recent', [20, 21]),
      packMaisonCopro: await grid('vente', 'maison', 'recent', [20], true),
      dpeApp: await grid('dpe', 'appartement', null, [39, 40, 79, 80, 119, 120]),
      dpeMaison: await grid('dpe', 'maison', null, [39, 40]),
      lotCave: await grid('vente', 'cave', null, [10]),
    };
    const exp = { packAppRecent: { 20: '159', 21: '189', 239: '389', 240: '' }, packMaisonRecent: { 20: '189', 21: '219' }, packMaisonCopro: { 20: '209' }, dpeApp: { 39: '150', 40: '160', 79: '160', 80: '170', 119: '170', 120: '190' }, dpeMaison: { 39: '165', 40: '175' }, lotCave: { 10: '179' } };
    const mism = []; for (const [k, v] of Object.entries(exp)) for (const [s, e] of Object.entries(v)) if (g[k][s] !== e) mism.push(`${k}@${s}: ${g[k][s]}≠${e}`);
    rec('F10', 'Seuils de grille identiques (pack 20/21, 239/240 ; DPE 39/40, 79/80, 119/120 ; maison +30 / +15 ; copro +20 ; lot seul 179)', mism.length === 0, { valeurs: g, écarts: mism });
    await ctx.close(); }
  { const { ctx, page } = await open('/devis/');
    const root = page.locator('.qform').first();
    await pick(page, root, 'type_demande', 'vente'); await pick(page, root, 'type_bien', 'appartement');
    await root.locator('[name="surface_m2"]').fill('30'); await pick(page, root, 'age_bien', 'recent'); const e1 = await est(root);
    await visibleStep(root).locator('[data-prev]').click(); await pause(page); await pick(page, root, 'type_bien', 'appartement');
    const kept = await root.locator('[name="surface_m2"]').inputValue(); await root.locator('[name="surface_m2"]').fill('70'); const e2 = await est(root);
    rec('F06', 'Retour arrière : saisie conservée, estimation recalculée selon la même grille', kept === '30' && e1 === '189' && e2 === '229', { avant: e1, surfaceConservée: kept, après: e2 });
    await ctx.close(); }

  // F09 — annexe rattachée sans supplément ; lot seul 179 (parcours complet)
  { const { ctx, page, log } = await open('/devis/');
    const root = await fill(page, 0, { demande: 'vente', bien: 'appartement', surface: 20, age: 'recent', annexe: true }); await submit(page, root);
    const p = complets(log)[0] || {};
    rec('F09', 'Annexe rattachée incluse (pas de supplément) ; lot seul selon règle 179 (voir F10)', p.estimation === '159' && p.annexe === '1' && p.annexe_type === 'cave_parking', { estimation: p.estimation, annexe: p.annexe, annexe_type: p.annexe_type });
    await ctx.close(); }

  // F12 — code postal invalide / hors périmètre / valide
  { const { ctx, page } = await open('/devis/');
    const root = page.locator('.qform').first();
    await pick(page, root, 'type_demande', 'dpe'); await pick(page, root, 'type_bien', 'appartement'); await root.locator('[name="surface_m2"]').fill('30'); await next(page, root);
    const tryCp = async (cp) => { await root.locator('[data-el="cp-input"]').fill(cp); await next(page, root); return visibleStep(root).getAttribute('data-step'); };
    const r1 = await tryCp('1234'), r2 = await tryCp('69001');
    const r3 = await tryCp('93200');
    rec('F12', 'Code postal : invalide et hors IDF bloqués, 93200 accepté', r1 === '4' && r2 === '4' && r3 === '5', { '1234': r1, '69001': r2, '93200': r3 });
    await ctx.close(); }

  // F13 — échec de l'API commune : la soumission reste possible
  { const { ctx, page, log } = await open('/lp/dpe/', { geo: 'fail' });
    const root = await fill(page, 0, { demande: 'dpe', surface: 30 }); await submit(page, root);
    rec('F13', 'API commune indisponible : soumission non bloquée (ville vide)', complets(log).length === 1 && complets(log)[0].ville === '', { complets: complets(log).length, ville: complets(log)[0]?.ville });
    await ctx.close(); }

  // F14 — rappel (CallbackForm) puis devis dans le même parcours : même lead_uid
  { const { ctx, page, log } = await open('/');
    const cb = page.locator('form.cbform').first();
    if (await cb.count()) {
      await cb.scrollIntoViewIfNeeded();
      const tel = cb.locator('input[type="tel"]').first(); await tel.fill('0612345678');
      const cp = cb.locator('input[inputmode="numeric"]').first(); if (await cp.count()) await cp.fill('75011');
      await cb.locator('button[type="submit"]').click(); await page.waitForTimeout(800);
      const cbLead = log.leads.find((l) => l.source && l.source !== 'devis') || log.leads[0];
      const root = await fill(page, 0, { demande: 'vente', surface: 40, age: 'recent' }); await submit(page, root);
      const full = complets(log).find((l) => l.source === 'devis');
      rec('F14', 'Rappel puis devis : même identifiant de parcours (partiel → complet), pas de doublon artificiel', !!cbLead && !!full && cbLead.lead_uid === full.lead_uid && complets(log).length === 1, { rappel: cbLead && { source: cbLead.source, status: cbLead.lead_status, uid: cbLead.lead_uid?.slice(0, 8) }, devis: full && { uid: full.lead_uid?.slice(0, 8) } });
    } else rec('F14', 'Rappel puis devis', null, 'CallbackForm absent de /');
    await ctx.close(); }

  // F15 — abandon après saisie du contact : partiel, aucune conversion
  { const { ctx, page, log } = await open('/lp/dpe/');
    const root = await fill(page, 0, { demande: 'dpe', surface: 30 });
    await root.locator('[name="telephone"]').blur(); await page.waitForTimeout(400);
    await page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true }); document.dispatchEvent(new Event('visibilitychange')); });
    await page.waitForTimeout(500);
    const d = await dl(page); const partials = log.leads.filter((l) => l.lead_status === 'partiel' && l.telephone);
    rec('F15', 'Abandon après contact : capture partielle, aucune conversion complète', partials.length >= 1 && complets(log).length === 0 && conversions(d).length === 0, { partielsAvecTel: partials.length, complets: complets(log).length });
    await ctx.close(); }

  // T01 — attribution gclid/UTM jusqu'au payload
  { const { ctx, page, log } = await open('/lp/dpe/?gclid=TESTGCLID&utm_source=google&utm_medium=cpc&utm_campaign=recette');
    const root = await fill(page, 0, { demande: 'dpe', surface: 30 }); await submit(page, root); const p = complets(log)[0] || {};
    rec('T01', 'Attribution gclid/UTM conservée jusqu’au payload', p.gclid === 'TESTGCLID' && p.utm_source === 'google' && p.medium === 'cpc' && p.campaign === 'recette', { gclid: p.gclid, utm_source: p.utm_source, medium: p.medium, campaign: p.campaign, landing_path: p.landing_path });
    await ctx.close(); }

  // T06 — clic Google Ads iOS sans gclid ni UTM (gbraid) : identifiant transmis et rattachement google/cpc
  { const { ctx, page, log } = await open('/lp/dpe/?gbraid=TESTGBRAID');
    const root = await fill(page, 0, { demande: 'dpe', surface: 30 }); await submit(page, root); const p = complets(log)[0] || {};
    rec('T06', 'Clic iOS (gbraid seul) : gbraid transmis, source google/cpc, gclid vide', p.gbraid === 'TESTGBRAID' && !p.gclid && p.utm_source === 'google' && p.medium === 'cpc', { gbraid: p.gbraid, wbraid: p.wbraid, gclid: p.gclid, utm_source: p.utm_source, medium: p.medium });
    await ctx.close(); }

  // T02 — consentement : défaut « denied » (EEE), refus → formulaire toujours utilisable
  { const { ctx, page, log } = await open('/lp/dpe/', {});
    const d0 = await dl(page); const def = d0.find((e) => Array.isArray(e) && e[0] === 'consent' && e[1] === 'default' && e[2]?.region);
    const refuse = page.getByRole('button', { name: /refuser/i }).first(); const hasBanner = await refuse.count();
    if (hasBanner) { await refuse.click(); await page.waitForTimeout(200); }
    const root = await fill(page, 0, { demande: 'dpe', surface: 30 }); await submit(page, root);
    rec('T02', 'Consentement : défaut denied (EEE) ; après refus, devis toujours possible', !!def && def[2].ad_storage === 'denied' && complets(log).length === 1, { défaut: def?.[2], bandeau: !!hasBanner, complets: complets(log).length });
    await ctx.close(); }

  // T03 — clic tel : 1 conversion appel + soloris_phone_call, pas de doublon
  { const { ctx, page } = await open('/lp/dpe/');
    await page.evaluate(() => document.addEventListener('click', (e) => { if (e.target.closest && e.target.closest('a[href^="tel:"]')) e.preventDefault(); }, true));
    const tel = page.locator('a[href^="tel:"]').first(); await tel.click(); await page.waitForTimeout(200);
    const d = await dl(page); const c = conversions(d).filter((x) => x.send_to === PHONE_LABEL);
    rec('T03', 'Clic tel : une conversion appel et un soloris_phone_call', c.length === 1 && events(d, 'soloris_phone_call').length === 1, { conversionsAppel: c.length, phoneEvents: events(d, 'soloris_phone_call').length });
    await ctx.close(); }

  // T04 — expériences hors LP : cookies et impressions inchangés
  { const { ctx, page } = await open('/devis/', { cookies: null });
    const cookies = (await ctx.cookies()).map((c) => c.name); const d = await dl(page); const imp = d.filter((e) => e && e.event === 'experiment_impression').map((e) => e.experiment);
    rec('T04', 'Hors LP : cookies cta/steps/early posés et impressions cta_devis, steps_order, early_contact émises une fois', ['soloris_ab_cta', 'soloris_ab_steps', 'soloris_ab_early'].every((n) => cookies.includes(n)) && ['cta_devis', 'steps_order', 'early_contact'].every((x) => imp.filter((y) => y === x).length === 1) && !imp.includes('price_model'), { cookies, impressions: imp });
    await ctx.close(); }

  // U01 — mobile 390 px : champs et bouton d'envoi atteignables malgré bandeau / barre fixe
  { const { ctx, page } = await open('/lp/dpe/', { viewport: { width: 390, height: 844 } });
    const refuse = page.getByRole('button', { name: /refuser/i }).first(); if (await refuse.count()) await refuse.click();
    const root = await fill(page, 0, { demande: 'dpe', surface: 30 });
    const btn = root.locator('[data-el="qsubmit"]'); await btn.scrollIntoViewIfNeeded();
    const hit = await btn.evaluate((b) => { const r = b.getBoundingClientRect(); const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return el === b || b.contains(el); });
    rec('U01', 'Mobile 390 px (après refus du bandeau) : bouton d’envoi visible et cliquable', hit, { cliquable: hit });
    await ctx.close(); }
  // C01 / C02 — formulaire de contact : succès → soloris_contact, aucune conversion Ads ;
  // échec API → message d'erreur, aucun événement, bouton réactivé.
  for (const api of ['ok', 'error500']) {
    const { ctx, page, log } = await open('/contact/', { api });
    await page.fill('#contact-form [name="nom"]', 'Test Recette');
    await page.fill('#contact-form [name="telephone"]', '0612345678');
    await page.fill('#contact-form [name="email"]', 'recette@example.test');
    await page.fill('#contact-form [name="message"]', 'Message de recette isolée');
    await page.click('#csubmit'); await pause(page, 600);
    const d = await dl(page); const thanks = await page.locator('#cthanks').isVisible(); const err = await page.locator('#cerror').isVisible();
    const evts = events(d, 'soloris_contact').length, conv = conversions(d).length, enabled = await page.locator('#csubmit').isEnabled();
    if (api === 'ok') rec('C01', 'Contact : un envoi complet, un soloris_contact, aucune conversion Ads, confirmation affichée', complets(log).length === 1 && complets(log)[0].source === 'contact' && evts === 1 && conv === 0 && thanks && !err, { complets: complets(log).length, source: complets(log)[0]?.source, soloris_contact: evts, conversions: conv, merci: thanks });
    else rec('C02', 'Contact (échec API) : pas de confirmation, aucun événement, message d’erreur, reprise possible', !thanks && err && evts === 0 && conv === 0 && enabled, { merci: thanks, erreur: err, soloris_contact: evts, boutonActif: enabled });
    await ctx.close(); }

  rec('U02', 'Lecteur d’écran, focus clavier complet', null, 'Non couvert par cette recette automatique : à faire manuellement.');
} catch (e) {
  rec('ERR', 'Erreur d’exécution de la recette', false, String(e && e.stack || e));
}
await browser.close(); server.close();
console.log('\n' + results.map((r) => `${r.status.padEnd(11)} ${r.id.padEnd(5)} ${r.label}`).join('\n'));
if (OUT) writeFileSync(OUT, JSON.stringify(results, null, 1));
process.exit(results.some((r) => r.status === 'ÉCHEC') ? 1 : 0);
