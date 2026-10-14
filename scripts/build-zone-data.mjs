#!/usr/bin/env node
/**
 * Génère src/data/zones-data.json : données publiques par commune pour les pages locales
 * (/diagnostic-immobilier-{slug}). Aucune donnée inventée : tout vient de trois API ouvertes.
 *
 *  - ADEME, Observatoire DPE-Audit, jeu « DPE logements existants » (depuis juillet 2021)
 *    → répartition des étiquettes, des époques de construction, appartements / maisons, surface moyenne
 *  - Géorisques (BRGM) : risques recensés (GASPAR), potentiel radon, zonage sismique, arrêtés CatNat
 *  - geo.api.gouv.fr (Etalab) : population, codes postaux, centre de la commune
 *
 * Usage :  node scripts/build-zone-data.mjs            (toutes les communes de la liste)
 *          node scripts/build-zone-data.mjs nanterre   (une seule, pour tester)
 * Derrière un proxy d'entreprise : NODE_USE_ENV_PROXY=1 node scripts/build-zone-data.mjs
 *
 * Pour ajouter une commune : l'ajouter à COMMUNES (slug identique à celui de src/lib/zones.ts,
 * code INSEE officiel, nom attendu pour garde-fou), relancer le script, relire le JSON produit.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = resolve(dirname(fileURLToPath(import.meta.url)), '../src/data/zones-data.json');
const ADEME = 'https://data.ademe.fr/data-fair/api/v1/datasets/dpe03existant';
const GEORISQUES = 'https://georisques.gouv.fr/api/v1';
const GEO = 'https://geo.api.gouv.fr';

/** slug → code INSEE + nom attendu (le script s'arrête si l'API renvoie un autre nom). */
export const COMMUNES = [
  { slug: 'nanterre', insee: '92050', name: 'Nanterre' },
  { slug: 'courbevoie', insee: '92026', name: 'Courbevoie' },
  { slug: 'asnieres-sur-seine', insee: '92004', name: 'Asnières-sur-Seine' },
  { slug: 'colombes', insee: '92025', name: 'Colombes' },
  { slug: 'rueil-malmaison', insee: '92063', name: 'Rueil-Malmaison' },
  { slug: 'issy-les-moulineaux', insee: '92040', name: 'Issy-les-Moulineaux' },
  { slug: 'levallois-perret', insee: '92044', name: 'Levallois-Perret' },
  { slug: 'neuilly-sur-seine', insee: '92051', name: 'Neuilly-sur-Seine' },
  { slug: 'clichy', insee: '92024', name: 'Clichy' },
  { slug: 'antony', insee: '92002', name: 'Antony' },
  { slug: 'montrouge', insee: '92049', name: 'Montrouge' },
  { slug: 'clamart', insee: '92023', name: 'Clamart' },
  { slug: 'versailles', insee: '78646', name: 'Versailles' },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getJson(url, tries = 4) {
  let last;
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(60000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (e) {
      last = e;
      await sleep(1500 * (i + 1));
    }
  }
  throw new Error(`${url} → ${last?.message || last}`);
}

/** Agrégation côté serveur ADEME : { valeur: effectif } + total. */
async function ademeCounts(insee, field, extra = '') {
  const url = `${ADEME}/values_agg?field=${field}&qs=code_insee_ban:${insee}&agg_size=20${extra}`;
  const d = await getJson(url);
  const counts = {};
  const avg = {};
  for (const a of d.aggs) {
    counts[a.value] = a.total;
    if (typeof a.metric === 'number') avg[a.value] = Math.round(a.metric * 10) / 10;
  }
  return { total: d.total, counts, avg };
}

async function georisques(insee) {
  const risques = await getJson(`${GEORISQUES}/gaspar/risques?code_insee=${insee}`);
  const detail = risques.data?.[0]?.risques_detail || [];
  // Risques de premier niveau uniquement (codes à 2 chiffres : 11 inondation, 12 mouvement de terrain…)
  const top = [...new Set(detail.filter((r) => String(r.num_risque).length === 2).map((r) => r.libelle_risque_long))];

  const radon = await getJson(`${GEORISQUES}/radon?code_insee=${insee}`);
  const seismic = await getJson(`${GEORISQUES}/zonage_sismique?code_insee=${insee}`);

  // Arrêtés de catastrophe naturelle : on pagine jusqu'au bout
  const catnat = [];
  for (let page = 1; page <= 20; page++) {
    const c = await getJson(`${GEORISQUES}/gaspar/catnat?code_insee=${insee}&page_size=100&page=${page}`);
    catnat.push(...(c.data || []));
    if (!c.next || page >= (c.total_pages || 1)) break;
  }
  const years = catnat
    .map((c) => Number(String(c.date_debut_evt || '').slice(-4)))
    .filter((y) => y > 1900);
  const types = {};
  for (const c of catnat) types[c.libelle_risque_jo] = (types[c.libelle_risque_jo] || 0) + 1;

  return {
    risques: top,
    radonClasse: radon.data?.[0]?.classe_potentiel ?? null,
    sismicite: seismic.data?.[0]?.zone_sismicite ?? null,
    catnat: {
      total: catnat.length,
      depuis: years.length ? Math.min(...years) : null,
      types,
    },
  };
}

async function buildOne(c) {
  const geo = await getJson(`${GEO}/communes/${c.insee}?fields=nom,code,codesPostaux,population,centre,departement`);
  if (geo.nom !== c.name) throw new Error(`Garde-fou : ${c.insee} est « ${geo.nom} », attendu « ${c.name} »`);

  const etiquettes = await ademeCounts(c.insee, 'etiquette_dpe');
  const periodes = await ademeCounts(c.insee, 'periode_construction');
  const types = await ademeCounts(c.insee, 'type_batiment', '&metric=avg&metric_field=surface_habitable_logement');
  const risques = await georisques(c.insee);

  return {
    insee: c.insee,
    name: geo.nom,
    departement: geo.departement?.nom,
    population: geo.population,
    codesPostaux: geo.codesPostaux,
    centre: { latitude: geo.centre.coordinates[1], longitude: geo.centre.coordinates[0] },
    dpe: {
      total: etiquettes.total,
      etiquettes: etiquettes.counts, // A..G
      periodes: periodes.counts, // « avant 1948 », « 1948-1974 », …
      types: types.counts, // appartement / maison / immeuble
      surfaceMoyenne: types.avg, // m², par type de bâtiment
    },
    georisques: risques,
  };
}

const only = process.argv[2];
const list = only ? COMMUNES.filter((c) => c.slug === only) : COMMUNES;
if (!list.length) {
  console.error(`Commune inconnue : ${only}`);
  process.exit(1);
}

const communes = {};
for (const c of list) {
  process.stdout.write(`${c.name} (${c.insee}) … `);
  communes[c.slug] = await buildOne(c);
  console.log(`${communes[c.slug].dpe.total} DPE, ${communes[c.slug].georisques.risques.length} risques`);
  await sleep(300);
}

mkdirSync(dirname(OUT), { recursive: true });
const payload = {
  generatedAt: new Date().toISOString().slice(0, 10),
  sources: {
    dpe: "ADEME, Observatoire DPE-Audit, DPE des logements existants établis depuis juillet 2021",
    risques: 'Géorisques (BRGM) : GASPAR, potentiel radon, zonage sismique, arrêtés de catastrophe naturelle',
    communes: 'geo.api.gouv.fr (Etalab) : population, codes postaux',
  },
  communes,
};
writeFileSync(OUT, JSON.stringify(payload, null, 2) + '\n');
console.log(`\n→ ${OUT} (${Object.keys(communes).length} commune(s))`);
