#!/usr/bin/env node
/**
 * Contrôle de PÉRIMÈTRE SOURCE du chantier design V3 (cahier Soloris Design UX V3, §08).
 *
 * Équivalent Node (sans dépendance) du contrôleur `garde_fou_design.py` cité par le cahier
 * mais non fourni. Compare un SHA de baseline FIXE au working tree (commits postérieurs +
 * modifications non commitées + fichiers non suivis non ignorés). Aucune action Git
 * modifiante (pas de checkout, reset ni push), aucune requête réseau.
 *
 * Usage : node scripts/controles/perimetre-design.mjs --base <SHA> [--lot visuel|pages] [--json sortie.json]
 * Code 0 = périmètre accepté (une RECETTE reste requise) · code 2 = blocage.
 *
 * Il ne remplace ni un navigateur ni une recette : une règle CSS peut masquer un champ sans
 * franchir ce contrôle (voir design-checks.mjs pour la vérification dans le DOM rendu).
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync, writeFileSync } from 'node:fs';

const args = Object.fromEntries(process.argv.slice(2).join(' ').split('--').filter(Boolean).map((a) => { const [k, ...v] = a.trim().split(/[ =]/); return [k, v.join(' ').trim() || true]; }));
const BASE = args.base;
const LOT = args.lot || 'visuel';
if (!BASE || !/^[0-9a-f]{40}$/.test(BASE)) { console.error('--base <SHA complet de 40 caractères> requis'); process.exit(2); }

const git = (...a) => execFileSync('git', a, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
const atBase = (f) => { try { return git('show', `${BASE}:${f}`); } catch { return null; } };
const now = (f) => (existsSync(f) ? readFileSync(f, 'utf8') : null);

// Fichiers modifiés depuis la baseline (commités ou non) + non suivis non ignorés.
const changed = new Set([
  ...git('diff', '--name-only', BASE).split('\n').filter(Boolean),
  ...git('ls-files', '--others', '--exclude-standard').split('\n').filter(Boolean),
]);

// ── Fichiers gelés (cahier §4.2) ────────────────────────────────────────────────────────
const FROZEN = [
  /^src\/components\/(QuoteForm|CallbackForm|ContactForm|ChatWidget|Analytics|ConsentBanner|BehaviorTracking)\.astro$/,
  /^src\/lib\/track\//, /^src\/lib\/googleAds\.ts$/, /^src\/lib\/pricing\.ts$/,
  /^src\/lib\/(devis|devisPdf|devisSend|devisServer|devisSync|confirmEmail|rdv\w*|ics|adminAuth|serverEnv|supabase|telegram\w*|cardResync)\.ts$/,
  /^src\/pages\/(api|admin|rdv)\//, /^src\/pages\/devis\/signer\//, /^supabase\//,
  /^\.env/, /^package(-lock)?\.json$/, /^astro\.config\.mjs$/, /^vercel\.json$/, /^src\/layouts\/AdminLayout\.astro$/,
  /^src\/styles\/global\.css$/, // le supplément passe par une feuille dédiée (cahier §4.2)
];
// Hors application : outillage de contrôle et documentation.
const TOOLING = [/^scripts\/controles\//, /^docs\//, /^\.claude\/settings\.local\.json$/]; // + réglage local de l'environnement, jamais commité
const NEW_CSS = 'src/styles/soloris-design-v3.css';
const LAYOUTS = ['src/layouts/Base.astro', 'src/layouts/LandingLayout.astro'];
// Lot « pages » : composition éditoriale autorisée sur une liste explicite.
const PAGES = [
  /^src\/pages\/(index|tarifs|methode|devis|contact|zones-desservies|mentions-legales|confidentialite)\.astro$/,
  /^src\/pages\/diagnostics\/(index|\[diag\])\.astro$/, /^src\/pages\/guides\/[\w-]+\.astro$/,
  /^src\/pages\/diagnostic-immobilier-\[zone\]\.astro$/,
  /^src\/components\/(LandingDPE|LandingVente|OfferTemplate|Hero|ReassuranceBar|Reviews|ReviewWall|ReportPreview|OfferCard|Faq|Footer|Header|EnergyScale|GroupEndorsement|GuideSources)\.astro$/,
];
const ALLOWED_LAYOUT_ADDS = [
  /^import '\.\.\/styles\/soloris-design-v3\.css';$/,
  /^const solorisDesignV3 = !\/\^\\\/\(\?:admin\|api\|rdv\)\(\?:\\\/\|\$\)\/\.test\(Astro\.url\.pathname\) && !\/\^\\\/devis\\\/signer\(\?:\\\/\|\$\)\/\.test\(Astro\.url\.pathname\);$/,
  /^ {2}<body data-soloris-design=\{solorisDesignV3 \? "v3" : undefined\}>$/,
];

const results = [];
const add = (status, file, detail) => results.push({ status, file, detail });

// Invariants d'un fichier de page/composant éditorial (cahier §08 : frontmatter, scripts,
// appels sensibles, attributs fonctionnels, contrôles natifs, classes historiques).
const SENSITIVE = /<(QuoteForm|CallbackForm|ContactForm|ChatWidget|Analytics|ConsentBanner|BehaviorTracking)\b[\s\S]*?\/>/g;
const all = (re, s) => [...s.matchAll(re)].map((m) => m[1] ?? m[0]);
function invariants(file, a, b) {
  const issues = [], notes = [];
  const full = (s) => [...s.matchAll(SENSITIVE)].map((m) => m[0].replace(/\s+/g, ' ')); // appel complet, props comprises
  const sa = full(a), sb = full(b);
  if (JSON.stringify(sa) !== JSON.stringify(sb)) issues.push(`appels de composants sensibles modifiés (${sa.length} → ${sb.length})`);
  const scripts = (s) => all(/<script\b[\s\S]*?<\/script>/g, s);
  if (JSON.stringify(scripts(a)) !== JSON.stringify(scripts(b))) issues.push('bloc <script> modifié');
  const fm = (s) => (s.match(/^---\n([\s\S]*?)\n---/) || [])[1] || '';
  if (fm(a) !== fm(b)) notes.push('frontmatter modifié (revue requise)');
  for (const [label, re] of [['id', /\bid=(?:"([^"]+)"|\{([^}]+)\})/g], ['href', /\bhref=(?:"([^"]+)"|\{([^}]+)\})/g], ['data-*', /\b(data-[\w-]+)=/g]]) {
    const A = new Set([...a.matchAll(re)].map((m) => m[1] ?? m[2])), B = new Set([...b.matchAll(re)].map((m) => m[1] ?? m[2]));
    const lost = [...A].filter((x) => !B.has(x)); const gained = [...B].filter((x) => !A.has(x));
    if (lost.length) issues.push(`${label} supprimé(s) : ${lost.slice(0, 6).join(', ')}`);
    if (gained.length) notes.push(`${label} ajouté(s) : ${gained.slice(0, 6).join(', ')}`);
  }
  const ctrl = (s) => all(/<(input|select|textarea|form)\b/g, s).length + all(/<button[^>]*type="submit"/g, s).length;
  if (ctrl(b) > ctrl(a)) issues.push('nouveau contrôle natif / formulaire / bouton submit');
  const classes = (s) => new Set([...s.matchAll(/class="([^"{]+)"/g)].flatMap((m) => m[1].split(/\s+/)).filter(Boolean));
  const ca = classes(a), cb = classes(b); const lostC = [...ca].filter((c) => !cb.has(c));
  if (lostC.length) notes.push(`classe(s) statique(s) plus présente(s) : ${lostC.slice(0, 8).join(', ')}`);
  return { issues, notes };
}

for (const f of [...changed].sort()) {
  if (TOOLING.some((r) => r.test(f))) { add('PASS', f, 'outillage / documentation (hors application)'); continue; }
  if (FROZEN.some((r) => r.test(f))) { add('BLOCAGE', f, 'fichier gelé modifié'); continue; }
  if (f === NEW_CSS) {
    const css = now(f) || '';
    const bad = [];
    if (/!important/.test(css)) bad.push('!important');
    if (/content\s*:\s*["'][^"']*\d+\s*€/.test(css)) bad.push('prix rendu par content:');
    if (/\[hidden\][^{]*\{[^}]*display/.test(css)) bad.push('règle [hidden] redéfinie');
    if (/(input|select|textarea|\.qstep|\.qhp|\[data-el[^\]]*\])[^{,]*\{[^}]*\b(display|visibility|position|order|pointer-events|opacity)\s*:/.test(css)) bad.push('display/visibility/position/order/pointer-events/opacity sur un champ, une étape ou un data-el');
    if (/outline\s*:\s*(none|0)\b/.test(css)) bad.push('outline supprimé');
    if (/@import|url\(\s*["']?https?:/.test(css)) bad.push('import ou ressource externe');
    add(bad.length ? 'BLOCAGE' : 'PASS', f, bad.length ? bad.join(' ; ') : `feuille additionnelle (${Buffer.byteLength(css)} octets)`);
    continue;
  }
  if (LAYOUTS.includes(f)) {
    const a = (atBase(f) || '').split('\n'), b = (now(f) || '').split('\n');
    const removed = a.filter((l) => !b.includes(l)), addedL = b.filter((l) => !a.includes(l));
    const okRemoved = removed.every((l) => l === '  <body>');
    const okAdded = addedL.every((l) => ALLOWED_LAYOUT_ADDS.some((r) => r.test(l)));
    add(okRemoved && okAdded && addedL.length <= 3 ? 'PASS' : 'BLOCAGE', f,
      okRemoved && okAdded ? `activation V3 seulement (${addedL.length} ligne(s))` : `changement de layout hors activation : -${removed.length} / +${addedL.length}`);
    continue;
  }
  if (LOT === 'pages' && PAGES.some((r) => r.test(f))) {
    const a = atBase(f), b = now(f);
    if (a == null) { add('BLOCAGE', f, 'nouveau fichier de page/composant'); continue; }
    if (b == null) { add('BLOCAGE', f, 'fichier supprimé'); continue; }
    const { issues, notes } = invariants(f, a, b);
    add(issues.length ? 'BLOCAGE' : notes.length ? 'À REVOIR' : 'PASS', f, [...issues, ...notes].join(' ; ') || 'composition éditoriale, invariants conservés');
    continue;
  }
  add('BLOCAGE', f, `hors périmètre du lot « ${LOT} »`);
}

const blocked = results.filter((r) => r.status === 'BLOCAGE');
console.log(`Contrôle de périmètre design — base ${BASE.slice(0, 12)} — lot ${LOT}`);
for (const r of results) console.log(`${r.status.padEnd(9)} ${r.file}${r.detail ? ' — ' + r.detail : ''}`);
console.log(blocked.length ? `\n${blocked.length} BLOCAGE(S) — corriger avant recette.` : `\nPérimètre source accepté (${results.length} fichier(s)). La recette navigateur reste requise.`);
if (args.json && args.json !== true) writeFileSync(args.json, JSON.stringify({ base: BASE, lot: LOT, results }, null, 2));
process.exit(blocked.length ? 2 : 0);
