#!/usr/bin/env node
/**
 * Parcours devis au CLAVIER SEUL (Tab / Espace / flèches / saisie / Entrée) sur la 1re instance du QuoteForm.
 * Isolation : /api/lead simulé, /api/* → 204, toute requête externe bloquée ; variantes A fixées.
 * Usage : node scripts/controles/clavier-devis.mjs <statique_de_test> [chemin=/lp/vente-prix/]
 * Sortie : nombre de tabulations par étape, puis PASS / ÉCHEC (succès affiché + 1 écriture complète).
 */
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, extname, resolve } from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || (existsSync('/opt/node22/lib/node_modules/playwright') ? '/opt/node22/lib/node_modules/playwright' : 'playwright'));
const ROOT = resolve(process.argv[2]);
const server = createServer((req, res) => { let f = join(ROOT, decodeURIComponent(req.url.split('?')[0])); if (existsSync(f) && statSync(f).isDirectory()) f = join(f, 'index.html'); if (!existsSync(f)) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'content-type': { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.woff2': 'font/woff2' }[extname(f)] || 'application/octet-stream' }); res.end(readFileSync(f)); });
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const B = `http://127.0.0.1:${server.address().port}`;
const br = await chromium.launch();
const ctx = await br.newContext({ viewport: { width: 1280, height: 900 } });
await ctx.addCookies(['cta', 'steps', 'early'].map((k) => ({ name: 'soloris_ab_' + k, value: 'A', url: B })));
const leads = [];
await ctx.route('**/*', (r) => { const u = r.request().url(); if (u.startsWith(B + '/api/lead')) { try { leads.push(JSON.parse(r.request().postData())); } catch {} return r.fulfill({ status: 200, contentType: 'application/json', body: '{"id":"test-clavier"}' }); } if (u.startsWith(B + '/api/')) return r.fulfill({ status: 204, body: '' }); return u.startsWith(B) ? r.continue() : r.abort(); });
const p = await ctx.newPage();
const PATH = process.argv[3] || '/lp/vente-prix/'; await p.goto(B + PATH);
const steps = [];
async function tabTo(test, label, max = 120) {
  // Le moteur place souvent le focus sur le premier champ de l'étape affichée : on vérifie avant de tabuler.
  if (await p.evaluate(test)) { steps.push(`${label}: déjà focalisé`); return true; }
  for (let i = 0; i < max; i++) { await p.keyboard.press('Tab'); if (await p.evaluate(test)) { steps.push(`${label}: ${i + 1} Tab`); return true; } }
  steps.push(`${label}: INTROUVABLE`); return false;
}
const inForm = (sel) => `(() => { const a = document.activeElement; return !!a && !!a.closest('.qform') && a.closest('.qform') === document.querySelectorAll('.qform')[0] && a.matches(${JSON.stringify(sel)}); })()`;
// bandeau de consentement : refus au clavier
if (await tabTo(`document.activeElement && document.activeElement.id === 'consent-refuse'`, 'Refuser (bandeau)', 40)) await p.keyboard.press('Enter');
let ok = await tabTo(inForm('input[name="type_demande"]'), 'Projet');
if (ok) { await p.keyboard.press('Space'); await p.waitForTimeout(500); }
ok = ok && await tabTo(inForm('input[name="type_bien"]'), 'Type de bien'); if (ok) { await p.keyboard.press('Space'); await p.waitForTimeout(500); }
ok = ok && await tabTo(inForm('input[name="surface_m2"]'), 'Surface'); if (ok) await p.keyboard.type('20');
ok = ok && await tabTo(inForm('input[name="age_bien"]'), 'Âge'); if (ok) { await p.keyboard.press('ArrowDown'); await p.keyboard.press('ArrowDown'); await p.waitForTimeout(300); }
ok = ok && await tabTo(inForm('[data-next]'), 'Continuer (bien)'); if (ok) { await p.keyboard.press('Enter'); await p.waitForTimeout(400); }
ok = ok && await tabTo(inForm('[data-el="cp-input"]'), 'Code postal'); if (ok) { await p.keyboard.type('75011'); await p.waitForTimeout(400); }
ok = ok && await tabTo(inForm('[data-next]'), 'Continuer (adresse)'); if (ok) { await p.keyboard.press('Enter'); await p.waitForTimeout(400); }
ok = ok && await tabTo(inForm('input[name="nom"]'), 'Nom'); if (ok) await p.keyboard.type('Test Clavier');
ok = ok && await tabTo(inForm('input[name="telephone"]'), 'Téléphone'); if (ok) await p.keyboard.type('0612345678');
ok = ok && await tabTo(inForm('[data-el="qsubmit"]'), 'Envoyer'); if (ok) { await p.keyboard.press('Enter'); await p.waitForTimeout(900); }
const thanks = await p.evaluate(() => { const t = document.querySelectorAll('.qform')[0].querySelector('[data-el="qthanks"]'); return !!t && !t.hidden && !t.closest('[hidden]'); });
const complets = leads.filter((l) => l.lead_status === 'complet');
console.log(steps.join(' · '));
console.log(`RÉSULTAT ${ok && thanks && complets.length === 1 ? 'PASS' : 'ÉCHEC'} — succès affiché=${thanks}, complets=${complets.length}, type=${complets[0]?.type_demande}, surface=${complets[0]?.surface_m2 ?? complets[0]?.surface}, âge=${complets[0]?.age_bien}`);
await br.close(); server.close();
