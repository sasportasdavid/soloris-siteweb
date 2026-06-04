/**
 * Tracker comportemental first-party (Soloris) — PII-safe, consent-gated.
 *
 * Démarre UNIQUEMENT après consentement « Analyse de navigation » (catégorie
 * `behavior` du bandeau CNIL). Tant que ce consentement n'est pas accordé :
 * aucun event, aucun replay, aucune écriture.
 *
 * Garde-fous RGPD/CNIL :
 *  - Jamais de valeur de champ (telephone/email/nom/adresse…) : on ne capte que
 *    des MÉTADONNÉES (nom du champ, rempli/vide, longueur, focus/blur).
 *  - rrweb en `maskAllInputs:true` + masquage des éléments `.pii`.
 *  - `visitor_id` (first-party) et `session_id` (30 min) générés localement ;
 *    l'IP n'est jamais lue ici (géo grossière dérivée côté serveur, IP jetée).
 *  - Retrait du consentement → arrêt immédiat + purge de la session (RPC serveur).
 *
 * Perf : envoi par batch (sendBeacon / fetch keepalive), scroll throttlé,
 * rrweb chargé en chunk séparé (dynamic import) seulement si replay consenti.
 */

type Consent = { analytics?: boolean; ads?: boolean; behavior?: boolean };
type Ev = { type: string; path: string; element?: string; ts_client: string; meta?: Record<string, unknown> };
type ReplayChunk = { seq: number; events: unknown[]; masked: boolean };

const ENDPOINT = '/api/track';
const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 min d'inactivité
const FLUSH_INTERVAL_MS = 5000;
const MAX_BATCH = 30;
const SCROLL_THROTTLE_MS = 500;
const VID_TTL_DAYS = 390; // ~13 mois (aligné sur la rétention)
const REPLAY_CHUNK_MS = 5000;

const FUNNEL_TYPES = new Set([
  'form_view', 'field_focus', 'field_blur', 'field_change', 'form_step', 'form_submit', 'form_abandon',
]);

// ── État module ──
let started = false;
let consent: Consent = {};
let sessionId = '';
let visitorId = '';
let entryPath = '';
let queue: Ev[] = [];
let replayQueue: ReplayChunk[] = [];
let pageViews = 0;
let pageStart = Date.now();
let maxScroll = 0;
const scrollMilestones = new Set<number>();
let lastTouchedField = '';
let formViewed = false;
let formStarted = false;
let formSubmitted = false;
let flushTimer: number | null = null;
let stopReplay: (() => void) | null = null;
let replaySeq = 0;
let replayBuffer: unknown[] = [];
let replayTimer: number | null = null;
const recentClicks: { x: number; y: number; t: number }[] = [];

// ── Utilitaires ──
function uuid(): string {
  try { if (window.crypto && crypto.randomUUID) return crypto.randomUUID(); } catch { /* */ }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0; return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}
