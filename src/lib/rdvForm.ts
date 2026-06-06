/**
 * Formulaire de confirmation de RDV — SOURCE UNIQUE (back-office ET lien public).
 * Pur (client + serveur), aucune dépendance serveur. Pré-remplit prestation/prix
 * via la logique de prix existante (buildDevisDraftFromLead).
 */
import { buildDevisDraftFromLead } from './devis';

export interface RdvPrefill {
  date: string; time: string; adresse: string; prestation: string;
  prix: string | number; diagnostiqueur: string; duree: string; consignes: string;
}

function pad2(n: number): string { return String(n).padStart(2, '0'); }
function esc(s: any): string {
  return String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));
}

export function rdvPrefill(l: any): RdvPrefill {
  const draft = buildDevisDraftFromLead(l);
  let date = '', time = '';
  if (l.rdv_at) { const d = new Date(l.rdv_at); date = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; time = `${pad2(d.getHours())}:${pad2(d.getMinutes())}`; }
  else if (l.rdv_date) { date = l.rdv_date; }
  return {
    date, time: time || '09:00',
    adresse: l.rdv_adresse || l.adresse || (l.secteur ? 'CP ' + l.secteur : ''),
    prestation: l.prestation || draft.objet || '',
    prix: l.prix_total_ttc != null ? l.prix_total_ttc : (draft.montant || l.estimation || ''),
    diagnostiqueur: l.diagnostiqueur || '',
    duree: l.duree_estimee || '1 h',
    consignes: l.consignes || '',
  };
}

/** Champs du formulaire (HTML pur, mêmes ids partout). Styler avec RDV_FORM_CSS. */
export function renderRdvFormFields(p: RdvPrefill): string {
  return `<div class="rdv-fields">
    <div><label>Date</label><input type="date" id="rdv-date" value="${esc(p.date)}"></div>
    <div><label>Heure</label><input type="time" id="rdv-time" value="${esc(p.time)}"></div>
    <div class="full"><label>Adresse du bien</label><input type="text" id="rdv-adresse" value="${esc(p.adresse)}"></div>
    <div class="full"><label>Prestation</label><input type="text" id="rdv-prestation" value="${esc(p.prestation)}"></div>
    <div><label>Diagnostiqueur</label><input type="text" id="rdv-diag" value="${esc(p.diagnostiqueur)}" placeholder="Nom du diagnostiqueur"></div>
    <div><label>Prix tout compris (€ TTC)</label><input type="number" id="rdv-prix" value="${esc(p.prix)}"></div>
    <div><label>Durée estimée (optionnel)</label><input type="text" id="rdv-duree" value="${esc(p.duree)}"></div>
    <div class="full"><label>Consignes (optionnel)</label><textarea id="rdv-consignes" placeholder="Accès, clés, badge, documents…">${esc(p.consignes)}</textarea></div>
  </div>`;
}

/** Styles du formulaire (tokens du design system). */
export const RDV_FORM_CSS = `
.rdv-fields{display:grid;grid-template-columns:1fr 1fr;gap:12px 14px}
.rdv-fields .full{grid-column:1 / -1}
.rdv-fields label{display:block;font-size:11.5px;font-family:var(--sora);color:var(--ink-soft);margin-bottom:5px;text-transform:uppercase;letter-spacing:.04em}
.rdv-fields input,.rdv-fields textarea{width:100%;border:1.5px solid var(--line);border-radius:9px;padding:9px 11px;font-size:14px;font-family:var(--inter);color:var(--ink);background:#fff}
.rdv-fields input:focus,.rdv-fields textarea:focus{outline:none;border-color:var(--blue-light)}
.rdv-fields textarea{resize:vertical;min-height:64px}
@media (max-width:560px){.rdv-fields{grid-template-columns:1fr}}
`;
