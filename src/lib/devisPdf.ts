/**
 * Génération du PDF d'un devis Soloris (pdf-lib, 100 % JS — compatible Vercel/Node,
 * aucune dépendance native). Mise en page A4 professionnelle, mentions conformes.
 * ⚠️ Police Helvetica (encodage WinAnsi) : éviter les glyphes hors WinAnsi
 * (pas de « ✓ », pas d'espace fine U+202F).
 */
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { SITE, fullAddress } from './site';

const BLUE = rgb(0.043, 0.165, 0.290); // #0B2A4A
const GOLD = rgb(0.961, 0.651, 0.137); // #F5A623
const INK = rgb(0.13, 0.15, 0.18);
const SOFT = rgb(0.42, 0.45, 0.5);
const LINE = rgb(0.84, 0.86, 0.89);
const GREEN = rgb(0.11, 0.48, 0.28);

function frDate(s: any): string {
  const dt = s ? new Date(s) : new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(dt.getDate())}/${p(dt.getMonth() + 1)}/${dt.getFullYear()}`;
}
function eur(n: any): string {
  // Séparateur de milliers = espace ASCII (évite l'espace fine U+202F des locales ICU,
  // non encodable en WinAnsi par pdf-lib).
  const v = Math.round(Number(n) || 0);
  return String(v).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' €';
}

export interface DevisPdfData {
  numero: string;
  created_at?: string;
  client_nom?: string;
  client_email?: string;
  client_tel?: string;
  client_cp?: string;
  objet?: string;
  lignes?: { libelle: string; montant: number }[];
  montant?: number;
  validite_jours?: number;
  statut?: string;
  signed_at?: string;
  signed_nom?: string;
}

export async function generateDevisPdf(d: DevisPdfData, opts: { signUrl?: string } = {}): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`Devis ${d.numero} - Soloris`);
  doc.setProducer('Soloris');
  const page = doc.addPage([595.28, 841.89]); // A4
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const W = 595.28;
  const M = 50;
  const right = W - M;
  let y = 792;

  const text = (s: string, x: number, yy: number, size = 10, f = font, color = INK) =>
    page.drawText(s ?? '', { x, y: yy, size, font: f, color });
  const textRight = (s: string, xr: number, yy: number, size = 10, f = font, color = INK) =>
    page.drawText(s ?? '', { x: xr - f.widthOfTextAtSize(s ?? '', size), y: yy, size, font: f, color });
  const hr = (yy: number, color = LINE) =>
    page.drawLine({ start: { x: M, y: yy }, end: { x: right, y: yy }, thickness: 1, color });

  function wrap(s: string, f: any, size: number, maxW: number): string[] {
    const words = (s || '').split(/\s+/);
    const lines: string[] = [];
    let cur = '';
    for (const w of words) {
      const t = cur ? cur + ' ' + w : w;
      if (f.widthOfTextAtSize(t, size) > maxW && cur) { lines.push(cur); cur = w; }
      else cur = t;
    }
    if (cur) lines.push(cur);
    return lines.length ? lines : [''];
  }

  // ── En-tête ──
  text('Soloris', M, y, 26, bold, BLUE);
  page.drawRectangle({ x: M, y: y - 9, width: 40, height: 3, color: GOLD });
  text('Le diagnostic, en toute clarté.', M, y - 22, 9, font, SOFT);

  textRight('DEVIS', right, y + 2, 22, bold, BLUE);
  textRight(`N° ${d.numero}`, right, y - 16, 10, bold, INK);
  textRight(`Date : ${frDate(d.created_at)}`, right, y - 30, 9.5, font, SOFT);
  textRight(`Valable ${d.validite_jours || 30} jours`, right, y - 43, 9.5, font, SOFT);

  y -= 64;
  hr(y);
  y -= 24;

  // ── Émetteur / Destinataire ──
  const colR = 320;
  text('ÉMETTEUR', M, y, 9, bold, GOLD);
  text('DESTINATAIRE', colR, y, 9, bold, GOLD);
  y -= 16;

  const emetteur: [string, any][] = [
    [`${SITE.tradeName} - ${SITE.legalName}`, bold],
    [fullAddress(), font],
    [`SIRET ${SITE.siret}`, font],
    [`${SITE.email}`, font],
    [`${SITE.phoneDisplay}`, font],
  ];
  const client: [string, any][] = ([
    [d.client_nom || '-', bold],
    [d.client_email || '', font],
    [d.client_tel || '', font],
    [d.client_cp ? `Code postal ${d.client_cp}` : '', font],
  ] as [string, any][]).filter((r) => r[0]);

  const nrows = Math.max(emetteur.length, client.length);
  let yy = y;
  for (let i = 0; i < nrows; i++) {
    if (emetteur[i]) text(emetteur[i][0], M, yy, 9.5, emetteur[i][1], emetteur[i][1] === bold ? BLUE : INK);
    if (client[i]) text(client[i][0], colR, yy, 9.5, client[i][1], client[i][1] === bold ? BLUE : INK);
    yy -= 14;
  }
  y = yy - 8;
  hr(y);
  y -= 22;

  // ── Objet ──
  if (d.objet) {
    text('OBJET', M, y, 9, bold, SOFT);
    const ol = wrap(d.objet, font, 11, right - M - 60);
    let oy = y;
    ol.forEach((ln, i) => { text(ln, M + 52, oy, 11, i === 0 ? bold : font, BLUE); oy -= 14; });
    y = oy - 8;
  }

  // ── Tableau des lignes ──
  page.drawRectangle({ x: M, y: y - 4, width: right - M, height: 22, color: rgb(0.96, 0.97, 0.98) });
  text('DÉSIGNATION', M + 10, y + 3, 9, bold, BLUE);
  textRight('MONTANT TTC', right - 10, y + 3, 9, bold, BLUE);
  y -= 14;
  hr(y);
  y -= 18;

  const lignes = d.lignes && d.lignes.length ? d.lignes : [{ libelle: d.objet || 'Prestation', montant: d.montant || 0 }];
  for (const l of lignes) {
    const wl = wrap(l.libelle, font, 10, right - M - 120);
    let ly = y;
    wl.forEach((ln, i) => { text(ln, M + 10, ly, 10, font, INK); if (i === 0) textRight(eur(l.montant), right - 10, ly, 10, font, INK); ly -= 13; });
    y = ly - 4;
    hr(y + 6, rgb(0.93, 0.94, 0.96));
  }

  // ── Total ──
  y -= 6;
  const total = typeof d.montant === 'number' ? d.montant : lignes.reduce((s, l) => s + (Number(l.montant) || 0), 0);
  page.drawRectangle({ x: colR, y: y - 6, width: right - colR, height: 26, color: BLUE });
  text('Total TTC', colR + 12, y + 2, 11, bold, rgb(1, 1, 1));
  textRight(eur(total), right - 12, y + 2, 13, bold, GOLD);
  y -= 36;

  // ── Mentions ──
  const mentions = [
    'Montants en euros, TTC, déplacement inclus. ERP inclus dans les packs vente et location.',
    'Rapport(s) transmis sous 48 h après réception du règlement. Prestation réalisée par un diagnostiqueur certifié (assurance RC professionnelle).',
    `Devis valable ${d.validite_jours || 30} jours à compter de sa date d'émission.`,
  ];
  mentions.forEach((m) => { wrap(m, font, 8.5, right - M).forEach((ln) => { text(ln, M, y, 8.5, font, SOFT); y -= 11; }); });
  y -= 10;

  // ── Signature ──
  if (d.statut === 'signe') {
    page.drawRectangle({ x: M, y: y - 30, width: right - M, height: 40, color: rgb(0.93, 0.97, 0.94), borderColor: GREEN, borderWidth: 1 });
    text('Devis accepté et signé électroniquement', M + 12, y - 6, 11, bold, GREEN);
    text(`Par ${d.signed_nom || '-'} le ${frDate(d.signed_at)} - bon pour accord (signature électronique).`, M + 12, y - 22, 9, font, INK);
    y -= 46;
  } else {
    page.drawRectangle({ x: M, y: y - 44, width: right - M, height: 54, borderColor: LINE, borderWidth: 1 });
    text('Bon pour accord', M + 12, y - 4, 11, bold, BLUE);
    if (opts.signUrl) {
      text('Signez votre devis en ligne (signature électronique) :', M + 12, y - 20, 9, font, INK);
      text(opts.signUrl, M + 12, y - 33, 9, bold, GOLD);
    } else {
      text('Date et signature, précédées de la mention « Bon pour accord » :', M + 12, y - 24, 9, font, SOFT);
    }
    y -= 60;
  }

  // ── Pied de page légal ──
  const footer = `${SITE.legalName} (${SITE.legalForm} au capital de ${SITE.capital}) - marque ${SITE.tradeName} · SIREN ${SITE.siren} · SIRET ${SITE.siret} · TVA ${SITE.vat} · APE ${SITE.ape}`;
  page.drawLine({ start: { x: M, y: 52 }, end: { x: right, y: 52 }, thickness: 1, color: LINE });
  wrap(footer, font, 7.5, right - M).forEach((ln, i) => text(ln, M, 40 - i * 10, 7.5, font, SOFT));
  text(fullAddress(), M, 20, 7.5, font, SOFT);

  return await doc.save();
}