function getCookie(name: string): string {
  const m = document.cookie.split('; ').find((c) => c.indexOf(name + '=') === 0);
  return m ? m.split('=').slice(1).join('=') : '';
}
function setCookie(name: string, value: string, days: number) {
  const d = new Date(); d.setTime(d.getTime() + days * 864e5);
  document.cookie = `${name}=${value}; expires=${d.toUTCString()}; path=/; SameSite=Lax`;
}
function delCookie(name: string) {
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; SameSite=Lax`;
}
function getAcq(): Record<string, string> {
  try {
    const raw = getCookie('soloris_acq');
    return raw ? JSON.parse(decodeURIComponent(raw)) : {};
  } catch { return {}; }
}
function deviceClass(): string {
  const w = window.innerWidth || 0;
  if (w <= 640) return 'm';
  if (w <= 1024) return 't';
  return 'c';
}
function now(): string { return new Date().toISOString(); }

/** Sélecteur court + texte non-PII (jamais de valeur de champ). */
function describeEl(el: Element | null): string {
  if (!el) return '';
  const tag = el.tagName ? el.tagName.toLowerCase() : '';
  let sel = tag;
  if ((el as HTMLElement).id) sel += '#' + (el as HTMLElement).id;
  const cls = (el.getAttribute && el.getAttribute('class')) || '';
  const first = cls.split(/\s+/).filter(Boolean)[0];
  if (first && first !== 'pii') sel += '.' + first;
  const dt = el.getAttribute && (el.getAttribute('data-track') || el.getAttribute('aria-label'));
  if (dt) sel += `[${dt.slice(0, 40)}]`;
  // Texte seulement pour les éléments à faible risque PII (liens, boutons, titres)
  if (['a', 'button', 'h1', 'h2', 'h3'].includes(tag) && !el.closest('.pii')) {
    const t = (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 50);
    if (t) sel += ` "${t}"`;
  }
  return sel.slice(0, 280);
}

// ── Identité ──
function ensureVisitor() {
  visitorId = getCookie('soloris_vid');
  if (!/^[0-9a-f-]{36}$/i.test(visitorId)) {
    visitorId = uuid();
    setCookie('soloris_vid', visitorId, VID_TTL_DAYS);
  }
}
function ensureSession() {
  let raw: any = null;
  try { raw = JSON.parse(localStorage.getItem('soloris_sess') || 'null'); } catch { /* */ }
  const fresh = raw && raw.id && raw.last && (Date.now() - raw.last) < SESSION_TIMEOUT_MS;
  if (fresh) {
    sessionId = raw.id; entryPath = raw.entry || location.pathname;
  } else {
    sessionId = uuid(); entryPath = location.pathname;
  }
  persistSession();
  setCookie('soloris_sid', sessionId, 1); // lisible par le formulaire pour relier lead ↔ session
}
function persistSession() {
  try {
    localStorage.setItem('soloris_sess', JSON.stringify({ id: sessionId, entry: entryPath, last: Date.now() }));
  } catch { /* */ }
}

// ── File d'events ──
function push(type: string, element?: string, meta?: Record<string, unknown>) {
  if (!started) return;
  queue.push({ type, path: location.pathname, element, ts_client: now(), meta });
  persistSession();
  if (queue.length >= MAX_BATCH) flush(false);
}

function sessionMeta(): Record<string, unknown> {
  const a = getAcq();
  return {
    id: sessionId,
    visitor_id: visitorId,
    entry_path: entryPath,
    exit_path: location.pathname,
    device: deviceClass(),
    viewport_w: window.innerWidth,
    viewport_h: window.innerHeight,
    utm_source: a.utm_source || '', utm_medium: a.utm_medium || '', utm_campaign: a.utm_campaign || '',
    utm_term: a.utm_term || '', utm_content: a.utm_content || '',
    gclid: a.gclid || '', fbclid: a.fbclid || '',
    referrer: a.referrer || (document.referrer || ''),
    referrer_host: (() => { try { return document.referrer ? new URL(document.referrer).host : ''; } catch { return ''; } })(),
    consent_state: consent.behavior ? (consent.ads ? 'behavior+ads' : 'behavior') : 'none',
    duration_s: Math.round((Date.now() - pageStart) / 1000),
  };
}

function flush(useBeacon: boolean) {
  if (!started) return;
  if (!queue.length && !replayQueue.length) return;
  const body = {
    session: sessionMeta(),
    events: queue,
    replay: replayQueue,
    page_views: pageViews,
  };
  queue = []; replayQueue = []; pageViews = 0;
  const json = JSON.stringify(body);
  try {
    if (useBeacon && navigator.sendBeacon) {
      navigator.sendBeacon(ENDPOINT, new Blob([json], { type: 'application/json' }));
      return;
    }
  } catch { /* repli fetch */ }
  fetch(ENDPOINT, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: json, keepalive: true,
  }).catch(() => { /* perte tolérée : analytics non critique */ });
}

// ── Captation quantitative ──
function onScroll() {
  const doc = document.documentElement;
  const scrollable = (doc.scrollHeight - window.innerHeight) || 1;
  const depth = Math.min(100, Math.round((window.scrollY / scrollable) * 100));
  if (depth > maxScroll) maxScroll = depth;
  for (const m of [25, 50, 75, 100]) {
    if (maxScroll >= m && !scrollMilestones.has(m)) {
      scrollMilestones.add(m);
      push('scroll', undefined, { scroll_depth: m });
    }
  }
}
function throttle<T extends (...a: any[]) => void>(fn: T, ms: number): T {
  let last = 0; let pending: any = null;
  return function (this: any, ...args: any[]) {
    const t = Date.now();
    if (t - last >= ms) { last = t; fn.apply(this, args); }
    else { clearTimeout(pending); pending = setTimeout(() => { last = Date.now(); fn.apply(this, args); }, ms); }
  } as T;
}

function onClick(e: MouseEvent) {
  const el = e.target as Element | null;
  const docH = document.documentElement.scrollHeight || 1;
  const docW = document.documentElement.scrollWidth || 1;
  const xRel = Math.round(((e.pageX || 0) / docW) * 1000) / 1000;
  const yRel = Math.round(((e.pageY || 0) / docH) * 1000) / 1000;
  push('click', describeEl(el), { x_rel: xRel, y_rel: yRel, viewport: deviceClass() });

  // Rage-click : ≥3 clics rapprochés dans un petit rayon
  const t = Date.now();
  recentClicks.push({ x: e.clientX, y: e.clientY, t });
  while (recentClicks.length && t - recentClicks[0].t > 800) recentClicks.shift();
  if (recentClicks.length >= 3) {
    const near = recentClicks.filter((c) => Math.hypot(c.x - e.clientX, c.y - e.clientY) < 35);
    if (near.length >= 3) {
      push('rage_click', describeEl(el), { x_rel: xRel, y_rel: yRel });
      recentClicks.length = 0;
    }
  }
}

// ── Funnel formulaire (métadonnées uniquement) ──
function fieldName(el: Element): string {
  return (el.getAttribute('name') || (el as HTMLElement).id || '').slice(0, 60);
}
function fieldFilled(el: Element): boolean {
  const t = (el as HTMLInputElement).type;
  if (t === 'checkbox' || t === 'radio') return (el as HTMLInputElement).checked;
  return !!((el as HTMLInputElement).value || '').trim();
}
function isField(el: Element | null): el is HTMLElement {
  return !!el && ['INPUT', 'SELECT', 'TEXTAREA'].includes(el.tagName) && !!el.closest('form');
}
function onFocusIn(e: FocusEvent) {
  const el = e.target as Element;
  if (!isField(el)) return;
  formStarted = true;
  const name = fieldName(el);
  lastTouchedField = name;
  push('field_focus', undefined, { field_name: name, filled: fieldFilled(el) });
}
function onFocusOut(e: FocusEvent) {
  const el = e.target as Element;
  if (!isField(el)) return;
  const name = fieldName(el);
  const val = (el as HTMLInputElement).value || '';
  push('field_blur', undefined, { field_name: name, filled: fieldFilled(el), len: val.length });
}
function onChange(e: Event) {
  const el = e.target as Element;
  if (!isField(el)) return;
  const name = fieldName(el);
  lastTouchedField = name;
  push('field_change', undefined, { field_name: name, filled: fieldFilled(el) });
}
function onSubmit() {
  formSubmitted = true;
  push('form_submit', undefined, { last_field: lastTouchedField });
  flush(false);
}

/** Détecte le passage d'étape du funnel /devis (fieldsets `.qstep[data-step]`). */
function setupDevisStepObserver() {
  if (!location.pathname.startsWith('/devis')) return;
  const form = document.getElementById('quote-form');
  if (!form) return;
  let lastStep = '';
  const emitStep = () => {
    const visible = form.querySelector('.qstep:not([hidden])') as HTMLElement | null;
    const step = visible ? (visible.getAttribute('data-step') || '') : '';
    if (step && step !== lastStep) {
      lastStep = step;
      push('form_step', undefined, { step_index: Number(step) });
    }
  };
  emitStep();
  const mo = new MutationObserver(emitStep);
  form.querySelectorAll('.qstep').forEach((s) => mo.observe(s, { attributes: true, attributeFilter: ['hidden'] }));
}

function setupFormView() {
  const form = document.querySelector('form#quote-form, form#contact-form, form');
  if (!form) return;
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting && !formViewed) {
          formViewed = true;
          push('form_view', describeEl(form), { form_id: (form as HTMLElement).id || '' });
          io.disconnect();
        }
      });
    }, { threshold: 0.4 });
    io.observe(form);
  } else { formViewed = true; push('form_view'); }
}

// ── page_view / page_leave ──
function emitPageView() {
  pageViews += 1;
  pageStart = Date.now();
  maxScroll = 0; scrollMilestones.clear();
  push('page_view', undefined, { title: document.title ? document.title.slice(0, 120) : '' });
}
function emitPageLeave(useBeacon: boolean) {
  push('page_leave', undefined, { time_on_page_s: Math.round((Date.now() - pageStart) / 1000), max_scroll: maxScroll });
  // Abandon de formulaire : vu/commencé mais non soumis
  if ((formViewed || formStarted) && !formSubmitted) {
    push('form_abandon', undefined, { last_field: lastTouchedField, step: getDevisStep() });
  }
  flush(useBeacon);
}
function getDevisStep(): number | null {
  const visible = document.querySelector('#quote-form .qstep:not([hidden])') as HTMLElement | null;
  return visible ? Number(visible.getAttribute('data-step')) : null;
}

// ── Session replay (rrweb) — chargé seulement si replay consenti ──
async function startReplay() {
  if (stopReplay || !consent.behavior) return;
  try {
    const rr = await import('rrweb');
    const record = (rr as any).record;
    stopReplay = record({
      emit(event: unknown) {
        replayBuffer.push(event);
        if (!replayTimer) replayTimer = window.setTimeout(flushReplayBuffer, REPLAY_CHUNK_MS);
        if (replayBuffer.length >= 50) flushReplayBuffer();
      },
      maskAllInputs: true,            // aucune valeur de champ
      maskTextClass: 'pii',           // textes marqués .pii masqués
      blockClass: 'pii',              // éléments .pii non enregistrés
      maskInputOptions: { password: true, email: true, tel: true, text: true },
      recordCanvas: false,
      collectFonts: false,
      sampling: { mousemove: 50, scroll: 150, input: 'last' },
    }) || null;
  } catch (e) { /* rrweb indispo : on continue en quantitatif seul */ }
}
function flushReplayBuffer() {
  if (replayTimer) { clearTimeout(replayTimer); replayTimer = null; }
  if (!replayBuffer.length) return;
  replayQueue.push({ seq: replaySeq++, events: replayBuffer, masked: true });
  replayBuffer = [];
  if (replayQueue.length >= 5) flush(false);
}
function stopReplayRecording() {
  try { if (stopReplay) stopReplay(); } catch { /* */ }
  stopReplay = null;
  flushReplayBuffer();
}

// ── Cycle de vie ──
function bind() {
  window.addEventListener('scroll', throttle(onScroll, SCROLL_THROTTLE_MS), { passive: true });
  document.addEventListener('click', onClick, true);
  document.addEventListener('focusin', onFocusIn, true);
  document.addEventListener('focusout', onFocusOut, true);
  document.addEventListener('change', onChange, true);
  document.addEventListener('submit', onSubmit, true);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') { emitPageLeave(true); }
  });
  window.addEventListener('pagehide', () => { stopReplayRecording(); emitPageLeave(true); });
  // Astro MPA : un page_view par chargement. Support SPA si ClientRouter activé plus tard.
  document.addEventListener('astro:page-load', () => { emitPageView(); setupPage(); });
}

function setupPage() {
  formViewed = false; formStarted = false; formSubmitted = false; lastTouchedField = '';
  setupFormView();
  setupDevisStepObserver();
}

function start() {
  if (started || !consent.behavior) return;
  started = true;
  ensureVisitor();
  ensureSession();
  pageStart = Date.now();
  emitPageView();
  setupPage();
  bind();
  flushTimer = window.setInterval(() => flush(false), FLUSH_INTERVAL_MS);
  startReplay();
}

/** Retrait du consentement : stop + purge serveur de la session du visiteur. */
function purgeAndStop() {
  const vid = visitorId || getCookie('soloris_vid');
  stopReplayRecording();
  started = false;
  queue = []; replayQueue = []; replayBuffer = [];
  if (flushTimer) { clearInterval(flushTimer); flushTimer = null; }
  try {
    if (vid && navigator.sendBeacon) {
      navigator.sendBeacon(ENDPOINT, new Blob([JSON.stringify({ action: 'purge', visitor_id: vid })], { type: 'application/json' }));
    } else if (vid) {
      fetch(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'purge', visitor_id: vid }), keepalive: true }).catch(() => {});
    }
  } catch { /* */ }
  try { localStorage.removeItem('soloris_sess'); } catch { /* */ }
  delCookie('soloris_sid');
  delCookie('soloris_vid');
}

/** Applique un état de consentement (appelé par le bandeau CNIL). */
function apply(c: Consent) {
  const was = !!consent.behavior;
  consent = c || {};
  if (consent.behavior && !was) start();
  else if (!consent.behavior && was) purgeAndStop();
}

function readStoredConsent(): Consent {
  try { return JSON.parse(localStorage.getItem('soloris_consent') || 'null') || {}; } catch { return {}; }
}

export function initBehaviorTracking() {
  if ((window as any).solorisBehavior) return;
  (window as any).solorisBehavior = { apply, isOn: () => started };
  // Le bandeau émet `soloris-consent` ; on lit aussi l'état déjà mémorisé.
  window.addEventListener('soloris-consent', (e: Event) => apply((e as CustomEvent).detail || {}));
  apply(readStoredConsent());
}
