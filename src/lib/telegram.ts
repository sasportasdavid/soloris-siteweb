/**
 * Helpers Telegram partagés (carte lead + libellés). Aucune clé ici (côté appelant).
 */

/** Clavier inline sous chaque carte lead. callback_data court (< 64 octets). */
export function leadKeyboard(leadId: string) {
  return {
    inline_keyboard: [
      [
        { text: 'Contacté', callback_data: 'ct|' + leadId },
        { text: '🔁 À recontacter', callback_data: 'rc|' + leadId },
      ],
      [
        { text: '📅 Caler le RDV', callback_data: 'rdv|' + leadId },
        { text: '📄 Devis', callback_data: 'dv|' + leadId },
      ],
      [{ text: 'Perdu', callback_data: 'pd|' + leadId }],
    ],
  };
}

export const STATUT_LABELS_TG: Record<string, string> = {
  nouveau: 'Nouveau', contacte: 'Contacté', a_recontacter: 'À recontacter', rdv_pris: 'RDV pris',
  realise: 'Réalisé', facture: 'Facturé', perdu: 'Perdu',
};

// ── Dates de rappel (« à recontacter ») : chaînes YYYY-MM-DD, jour calendaire à Paris ──

/** Bouton inerte (en-têtes, jours passés) : le webhook se contente d'y répondre. */
const NOOP = 'x';
const YMD = /^\d{4}-\d{2}-\d{2}$/;
const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

/** Date du jour à Paris (YYYY-MM-DD). */
export function parisToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}
const toUtc = (ymd: string) => new Date(ymd + 'T00:00:00Z');
const fromUtc = (d: Date) => d.toISOString().slice(0, 10);
export function addDays(ymd: string, n: number): string {
  const d = toUtc(ymd); d.setUTCDate(d.getUTCDate() + n); return fromUtc(d);
}
/** « mar. 14/10 » */
export function rappelLabel(ymd: string): string {
  if (!YMD.test(ymd)) return ymd;
  return toUtc(ymd).toLocaleDateString('fr-FR', { timeZone: 'UTC', weekday: 'short', day: '2-digit', month: '2-digit' });
}
/** Date de rappel acceptée : aujourd'hui (Paris) à J+366, comme la RPC tg_set_recontacter. */
export function rappelDateOk(ymd: string, today: string = parisToday()): boolean {
  return YMD.test(ymd) && fromUtc(toUtc(ymd)) === ymd && ymd >= today && ymd <= addDays(today, 366);
}

/** Choix rapide de la date de rappel (après clic sur « 🔁 À recontacter »). */
export function recontacterKeyboard(leadId: string, today: string = parisToday()) {
  const dow = toUtc(today).getUTCDay(); // 0 = dimanche
  const lundi = addDays(today, ((8 - dow) % 7) || 7);
  const btn = (txt: string, ymd: string) => ({ text: `${txt} · ${rappelLabel(ymd)}`, callback_data: `rcd|${leadId}|${ymd}` });
  return {
    inline_keyboard: [
      [btn('Demain', addDays(today, 1)), btn('Après-demain', addDays(today, 2))],
      [btn('Lundi', lundi), btn('Dans 1 sem.', addDays(today, 7))],
      [btn('Dans 2 sem.', addDays(today, 14)), btn('Dans 1 mois', addDays(today, 30))],
      [
        { text: '📅 Autre date…', callback_data: `rcm|${leadId}|${today.slice(0, 7)}` },
        { text: '↩︎ Annuler', callback_data: `rcx|${leadId}` },
      ],
    ],
  };
}

/** Mini-calendrier d'un mois (YYYY-MM) : jours passés inertes, navigation sur 12 mois. */
export function calendarKeyboard(leadId: string, month: string, today: string = parisToday()) {
  const first = toUtc(month + '-01');
  const y = first.getUTCFullYear(), m = first.getUTCMonth();
  const prev = fromUtc(new Date(Date.UTC(y, m - 1, 1))).slice(0, 7);
  const next = fromUtc(new Date(Date.UTC(y, m + 1, 1))).slice(0, 7);
  const minMonth = today.slice(0, 7);
  const maxMonth = addDays(today, 366).slice(0, 7);
  const nav = (ok: boolean, txt: string, target: string) =>
    ({ text: ok ? txt : ' ', callback_data: ok ? `rcm|${leadId}|${target}` : NOOP });

  const rows: { text: string; callback_data: string }[][] = [
    [nav(prev >= minMonth, '‹', prev), { text: `${MOIS[m]} ${y}`, callback_data: NOOP }, nav(next <= maxMonth, '›', next)],
    ['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((d) => ({ text: d, callback_data: NOOP })),
  ];
  const offset = (first.getUTCDay() + 6) % 7; // lundi = 0
  const nbJours = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  let week: { text: string; callback_data: string }[] = Array.from({ length: offset }, () => ({ text: ' ', callback_data: NOOP }));
  for (let d = 1; d <= nbJours; d++) {
    const ymd = `${month}-${String(d).padStart(2, '0')}`;
    week.push(rappelDateOk(ymd, today) ? { text: String(d), callback_data: `rcd|${leadId}|${ymd}` } : { text: '·', callback_data: NOOP });
    if (week.length === 7) { rows.push(week); week = []; }
  }
  if (week.length) { while (week.length < 7) week.push({ text: ' ', callback_data: NOOP }); rows.push(week); }
  rows.push([{ text: '↩︎ Retour', callback_data: `rc|${leadId}` }]);
  return { inline_keyboard: rows };
}

// ── Perdu : motif (boutons) puis commentaire obligatoire (réponse au message du bot) ──

/** Motifs de perte — mêmes codes que /admin (MOTIF_LABELS) et la RPC tg_set_perdu. */
export const MOTIFS_PERTE: Record<string, string> = {
  prix: 'Prix', delai: 'Délai', injoignable: 'Injoignable', concurrent: 'Concurrent',
  pas_decideur: 'Pas décideur', reporte: 'Reporté / plus tard', autre: 'Autre',
};

export function perduKeyboard(leadId: string) {
  const btns = Object.entries(MOTIFS_PERTE).map(([code, label]) => ({ text: label, callback_data: `pdm|${leadId}|${code}` }));
  const rows: { text: string; callback_data: string }[][] = [];
  for (let i = 0; i < btns.length; i += 2) rows.push(btns.slice(i, i + 2));
  rows.push([{ text: '↩︎ Annuler', callback_data: `rcx|${leadId}` }]);
  return { inline_keyboard: rows };
}

/** Référence lisible par le webhook en dernière ligne du message « commentaire ». */
const PERDU_REF = /réf\. ([0-9a-f-]{36})·([a-z_]+)\s*$/i;

export function perduPromptText(nom: string | null | undefined, motif: string, leadId: string): string {
  return [
    `❌ Lead perdu — ${nom || 'sans nom'} · motif : ${MOTIFS_PERTE[motif] || motif}`,
    '✍️ Répondez à CE message avec un commentaire (obligatoire) pour valider.',
    `réf. ${leadId}·${motif}`,
  ].join('\n');
}

export function parsePerduRef(text: string | null | undefined): { leadId: string; motif: string } | null {
  const m = PERDU_REF.exec(String(text || ''));
  return m && MOTIFS_PERTE[m[2]] ? { leadId: m[1], motif: m[2] } : null;
}
