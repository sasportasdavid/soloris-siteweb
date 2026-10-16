#!/usr/bin/env node
/**
 * Recette des tickets F1 à F4 (formulaires et barres d'action) — environnement ISOLÉ.
 * Même isolation que forms.e2e.mjs : /api/lead simulé (partiels et complets journalisés),
 * /api/* → 204, geo.api.gouv.fr simulé, toute autre requête bloquée. Variantes A fixées
 * (sauf cas B explicite). Aucun lead, email, notification ni conversion ne quitte la machine.
 *
 * Usage : node scripts/controles/tickets-f.mjs <statique_de_test> [rapport.json]
 */
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync, writeFileSync } from 'node:fs';
import { join, extname, resolve } from 'node:path';
import { createRequire } from 'node:module';

const ROOT = resolve(process.argv[2] || '.vercel/output/static');
const OUT = process.argv[3];
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
const results = [];
const rec = (id, label, ok, evidence) => { results.push({ id, label, status: ok === null ? 'NON EXÉCUTÉ' : ok ? 'PASS' : 'ÉCHEC', evidence }); process.stdout.write(ok ? '.' : ok === null ? '?' : 'x'); };

async function open(path, { viewport = { width: 1280, height: 900 }, steps = 'A' } = {}) {
  const ctx = await browser.newContext({ viewport });
  await ctx.addCookies([['cta', 'A'], ['steps', steps], ['early', 'A']].map(([k, v]) => ({ name: 'soloris_ab_' + k, value: v, url: BASE })));
  const page = await ctx.newPage();
  const log = { leads: [], external: 0 };
  await page.route('**/*', async (route) => {
    const req = route.request(), url = req.url();
    if (url.startsWith(BASE + '/api/lead')) {
      let body = {}; try { body = JSON.parse(req.postData() || '{}'); } catch {}
      log.leads.push(body);
      if (body.lead_status === 'complet' && body.source !== 'contact' && body.source !== 'chat' && !(body.nom && body.telephone)) return route.fulfill({ status: 400, contentType: 'application/json', body: '{"error":"Le nom et le téléphone sont requis."}' });
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 'test-' + (body.lead_uid || 'x').slice(0, 8), lead_status: body.lead_status }) });
    }
    if (url.startsWith(BASE + '/api/')) return route.fulfill({ status: 204, body: '' });
    if (url.startsWith(BASE)) return route.continue();
    if (url.startsWith('https://geo.api.gouv.fr/')) return route.fulfill({ status: 200, contentType: 'application/json', body: '[{"nom":"Paris 11e"}]' });
    log.external++; return route.abort();
  });
  await page.goto(BASE + path, { waitUntil: 'load' });
  const refuse = page.locator('#consent-refuse');
  if (await refuse.isVisible().catch(() => false)) await refuse.click();
  return { ctx, page, log };
}
const complets = (log) => log.leads.filter((l) => l.lead_status === 'complet');
const visibleStep = (page) => page.evaluate(() => { const f = document.querySelector('.qform'); const s = [...f.querySelectorAll('fieldset.qstep')]; return s.findIndex((x) => !x.hidden) + 1; });

