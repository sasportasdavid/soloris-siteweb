#!/usr/bin/env node
/**
 * Contrôles éditoriaux — comparaison avant/après de deux instantanés (snapshot.mjs) + fichiers protégés.
 *
 * Usage :  node scripts/controles/compare.mjs <avant.json> <apres.json> [--mode=E|M] [--base=<commit>] [--out=rapport.md]
 *   E (défaut) : lot éditorial. Toute modification d'attribut de formulaire, de script (hors JSON-LD)
 *                ou de fichier protégé est un ÉCHEC.
 *   M          : lot microcopie des formulaires. Attributs toujours figés ; les scripts modifiés sont
 *                listés « À REVOIR » (revue explicite + recette F/T obligatoires), pas acceptés d'office.
 *
 * Sortie : rapport Markdown (PASS / ÉCHEC / À REVOIR / INFO) et code de sortie 1 si un ÉCHEC existe.
 * Ce contrôle statique ne prouve pas l'absence de régression : il ne remplace ni la recette
 * navigateur (forms.e2e.mjs) ni la vérification humaine.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';

const args = process.argv.slice(2);
const [A, B] = args.filter((a) => !a.startsWith('--'));
const opt = Object.fromEntries(args.filter((a) => a.startsWith('--')).map((a) => a.slice(2).split('=')));
const MODE = opt.mode || 'E';
const BASE = opt.base || '538233ea7b3308ba20880e7173ce8f6d95ad5f98';
if (!A || !B) { console.error('Usage : compare.mjs <avant.json> <apres.json> [--mode=E|M] [--base=commit] [--out=f.md]'); process.exit(2); }

const before = JSON.parse(readFileSync(A, 'utf8'));
const after = JSON.parse(readFileSync(B, 'utf8'));
const rows = [];
const add = (status, check, detail = '') => rows.push({ status, check, detail });

// ── 1. Inventaire des routes ───────────────────────────────────────────────
const rb = Object.keys(before.routes), ra = Object.keys(after.routes);
const lost = rb.filter((r) => !ra.includes(r)), added = ra.filter((r) => !rb.includes(r));
add(lost.length ? 'ÉCHEC' : 'PASS', 'Aucune route supprimée', lost.join(', '));
add(added.length ? 'À REVOIR' : 'PASS', 'Aucune route ajoutée', added.join(', '));
const non200 = ra.filter((r) => after.routes[r].status !== 200);
add(non200.length ? 'ÉCHEC' : 'PASS', 'Toutes les routes répondent 200', non200.join(', '));

// ── 2. Indexation : canonique, robots, sitemap, robots.txt ────────────────
const common = rb.filter((r) => ra.includes(r));
const canonDiff = common.filter((r) => before.routes[r].canonical !== after.routes[r].canonical);
add(canonDiff.length ? 'ÉCHEC' : 'PASS', 'Canoniques identiques', canonDiff.join(', '));
const robotsDiff = common.filter((r) => before.routes[r].robots !== after.routes[r].robots);
add(robotsDiff.length ? 'ÉCHEC' : 'PASS', 'Balises robots identiques', robotsDiff.join(', '));
const lpIndexable = ra.filter((r) => r.startsWith('/lp/') && !/noindex/.test(after.routes[r].robots || ''));
add(lpIndexable.length ? 'ÉCHEC' : 'PASS', 'Pages /lp/ en noindex', lpIndexable.join(', '));
const smB = new Set(before.sitemap), smA = new Set(after.sitemap);
const smDiff = [...smB].filter((u) => !smA.has(u)).concat([...smA].filter((u) => !smB.has(u)));
add(smDiff.length ? 'ÉCHEC' : 'PASS', `Sitemap identique (${smA.size} URL)`, smDiff.join(', '));
const smPriv = [...smA].filter((u) => /\/(lp|admin|api|rdv)\/|\/devis\/signer/.test(u));
add(smPriv.length ? 'ÉCHEC' : 'PASS', 'Sitemap sans route publicitaire/privée', smPriv.join(', '));
add(before.robotsTxt === after.robotsTxt ? 'PASS' : 'ÉCHEC', 'robots.txt identique');

// ── 3. Formulaires : attributs, identifiants, liens tel ────────────────────
const formDiff = [];
for (const r of common) {
  const fb = before.routes[r].forms, fa = after.routes[r].forms;
  if (fb.length !== fa.length) { formDiff.push(`${r} : ${fb.length} → ${fa.length} formulaires`); continue; }
  fb.forEach((f, i) => { if (f.sigHash !== fa[i].sigHash || f.root !== fa[i].root) formDiff.push(`${r} : ${f.root} (attributs modifiés)`); });
}
add(formDiff.length ? 'ÉCHEC' : 'PASS', 'Formulaires : mêmes éléments, mêmes attributs (noms, valeurs, required, data-*, ids, classes)', formDiff.slice(0, 20).join(' ; '));
const idLost = [];
for (const r of common) { const ia = new Set(after.routes[r].ids); const miss = before.routes[r].ids.filter((id) => !ia.has(id)); if (miss.length) idLost.push(`${r} : ${miss.join(',')}`); }
add(idLost.length ? 'ÉCHEC' : 'PASS', 'Aucun identifiant/ancre supprimé (#simulateur, #rappel…)', idLost.slice(0, 20).join(' ; '));
const telDiff = common.filter((r) => JSON.stringify(before.routes[r].telLinks) !== JSON.stringify(after.routes[r].telLinks));
add(telDiff.length ? 'ÉCHEC' : 'PASS', 'Liens tel: identiques (nombre et attributs)', telDiff.join(', '));

// ── 4. Scripts (hors JSON-LD) ─────────────────────────────────────────────
const scriptDiff = [];
for (const r of common) {
  const sb = before.routes[r].scripts.filter((s) => s.type !== 'application/ld+json');
  const sa = after.routes[r].scripts.filter((s) => s.type !== 'application/ld+json');
  const kb = sb.map((s) => `${s.src}|${s.hash}`).join('\n'), ka = sa.map((s) => `${s.src}|${s.hash}`).join('\n');
  if (kb !== ka) scriptDiff.push(`${r} (${sb.length}→${sa.length})`);
}
add(scriptDiff.length ? (MODE === 'M' ? 'À REVOIR' : 'ÉCHEC') : 'PASS', 'Scripts identiques (tracking, formulaires, expériences)', scriptDiff.slice(0, 30).join(', '));

// ── 5. Éditorial : H1, prix balisés visibles, allégations ─────────────────
const h1Bad = ra.filter((r) => after.routes[r].h1.length !== 1).map((r) => `${r} (${after.routes[r].h1.length})`);
add(h1Bad.length ? 'ÉCHEC' : 'PASS', 'Un seul H1 par page', h1Bad.join(', '));
const long = ra.filter((r) => (after.routes[r].title || '').length > 60 || (after.routes[r].description || '').length > 155)
  .map((r) => `${r} (title ${after.routes[r].title?.length}, desc ${after.routes[r].description?.length})`);
add(long.length ? 'INFO' : 'PASS', 'Longueurs title ≤ 60 / description ≤ 155 (alerte éditoriale, pas une limite Google)', long.join(', '));

const ldPrices = [];
for (const r of ra) {
  const text = after.routes[r].bodyText.replace(/[  ]/g, ' ');
  for (const raw of after.routes[r].jsonld) {
    let j; try { j = JSON.parse(raw); } catch { ldPrices.push(`${r} : JSON-LD invalide`); continue; }
    const vals = [];
    (function walk(o) { if (!o || typeof o !== 'object') return; for (const [k, v] of Object.entries(o)) { if (['price', 'lowPrice', 'highPrice'].includes(k)) vals.push(String(v)); else walk(v); } })(j);
    for (const v of vals) if (!new RegExp(`(^|[^\\d])${v.replace('.', '[.,]')}\\s?€`).test(text)) ldPrices.push(`${r} : ${v} € balisé mais non visible`);
  }
}
add(ldPrices.length ? 'ÉCHEC' : 'PASS', 'Prix des données structurées visibles dans la page', [...new Set(ldPrices)].slice(0, 30).join(' ; '));

const FAIL = [[/certifi[ée]e?s? (par le )?cofrac/i, '« certifié COFRAC »'], [/milliers/i, 'volume « milliers » non documenté'], [/prix exact/i, '« prix exact »'],
  [/\[À REMPLACER\]|à vérifier/i, 'texte de brouillon'], [/n°\s?1\b|numéro 1|le meilleur/i, 'superlatif'], [/garantissons|garanti sous|délai garanti/i, 'garantie de délai']];
const WARN = [[/30\s?min/i, 'rappel 30 min'], [/48\s?h/i, '48 h'], [/24\s?h/i, '24 h'], [/opposable/i, 'opposable'], [/tout compris/i, 'tout compris']];
for (const [re, label] of FAIL) {
  const hits = ra.filter((r) => re.test(after.routes[r].bodyText) || re.test(after.routes[r].title) || re.test(after.routes[r].description || ''));
  add(hits.length ? 'ÉCHEC' : 'PASS', `Allégation interdite absente : ${label}`, hits.join(', '));
}
for (const [re, label] of WARN) {
  const hits = ra.filter((r) => re.test(after.routes[r].bodyText)).length;
  const hitsB = rb.filter((r) => re.test(before.routes[r].bodyText)).length;
  add('INFO', `Occurrences « ${label} » (pages)`, `${hitsB} → ${hits}`);
}
const audit24 = ['/audit-energetique/'].filter((r) => after.routes[r] && /24\s?h/.test(after.routes[r].bodyText));
add(audit24.length ? 'ÉCHEC' : 'PASS', 'Audit énergétique : pas de délai 24 h hérité', audit24.join(', '));
const sp = after.routes['/lp/vente-sans-prix/'];
if (sp) {
  const money = /\d\s?€|\d\s?euros?/i;
  const ldMoney = sp.jsonld.some((j) => /"(price|lowPrice|highPrice)"/.test(j));
  const bad = [money.test(sp.bodyText) && 'texte', money.test(sp.title) && 'title', money.test(sp.description || '') && 'meta', ldMoney && 'JSON-LD',
    sp.images.some((i) => money.test(i.alt || '')) && 'alt'].filter(Boolean);
  add(bad.length ? 'ÉCHEC' : 'PASS', 'Bras B /lp/vente-sans-prix : aucun montant public', bad.join(', '));
}

// Liens internes
const files = new Set(ra);
const broken = [];
for (const r of ra) for (const h of after.routes[r].links) {
  if (!h.startsWith('/') || h.startsWith('//')) continue;
  const p = h.split(/[?#]/)[0];
  if (!p || /\.(pdf|xml|txt|png|jpg|webp|svg|ics)$/.test(p) || p.startsWith('/api/')) continue;
  const norm = p.endsWith('/') ? p : p + '/';
  if (!files.has(norm) && !files.has(p)) broken.push(`${r} → ${h}`);
}
add(broken.length ? 'ÉCHEC' : 'PASS', 'Liens internes valides', [...new Set(broken)].slice(0, 30).join(' ; '));

// ── 6. Fichiers protégés (git) ────────────────────────────────────────────
let changed = [];
try { changed = execSync(`git diff --name-only ${BASE} -- .`, { encoding: 'utf8' }).split('\n').filter(Boolean); } catch { add('NON EXÉCUTÉ', 'Fichiers protégés (git indisponible)'); }
const FORMS = ['src/components/QuoteForm.astro', 'src/components/CallbackForm.astro', 'src/components/ContactForm.astro'];
const PROTECTED = [...FORMS, 'src/components/Analytics.astro', 'src/components/ConsentBanner.astro', 'src/components/BehaviorTracking.astro', 'src/components/ChatWidget.astro',
  'src/lib/pricing.ts', 'astro.config.mjs', 'vercel.json', 'public/robots.txt', 'package.json', 'package-lock.json', 'src/lib/googleAds.ts', 'src/lib/supabase.ts'];
const PROTECTED_DIRS = ['src/lib/track/', 'src/pages/api/', 'src/pages/admin/', 'src/pages/rdv/', 'src/pages/devis/signer/', 'supabase/'];
const touched = changed.filter((f) => PROTECTED.includes(f) || PROTECTED_DIRS.some((d) => f.startsWith(d)));
const allowedM = MODE === 'M' ? touched.filter((f) => FORMS.includes(f)) : [];
const forbidden = touched.filter((f) => !allowedM.includes(f));
add(forbidden.length ? 'ÉCHEC' : 'PASS', 'Fichiers protégés inchangés (pricing, tracking, consentement, API, admin, config)', forbidden.join(', '));
if (allowedM.length) add('À REVOIR', 'Formulaires modifiés (lot M) — revue de diff + recette F/T exigées', allowedM.join(', '));
if (changed.includes('src/lib/site.ts')) {
  const d = execSync(`git diff -U0 ${BASE} -- src/lib/site.ts`, { encoding: 'utf8' }).split('\n').filter((l) => /^[+-][^+-]/.test(l));
  const other = d.filter((l) => !/cofracNote/.test(l));
  add(other.length ? 'ÉCHEC' : 'PASS', 'site.ts : seule la formulation cofracNote change', other.slice(0, 6).join(' | '));
}

// ── Rapport ────────────────────────────────────────────────────────────────
const fails = rows.filter((r) => r.status === 'ÉCHEC').length;
const md = [`# Contrôles — mode ${MODE}`, '', `Avant : ${A} (${before.generatedAt})  `, `Après : ${B} (${after.generatedAt})  `, `Base git : ${BASE}`, '',
  '| Statut | Contrôle | Détail |', '|---|---|---|', ...rows.map((r) => `| ${r.status} | ${r.check} | ${String(r.detail).replace(/\|/g, '\\|').slice(0, 900)} |`), '',
  `**${fails} échec(s)** — ${rows.filter((r) => r.status === 'PASS').length} PASS, ${rows.filter((r) => r.status === 'À REVOIR').length} À REVOIR.`].join('\n');
if (opt.out) writeFileSync(opt.out, md + '\n');
console.log(md);
process.exit(fails ? 1 : 0);
