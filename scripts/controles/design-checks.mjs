#!/usr/bin/env node
/**
 * Contrôles design dans le DOM RENDU (niveau N2 du cahier Design UX V3, §5.1).
 *
 * Sert un build statique en local, JavaScript actif, TOUTE requête non locale bloquée et
 * /api/* simulé (204) : aucune écriture, aucun tag, aucune conversion. Aucune saisie n'est
 * faite ici (les envois sont couverts par forms.e2e.mjs). Le bandeau de consentement est refusé.
 *
 * Par route et par écran, enregistre :
 *  - formulaires : pour chaque racine .qform / form, la VISIBILITÉ calculée de chaque élément
 *    interactif ou data-el (une feuille de style ne doit ni masquer ni révéler un champ) ;
 *  - contraste : textes visibles dont le contraste avec le fond effectif est < 4,5:1
 *    (< 3:1 pour le grand texte) — fonds image/dégradé signalés « non mesurables » ;
 *  - focus clavier : parcours Tab des 60 premiers éléments ; indicateur visible ou non ;
 *  - cibles : hauteur des boutons d'action (.btn-gold/.btn-blue) et taille de police des champs ;
 *  - débordement horizontal.
 *
 * Usage : node scripts/controles/design-checks.mjs <statique> <sortie.json> [largeurs WxH,…] [routes…]
 * Comparaison : node scripts/controles/design-checks.mjs --compare avant.json apres.json [rapport.md]
 */
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync, writeFileSync } from 'node:fs';
import { join, extname, resolve } from 'node:path';
import { createRequire } from 'node:module';

if (process.argv[2] === '--compare') {
  const [A, B, OUT] = process.argv.slice(3);
  const a = JSON.parse(readFileSync(A, 'utf8')), b = JSON.parse(readFileSync(B, 'utf8'));
  const rows = []; const add = (s, c, d = '') => rows.push(`| ${s} | ${c} | ${String(d).replace(/\|/g, '/')} |`);
  const keys = Object.keys(b.pages);
  const visDiff = [], formsLost = [];
  let ca = 0, cb = 0, fa = 0, fb = 0, sa = 0, sb = 0;
  for (const k of keys) {
    const pa = a.pages[k], pb = b.pages[k]; if (!pa) continue;
    if (pa.forms.length !== pb.forms.length) formsLost.push(`${k} (${pa.forms.length}→${pb.forms.length})`);
    pa.forms.forEach((f, i) => { const g = pb.forms[i]; if (!g) return; const va = f.items.map((x) => x.key + ':' + x.visible).join('|'), vb = g.items.map((x) => x.key + ':' + x.visible).join('|'); if (va !== vb) { const d = f.items.filter((x, j) => !g.items[j] || g.items[j].visible !== x.visible || g.items[j].key !== x.key).slice(0, 4).map((x) => x.key + (x.visible ? ' visible→masqué' : ' masqué→visible')); visDiff.push(`${k} #${i}: ${d.join(', ')}`); } });
    ca += pa.contrast.fails; cb += pb.contrast.fails; fa += pa.focus.missing; fb += pb.focus.missing; sa += pa.targets.small; sb += pb.targets.small;
  }
  add(formsLost.length ? 'ÉCHEC' : 'PASS', 'Même nombre de formulaires rendus par page et par écran', formsLost.join(', '));
  add(visDiff.length ? 'ÉCHEC' : 'PASS', 'Visibilité calculée de chaque élément de formulaire identique (état initial)', visDiff.slice(0, 20).join(' ; '));
  add(cb <= ca ? 'PASS' : 'ÉCHEC', 'Textes sous le seuil de contraste (somme pages × écrans)', `${ca} → ${cb}`);
  add(fb <= fa ? 'PASS' : 'ÉCHEC', 'Éléments focalisés au clavier sans indicateur visible', `${fa} → ${fb}`);
  add(sb <= sa ? 'PASS' : 'ÉCHEC', 'Boutons d’action < 44 px de haut', `${sa} → ${sb}`);
  const ov = keys.filter((k) => b.pages[k].overflow > 0).map((k) => `${k} (+${b.pages[k].overflow}px)`);
  add(ov.length ? 'ÉCHEC' : 'PASS', 'Aucun débordement horizontal', ov.join(', '));
  const md = `# Contrôles design (DOM rendu)\n\nAvant : ${A}\nAprès : ${B}\n\n| Statut | Contrôle | Détail |\n|---|---|---|\n${rows.join('\n')}\n`;
  if (OUT) writeFileSync(OUT, md); console.log(md);
  process.exit(rows.some((r) => r.startsWith('| ÉCHEC')) ? 1 : 0);
}