// Parcours au clavier seul : chaque étape tabule jusqu'au champ voulu (vérifie d'abord le focus courant).
async function keyboardFlow(path) {
  const { ctx, page, log } = await open(path);
  const trace = [];
  const inForm = (sel) => `(() => { const a = document.activeElement; const f = document.querySelectorAll('.qform')[0]; return !!a && f.contains(a) && a.matches(${JSON.stringify(sel)}); })()`;
  async function tabTo(test, label, max = 120) {
    if (await page.evaluate(test)) { trace.push(label + ': focus déjà placé'); return true; }
    for (let i = 0; i < max; i++) { await page.keyboard.press('Tab'); if (await page.evaluate(test)) { trace.push(`${label}: ${i + 1} Tab`); return true; } }
    trace.push(label + ': INTROUVABLE'); return false;
  }
  let ok = await tabTo(inForm('input[name="type_demande"]'), 'Projet');
  if (ok) { await page.keyboard.press('Space'); await page.waitForTimeout(500); }
  ok = ok && await tabTo(inForm('input[name="type_bien"]'), 'Type de bien'); if (ok) { await page.keyboard.press('Space'); await page.waitForTimeout(500); }
  ok = ok && await tabTo(inForm('input[name="surface_m2"]'), 'Surface'); if (ok) await page.keyboard.type('20');
  const needAge = await page.evaluate(() => { const b = document.querySelector('.qform [data-el="age-block"]'); return b && !b.hidden; });
  if (ok && needAge) { ok = await tabTo(inForm('input[name="age_bien"]'), 'Âge'); if (ok) { await page.keyboard.press('ArrowDown'); await page.keyboard.press('ArrowDown'); await page.waitForTimeout(300); } }
  if (ok) { await page.keyboard.press('Enter'); await page.waitForTimeout(400); } // Entrée = Continuer
  ok = ok && await tabTo(inForm('[data-el="cp-input"]'), 'Code postal'); if (ok) { await page.keyboard.type('75011'); await page.waitForTimeout(300); await page.keyboard.press('Enter'); await page.waitForTimeout(400); }
  ok = ok && await tabTo(inForm('input[name="nom"]'), 'Nom'); if (ok) await page.keyboard.type('Test Clavier');
  ok = ok && await tabTo(inForm('input[name="telephone"]'), 'Téléphone'); if (ok) { await page.keyboard.type('0612345678'); await page.keyboard.press('Enter'); await page.waitForTimeout(900); }
  const thanks = await page.evaluate(() => { const t = document.querySelectorAll('.qform')[0].querySelector('[data-el="qthanks"]'); return !!t && !t.hidden; });
  const c = complets(log);
  await ctx.close();
  return { ok: ok && thanks && c.length === 1 && !!c[0].nom, trace, complets: c.length, type: c[0]?.type_demande, surface: c[0]?.surface, age: c[0]?.age_bien };
}

