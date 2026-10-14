/**
 * Données publiques par commune pour les pages locales, lues dans src/data/zones-data.json
 * (généré par scripts/build-zone-data.mjs depuis l'ADEME, Géorisques et geo.api.gouv.fr).
 * Ce module ne fait que calculer des parts et formater : aucun chiffre n'est écrit à la main.
 * Une zone sans entrée dans le JSON n'affiche simplement pas le bloc « en chiffres ».
 */
import raw from '../data/zones-data.json';

type Counts = Record<string, number>;
interface RawCommune {
  insee: string;
  name: string;
  population: number;
  dpe: {
    total: number;
    etiquettes: Counts;
    periodes: Counts;
    types: Counts;
    surfaceMoyenne: Record<string, number>;
  };
  georisques: {
    risques: string[];
    radonClasse: string | null;
    sismicite: string | null;
    catnat: { total: number; depuis: number | null; types: Record<string, number> };
  };
}
const DATA = raw as unknown as {
  generatedAt: string;
  sources: Record<string, string>;
  communes: Record<string, RawCommune>;
};

const LABELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G'] as const;

/** Périodes ADEME regroupées pour la lecture (les bornes réglementaires sont expliquées dans la page). */
const BUCKETS: { label: string; keys: string[] }[] = [
  { label: 'Avant 1948', keys: ['avant 1948'] },
  { label: '1948 à 1974', keys: ['1948-1974'] },
  { label: '1975 à 1988', keys: ['1975-1977', '1978-1982', '1983-1988'] },
  { label: '1989 à 2000', keys: ['1989-2000'] },
  { label: 'Depuis 2001', keys: ['2001-2005', '2006-2012', '2013-2021', 'après 2021'] },
];
/** Zonage sismique réglementaire (Géorisques renvoie « 1 - TRES FAIBLE », en majuscules sans accents). */
const SISMICITE: Record<string, string> = {
  '1': 'très faible (zone 1)', '2': 'faible (zone 2)', '3': 'modérée (zone 3)', '4': 'moyenne (zone 4)', '5': 'forte (zone 5)',
};
const PRE_1989 = ['avant 1948', '1948-1974', '1975-1977', '1978-1982', '1983-1988'];

export interface ZoneStats {
  name: string;
  population: number;
  dpeTotal: number;
  etiquettes: { label: string; n: number; pct: number }[];
  topEtiquette: { label: string; pct: number };
  topPeriode: { label: string; pct: number };
  shareFG: number; // % de DPE classés F ou G
  shareE: number;
  periodes: { label: string; n: number; pct: number }[];
  shareAvant1948: number;
  sharePre1989: number;
  nMaison: number; // nombre de DPE de maisons (pour décider d'afficher la surface moyenne)
  shareMaison: number; // part des maisons parmi (appartements + maisons)
  shareAppartement: number;
  surfaceAppartement: number | null;
  surfaceMaison: number | null;
  risques: string[];
  radonClasse: string | null;
  sismicite: string | null; // ex. « très faible »
  catnat: { total: number; depuis: number | null; principal: string | null };
  generatedAt: string;
}

const pct = (n: number, total: number) => (total > 0 ? (n / total) * 100 : 0);
const sum = (c: Counts, keys: string[]) => keys.reduce((s, k) => s + (c[k] || 0), 0);

export function getZoneStats(slug: string): ZoneStats | null {
  const c = DATA.communes[slug];
  if (!c || !c.dpe?.total) return null;
  const { total, etiquettes, periodes, types, surfaceMoyenne } = c.dpe;

  const logements = (types.appartement || 0) + (types.maison || 0);
  const catTypes = Object.entries(c.georisques.catnat.types).sort((a, b) => b[1] - a[1]);
  const sisCode = c.georisques.sismicite?.match(/^\d/)?.[0];
  const sis = sisCode ? SISMICITE[sisCode] ?? null : null;

  return {
    name: c.name,
    population: c.population,
    dpeTotal: total,
    etiquettes: LABELS.map((l) => ({ label: l, n: etiquettes[l] || 0, pct: pct(etiquettes[l] || 0, total) })),
    topEtiquette: (() => { const e = LABELS.map((l) => ({ label: l as string, pct: pct(etiquettes[l] || 0, total) })); return e.reduce((a, b) => (b.pct > a.pct ? b : a)); })(),
    topPeriode: (() => { const p = BUCKETS.map((b) => ({ label: b.label, pct: pct(sum(periodes, b.keys), total) })); return p.reduce((a, b) => (b.pct > a.pct ? b : a)); })(),
    shareFG: pct((etiquettes.F || 0) + (etiquettes.G || 0), total),
    shareE: pct(etiquettes.E || 0, total),
    periodes: BUCKETS.map((b) => ({ label: b.label, n: sum(periodes, b.keys), pct: pct(sum(periodes, b.keys), total) })),
    shareAvant1948: pct(periodes['avant 1948'] || 0, total),
    sharePre1989: pct(sum(periodes, PRE_1989), total),
    nMaison: types.maison || 0,
    shareMaison: pct(types.maison || 0, logements),
    shareAppartement: pct(types.appartement || 0, logements),
    surfaceAppartement: surfaceMoyenne.appartement ?? null,
    surfaceMaison: surfaceMoyenne.maison ?? null,
    risques: c.georisques.risques,
    radonClasse: c.georisques.radonClasse,
    sismicite: sis,
    catnat: { total: c.georisques.catnat.total, depuis: c.georisques.catnat.depuis, principal: catTypes[0]?.[0] ?? null },
    generatedAt: DATA.generatedAt,
  };
}

/** Pourcentage à la française : une décimale sous 10 %, entier au-delà (« 7,6 % », « 24 % »). */
export function fmtPct(x: number): string {
  const v = x < 10 ? Math.round(x * 10) / 10 : Math.round(x);
  return `${String(v).replace('.', ',')} %`;
}
export function fmtInt(n: number): string {
  return Math.round(n).toLocaleString('fr-FR').replace(/ /g, ' ');
}
export function fmtSurface(m2: number): string {
  return `${String(Math.round(m2)).replace('.', ',')} m²`;
}

/** Date d'extraction lisible (« 14 octobre 2026 »). */
export function fmtDateFr(iso: string): string {
  return new Date(iso + 'T00:00:00Z').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
}

/** Couleurs de l'échelle DPE officielle, pour les barres (le texte porte l'information, pas la couleur). */
export const DPE_COLORS: Record<string, string> = {
  A: '#319834', B: '#33cc31', C: '#cbfc34', D: '#fbfe06', E: '#fbcc05', F: '#fc9935', G: '#fc0205',
};

/** « inondation, mouvement de terrain et risque industriel » */
export function listFr(items: string[]): string {
  const low = items.map((s) => s.charAt(0).toLowerCase() + s.slice(1));
  if (low.length <= 1) return low.join('');
  return `${low.slice(0, -1).join(', ')} et ${low[low.length - 1]}`;
}