const [STATIC, OUT, SIZES = '390x844,1440x1000', ...ROUTES_ARG] = process.argv.slice(2);
if (!STATIC || !OUT) { console.error('Usage : design-checks.mjs <statique> <sortie.json> [WxH,…] [routes…]'); process.exit(2); }
const ROOT = resolve(STATIC);
const ROUTES = ROUTES_ARG.length ? ROUTES_ARG : ['/', '/lp/dpe/', '/lp/vente-prix/', '/lp/vente-sans-prix/', '/dpe/', '/diagnostics-vente/', '/diagnostics-location/', '/audit-energetique/', '/tarifs/', '/devis/', '/contact/', '/methode/', '/diagnostics/', '/diagnostics/gaz/', '/guides/', '/guides/prix-diagnostic-immobilier-paris/', '/diagnostic-immobilier-paris-11e/', '/diagnostic-immobilier-saint-ouen/', '/zones-desservies/', '/mentions-legales/', '/confidentialite/'];

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || (existsSync('/opt/node22/lib/node_modules/playwright') ? '/opt/node22/lib/node_modules/playwright' : 'playwright'));
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.txt': 'text/plain', '.xml': 'application/xml' };
const server = createServer((req, res) => {
  const p = decodeURIComponent(req.url.split('?')[0]);
  if (p.startsWith('/api/')) { res.writeHead(204); return res.end(); }
  let f = join(ROOT, p); if (existsSync(f) && statSync(f).isDirectory()) f = join(f, 'index.html');
  if (!existsSync(f)) { res.writeHead(404); return res.end('404'); }
  res.writeHead(200, { 'content-type': MIME[extname(f)] || 'application/octet-stream' }); res.end(readFileSync(f));
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch();
const out = { generatedAt: new Date().toISOString(), static: ROOT, pages: {} };

for (const spec of SIZES.split(',')) {
  const [w, h] = spec.split('x').map(Number);
  const ctx = await browser.newContext({ viewport: { width: w, height: h || 900 }, serviceWorkers: 'block' });
  await ctx.route('**/*', (route) => (route.request().url().startsWith(BASE) ? route.continue() : route.abort()));
  const page = await ctx.newPage();
  for (const r of ROUTES) {
    await page.goto(BASE + r, { waitUntil: 'load' });
    const refuse = page.locator('#consent-refuse'); if (await refuse.isVisible().catch(() => false)) await refuse.click();
    await page.waitForTimeout(250);
    const data = await page.evaluate(() => {
      const vis = (el) => { const cs = getComputedStyle(el); if (cs.display === 'none' || cs.visibility === 'hidden') return false; let e = el; while (e) { const c = getComputedStyle(e); if (c.display === 'none') return false; e = e.parentElement; } const rc = el.getBoundingClientRect(); return rc.width > 0 && rc.height > 0; };
      // Formulaires
      const roots = [...document.querySelectorAll('.qform, form')].filter((el, i, all) => !all.some((o) => o !== el && o.contains(el)));
      const forms = roots.map((root) => ({ root: root.className, items: [...root.querySelectorAll('input,select,textarea,button,legend,label,summary,[data-el],[data-step],.qstep,.qnav,.qopt')].map((el, i) => ({ key: `${el.tagName.toLowerCase()}${el.name ? '[' + el.name + (el.value && (el.type === 'radio' || el.type === 'checkbox') ? '=' + el.value : '') + ']' : ''}${el.dataset.el ? '{' + el.dataset.el + '}' : ''}#${i}`, visible: el.type === 'radio' || el.type === 'checkbox' ? vis(el.closest('label') || el) : vis(el) })) }));
      // Contraste
      const parse = (c) => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
      const lum = ({ r, g, b }) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
      const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
      const bgOf = (el) => { let e = el; let acc = null; while (e && e.nodeType === 1) { const cs = getComputedStyle(e); if (cs.backgroundImage && cs.backgroundImage !== 'none') return { complex: true }; const c = parse(cs.backgroundColor); if (c && c.a > 0) { if (!acc) acc = c; if (c.a >= 1) return { color: acc.a >= 1 ? acc : { r: acc.r * acc.a + c.r * (1 - acc.a), g: acc.g * acc.a + c.g * (1 - acc.a), b: acc.b * acc.a + c.b * (1 - acc.a), a: 1 } }; } e = e.parentElement; } return { color: acc && acc.a >= 1 ? acc : { r: 255, g: 255, b: 255, a: 1 } }; };
      const fails = []; let measured = 0, complex = 0;
      const walker = document.createTreeWalker(document.querySelector('#main') || document.body, NodeFilter.SHOW_TEXT);
      const seen = new Set();
      while (walker.nextNode()) {
        const t = walker.currentNode; if (!t.textContent.trim()) continue; const el = t.parentElement; if (!el || seen.has(el)) continue; seen.add(el);
        if (!vis(el) || el.closest('svg,[aria-hidden="true"],.qhp,.visually-hidden,.skip-link')) continue;
        const cs = getComputedStyle(el); const fg = parse(cs.color); if (!fg) continue;
        const bg = bgOf(el); if (bg.complex) { complex++; continue; }
        const op = Number(cs.opacity) * (fg.a ?? 1);
        const fgc = op < 1 ? { r: fg.r * op + bg.color.r * (1 - op), g: fg.g * op + bg.color.g * (1 - op), b: fg.b * op + bg.color.b * (1 - op) } : fg;
        const size = parseFloat(cs.fontSize), bold = Number(cs.fontWeight) >= 700;
        const large = size >= 24 || (bold && size >= 18.66);
        const cr = ratio(fgc, bg.color); measured++;
        if (cr < (large ? 3 : 4.5)) fails.push({ text: t.textContent.trim().slice(0, 50), ratio: Math.round(cr * 100) / 100, size, cls: el.className && typeof el.className === 'string' ? el.className.slice(0, 40) : el.tagName });
      }
      // Cibles et champs
      const btns = [...document.querySelectorAll('#main .btn-gold, #main .btn-blue, .lp-mcta-btn, .mcta-btn, .site-header .btn-gold')].filter(vis);
      const small = btns.filter((b) => b.getBoundingClientRect().height < 44).map((b) => `${b.textContent.trim().slice(0, 30)} (${Math.round(b.getBoundingClientRect().height)}px)`);
      const inputs = [...document.querySelectorAll('#main input:not([type=radio]):not([type=checkbox]):not([type=hidden]), #main select, #main textarea')].filter(vis).map((i) => parseFloat(getComputedStyle(i).fontSize));
      return { forms, contrast: { fails: fails.length, measured, complex, examples: fails.slice(0, 12) }, targets: { buttons: btns.length, small: small.length, examples: small.slice(0, 8) }, inputFont: { min: inputs.length ? Math.min(...inputs) : null, n: inputs.length }, overflow: Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth) };
    });
    // Focus clavier : 60 tabulations depuis le haut de page
    await page.evaluate(() => { document.activeElement && document.activeElement.blur && document.activeElement.blur(); window.scrollTo(0, 0); });
    let missing = 0, tabbed = 0; const missEx = [];
    for (let i = 0; i < 60; i++) {
      await page.keyboard.press('Tab');
      const f = await page.evaluate(() => {
        const el = document.activeElement; if (!el || el === document.body) return null;
        const show = (e) => { const cs = getComputedStyle(e); return (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0) || (cs.boxShadow && cs.boxShadow !== 'none'); };
        let ok = show(el);
        if (!ok && el.matches('.qopt input')) ok = show(el.nextElementSibling);
        return { ok, label: (el.getAttribute('aria-label') || el.textContent || el.name || el.tagName).trim().slice(0, 40) };
      });
      if (!f) continue; tabbed++; if (!f.ok) { missing++; if (missEx.length < 6) missEx.push(f.label); }
    }
    data.focus = { tabbed, missing, examples: missEx };
    out.pages[`${r}@${w}`] = data;
    process.stdout.write('.');
  }
  await ctx.close();
}
await browser.close(); server.close();
writeFileSync(OUT, JSON.stringify(out, null, 1));
const sum = (k) => Object.values(out.pages).reduce((n, p) => n + k(p), 0);
console.log(`\n${Object.keys(out.pages).length} pages×écrans → ${OUT}`);
console.log(`Contraste < seuil : ${sum((p) => p.contrast.fails)} · focus sans indicateur : ${sum((p) => p.focus.missing)} · boutons < 44 px : ${sum((p) => p.targets.small)} · débordements : ${Object.entries(out.pages).filter(([, p]) => p.overflow).map(([k]) => k).join(', ') || 'aucun'}`);