try {
  // K — parcours complet au clavier (pages où l'option est présélectionnée comprises)
  for (const [id, path] of [['K1', '/devis/'], ['K2', '/dpe/'], ['K3', '/lp/vente-prix/'], ['K4', '/lp/dpe/']]) {
    const r = await keyboardFlow(path);
    rec(id, `Devis complet au clavier seul sur ${path} (Espace, flèches, Entrée)`, r.ok, r);
  }

  // E — Entrée dans un champ intermédiaire = Continuer ; plus d'envoi implicite ni d'erreur pré-insérée
  { const { ctx, page, log } = await open('/devis/');
    const root = page.locator('.qform').first();
    await root.locator('label:has(input[name="type_demande"][value="vente"])').click(); await page.waitForTimeout(400);
    await root.locator('label:has(input[name="type_bien"][value="appartement"])').click(); await page.waitForTimeout(400);
    await root.locator('label:has(input[name="age_bien"][value="recent"])').click();
    await root.locator('[name="surface_m2"]').fill('40'); await root.locator('[name="surface_m2"]').press('Enter'); await page.waitForTimeout(500);
    const s1 = await visibleStep(page);
    let s2 = s1;
    if (s1 === 4) { await root.locator('[data-el="cp-input"]').fill('75011'); await page.waitForTimeout(300); await root.locator('[data-el="cp-input"]').press('Enter'); await page.waitForTimeout(500); s2 = await visibleStep(page); }
    const pre = await root.locator('.qerror').count();
    rec('E1', 'Entrée dans « surface » puis « code postal » : passe à l’étape suivante, aucun envoi complet, aucune erreur pré-insérée', s1 === 4 && s2 === 5 && complets(log).length === 0 && pre === 0, { etapeApresSurface: s1, etapeApresCp: s2, complets: complets(log).length, erreurs: pre });
    await ctx.close(); }

  // V — message de validation relié aux champs, sans changer les règles
  { const { ctx, page } = await open('/devis/');
    const root = page.locator('.qform').first();
    await root.locator('label:has(input[name="type_demande"][value="vente"])').click(); await page.waitForTimeout(400);
    await root.locator('label:has(input[name="type_bien"][value="appartement"])').click(); await page.waitForTimeout(400);
    await root.locator('fieldset.qstep:not([hidden]) [data-next]').click(); await page.waitForTimeout(200);
    const m = await page.evaluate(() => { const f = document.querySelector('.qform'); const st = [...f.querySelectorAll('fieldset.qstep')].find((s) => !s.hidden); const msg = st.querySelector('.qinvalid'); const s = f.querySelector('[name="surface_m2"]'); return { step: st.getAttribute('data-step'), msg: msg && !msg.hidden ? msg.textContent : null, role: msg && msg.getAttribute('role'), inv: s.getAttribute('aria-invalid'), desc: s.getAttribute('aria-describedby') === (msg && msg.id) }; });
    await root.locator('[name="surface_m2"]').fill('40'); await root.locator('label:has(input[name="age_bien"][value="recent"])').click();
    await root.locator('fieldset.qstep:not([hidden]) [data-next]').click(); await page.waitForTimeout(300);
    const after = await page.evaluate(() => { const f = document.querySelector('.qform'); const s = f.querySelector('[name="surface_m2"]'); const msg = f.querySelector('.qstep[data-step="3"] .qinvalid'); return { inv: s.getAttribute('aria-invalid'), msgHidden: !msg || msg.hidden, step: [...f.querySelectorAll('fieldset.qstep')].findIndex((x) => !x.hidden) + 1 }; });
    rec('V1', 'Étape incomplète : message « Pour continuer… » (role=alert), surface aria-invalid reliée ; corrigé → message retiré, étape suivante', m.step === '3' && /surface/.test(m.msg || '') && /âge/.test(m.msg || '') && m.role === 'alert' && m.inv === 'true' && m.desc && after.inv === null && after.msgHidden && after.step === 4, { avant: m, apres: after });
    await ctx.close(); }

  // A — flèches : changent le choix sans changer d'étape ; Continuer visible ; Espace confirme
  { const { ctx, page, log } = await open('/dpe/');
    const first = page.locator('.qform').first().locator('input[name="type_demande"][value="dpe"]');
    await first.focus(); await page.keyboard.press('ArrowDown'); await page.waitForTimeout(500);
    const s = await visibleStep(page);
    const chosen = await page.evaluate(() => document.querySelector('.qform input[name="type_demande"]:checked').value);
    const contVisible = await page.evaluate(() => { const b = document.querySelector('.qform .qstep[data-step="1"] [data-next]'); return !!b && b.offsetParent !== null; });
    await page.keyboard.press('Space'); await page.waitForTimeout(500);
    const s2 = await visibleStep(page);
    rec('A1', 'Flèche : choix modifié sans changer d’étape, « Continuer » affiché ; Espace confirme et avance', s === 1 && chosen === 'audit' && contVisible && s2 === 2, { etape: s, choix: chosen, continuerVisible: contVisible, etapeApresEspace: s2 });
    await ctx.close(); }

  // P — progression verbale cohérente avec le nombre réel d'étapes (A = 5, B = 4)
  for (const v of ['A', 'B']) {
    const { ctx, page } = await open('/devis/', { steps: v });
    const root = page.locator('.qform').first();
    const t1 = await root.locator('[data-el="qprogress"]').innerText();
    await root.locator('label:has(input[name="type_demande"][value="dpe"])').click(); await page.waitForTimeout(500);
    const t2 = await root.locator('[data-el="qprogress"]').innerText();
    const n = v === 'A' ? 5 : 4;
    rec('P1' + v, `Progression variante ${v} : « Étape 1 sur ${n} » puis « Étape 2 sur ${n} »`, t1 === `Étape 1 sur ${n}` && t2 === `Étape 2 sur ${n}`, { initial: t1, apres: t2 });
    await ctx.close();
  }

  // M — barre mobile publique contextuelle
  { const { ctx, page } = await open('/dpe/', { viewport: { width: 390, height: 844 } });
    const root = page.locator('.qform').first();
    await root.locator('label:has(input[name="type_demande"][value="vente"])').click(); await page.waitForTimeout(500);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight)); await page.waitForTimeout(300);
    await page.locator('.mobile-cta a[href="/devis"]').click(); await page.waitForTimeout(900);
    const r = await page.evaluate(() => { const f = document.querySelector('.qform[data-qf-started]'); const b = f.getBoundingClientRect(); return { url: location.pathname, top: Math.round(b.top), visible: b.top < innerHeight && b.bottom > 0, step: [...f.querySelectorAll('fieldset.qstep')].findIndex((x) => !x.hidden) + 1 }; });
    rec('M1', 'Barre mobile (/dpe/) : formulaire commencé → ramène à CE formulaire, même page, étape conservée', r.url === '/dpe/' && r.visible && r.step === 2, r);
    await ctx.close(); }
  { const { ctx, page } = await open('/dpe/', { viewport: { width: 390, height: 844 } });
    await page.locator('.mobile-cta a[href="/devis"]').click(); await page.waitForTimeout(900);
    const r = await page.evaluate(() => { const s = document.getElementById('simulateur'); const b = s.getBoundingClientRect(); return { url: location.pathname, simVisible: b.top < innerHeight && b.bottom > 0 }; });
    rec('M2', 'Barre mobile (/dpe/) : rien de commencé → simulateur de la page, sans changer de page', r.url === '/dpe/' && r.simVisible, r);
    await ctx.close(); }
  { const { ctx, page } = await open('/contact/', { viewport: { width: 390, height: 844 } });
    await Promise.all([page.waitForURL('**/devis/**', { timeout: 5000 }).catch(() => {}), page.locator('.mobile-cta a[href="/devis"]').click()]);
    rec('M3', 'Barre mobile (/contact/, sans formulaire de devis) : lien /devis inchangé', /\/devis\/?$/.test(new URL(page.url()).pathname), { url: new URL(page.url()).pathname });
    await ctx.close(); }
  { const { ctx, page } = await open('/lp/vente-prix/', { viewport: { width: 390, height: 844 } });
    const root = page.locator('.qform').first();
    await root.locator('label:has(input[name="type_demande"][value="vente"])').click(); await page.waitForTimeout(500);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight)); await page.waitForTimeout(300);
    await page.locator('.lp-mcta a[href="#simulateur"]').click(); await page.waitForTimeout(900);
    const r = await page.evaluate(() => { const f = document.querySelector('.qform[data-qf-started]'); const b = f.getBoundingClientRect(); return { hash: location.hash, startedVisible: b.top < innerHeight && b.bottom > 0, isTop: f === document.querySelectorAll('.qform')[0] }; });
    rec('M4', 'Barre LP : instance du haut commencée → ramène à elle (pas à #simulateur)', r.startedVisible && r.isTop && r.hash === '', r);
    await ctx.close(); }
  { const { ctx, page } = await open('/lp/vente-prix/', { viewport: { width: 390, height: 844 } });
    await page.locator('.lp-mcta a[href="#simulateur"]').click(); await page.waitForTimeout(900);
    const r = await page.evaluate(() => ({ hash: location.hash }));
    rec('M5', 'Barre LP : rien de commencé → #simulateur (comportement historique)', r.hash === '#simulateur', r);
    await ctx.close(); }

  // C — chat : libellé « Poser une question », envoi inchangé (source chat, event soloris_chat)
  { const { ctx, page, log } = await open('/');
    const fab = page.locator('#chat-fab');
    const name = await fab.getAttribute('aria-label'); const label = await fab.innerText();
    await fab.click();
    await page.locator('#chat-form [name="nom"]').fill('Test'); await page.locator('#chat-form [name="telephone"]').fill('0612345678'); await page.locator('#chat-form [name="message"]').fill('Question de recette.');
    await page.locator('#chat-send').click(); await page.waitForTimeout(900);
    const ev = await page.evaluate(() => (window.dataLayer || []).filter((e) => e && e.event === 'soloris_chat').length);
    const thanks = await page.locator('#chat-thanks').isVisible();
    const sent = log.leads.filter((l) => l.source === 'chat');
    rec('C3', 'Chat : nom accessible et libellé « Poser une question » ; envoi source=chat, 1 soloris_chat, confirmation', name === 'Poser une question' && /Poser une question/.test(label) && sent.length === 1 && ev === 1 && thanks, { ariaLabel: name, libelle: label.trim(), envois: sent.length, soloris_chat: ev, merci: thanks });
    rec('EXT', 'Aucune requête externe transmise', log.external >= 0, { bloquées: log.external });
    await ctx.close(); }
} catch (e) {
  rec('ERR', 'Erreur d’exécution de la recette', false, String(e && e.stack || e).slice(0, 400));
}
console.log('\n');
for (const r of results) console.log(`${r.status.padEnd(11)} ${r.id.padEnd(5)} ${r.label}`);
if (OUT) writeFileSync(OUT, JSON.stringify({ static: ROOT, results }, null, 1));
await browser.close(); server.close();
process.exit(results.some((r) => r.status === 'ÉCHEC') ? 1 : 0);
