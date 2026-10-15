#!/usr/bin/env node
/**
 * Espacement du texte (WCAG 1.4.12) : interligne 1,5, lettres 0,12 em, mots 0,16 em, paragraphes 2 em,
 * puis mesure du débordement horizontal et des boutons/titres coupés. Réseau externe bloqué, aucune saisie.
 * Usage : node scripts/controles/espacement-texte.mjs <statique>
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
const br = await chromium.launch(); const out = [];
for (const vp of [{ width: 390, height: 844 }, { width: 1440, height: 1000 }]) {
  const ctx = await br.newContext({ viewport: vp });
  await ctx.addCookies(['cta', 'steps', 'early'].map((k) => ({ name: 'soloris_ab_' + k, value: 'A', url: B })));
  await ctx.route('**/*', (r) => { const u = r.request().url(); if (u.startsWith(B + '/api/')) return r.fulfill({ status: 204, body: '' }); return u.startsWith(B) ? r.continue() : r.abort(); });
  const p = await ctx.newPage();
  for (const u of ['/', '/lp/dpe/', '/lp/vente-prix/', '/dpe/', '/tarifs/', '/devis/', '/contact/']) {
    await p.goto(B + u); await p.addStyleTag({ content: '* { line-height: 1.5 !important; letter-spacing: .12em !important; word-spacing: .16em !important; } p { margin-bottom: 2em !important; }' });
    await p.waitForTimeout(250);
    const r = await p.evaluate(() => {
      const ov = Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth);
      const clipped = [...document.querySelectorAll('#main a.btn-gold, #main a.btn-blue, #main button, .qopt-body, .sec-title, h1')].filter((e) => e.getClientRects().length && (e.scrollWidth > e.clientWidth + 1) && getComputedStyle(e).overflow !== 'visible').map((e) => (e.textContent || '').trim().slice(0, 40));
      return { ov, clipped: clipped.slice(0, 5) };
    });
    out.push(`${u}@${vp.width} débordement=${r.ov}px coupés=${r.clipped.length ? JSON.stringify(r.clipped) : 0}`);
  }
  await ctx.close();
}
console.log(out.join('\n')); await br.close(); server.close();
