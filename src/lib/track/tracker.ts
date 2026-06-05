/**
 * Tracker comportemental first-party (Soloris) — PII-safe.
 *
 * DEUX MODES :
 *  1. « anonymous » (par défaut, SANS consentement) — mesure d'audience exemptée
 *     de consentement au sens CNIL : aucune donnée tierce, IP jetée côté serveur,
 *     AUCUN cookie/identifiant persistant (id de session en sessionStorage,
 *     effacé à la fermeture de l'onglet, pas de lien inter-sessions), pas d'UA
 *     stocké. On ne capte que des statistiques d'audience anonymes : pages vues,
 *     temps par page, profondeur de scroll, et étapes du funnel /devis.
 *     PAS de coordonnées de clic (heatmap), PAS de champ par champ, PAS de replay.
 *  2. « full » (APRÈS consentement « Analyse de navigation ») — ajoute clics +
 *     coords (heatmap), rage-clicks, funnel au champ, session replay rrweb, et un
 *     visitor_id persistant (lien lead ↔ comportement). Retrait = purge + retour anonyme.
 *
 * Garde-fous PII : jamais de valeur de champ ; rrweb maskAllInputs ; classe .pii bloquée.
 */

type Consent = { analytics?: boolean; ads?: boolean; behavior?: boolean };
type Ev = { type: string; path: string; element?: string; ts_client: string; meta?: Record<string, unknown> };
type ReplayChunk = { seq: number; events: unknown[]; masked: boolean };

const ENDPOINT = '/api/track';
const SESSION_TIMEOUT_MS = 30 * 60 * 1000;
const FLUSH_INTERVAL_MS = 5000;
const MAX_BATCH = 30;
const SCROLL_THROTTLE_MS = 500;
const VID_TTL_DAYS = 390; // ~13 mois (mode full uniquement)
const REPLAY_CHUNK_MS = 5000;

// ── État ──
let started = false;
let full = false;
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
let bound = false;
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
  try { const raw = getCookie('soloris_acq'); return raw ? JSON.parse(decodeURIComponent(raw)) : {}; }
  catch { return {}; }
}
function deviceClass(): string {
  const w = window.innerWidth || 0;
  if (w <= 640) return 'm';
  if (w <= 1024) return 't';
  return 'c';
}
function now(): string { return new Date().toISOString(); }

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
  if (['a', 'button', 'h1', 'h2', 'h3'].includes(tag) && !el.closest('.pii')) {
    const t = (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 50);
    if (t) sel += ` "${t}"`;
  }
  return sel.slice(0, 280);
}

// ── Identité : full = persistant (cookies) ; anonymous = session, sans cookie ──
function setFullIds() {
  visitorId = getCookie('soloris_vid');
  if (!/^[0-9a-f-]{36}$/i.test(visitorId)) { visitorId = uuid(); setCookie('soloris_vid', visitorId, VID_TTL_DAYS); }
  let raw: any = null;
  try { raw = JSON.parse(localStorage.getItem('soloris_sess') || 'null'); } catch { /* */ }
  const fresh = raw && raw.id && raw.last && (Date.now() - raw.last) < SESSION_TIMEOUT_MS;
  sessionId = fresh ? raw.id : uuid();
  entryPath = (fresh && raw.entry) ? raw.entry : location.pathname;
  persist();
  setCookie('soloris_sid', sessionId, 1); // lien lead ↔ session (formulaire)
}
function setAnonymousIds() {
  // id de session NON persistant (sessionStorage), pas de lien inter-sessions, pas de cookie
  let raw: any = null;
  try { raw = JSON.parse(sessionStorage.getItem('soloris_a_sess') || 'null'); } catch { /* */ }
  sessionId = (raw && raw.id) ? raw.id : uuid();
  entryPath = (raw && raw.entry) ? raw.entry : location.pathname;
  visitorId = sessionId; // anonyme : « visiteur » = session, aucune ré-identification
  persist();
}
function persist() {
  try {
    if (full) localStorage.setItem('soloris_sess', JSON.stringify({ id: sessionId, entry: entryPath, last: Date.now() }));
    else sessionStorage.setItem('soloris_a_sess', JSON.stringify({ id: sessionId, entry: entryPath }));
  } catch { /* */ }
}
function clearFullStorage() {
  try { localStorage.removeItem('soloris_sess'); } catch { /* */ }
  delCookie('soloris_sid'); delCookie('soloris_vid');
}

// ── File d'events ──
function push(type: string, element?: string, meta?: Record<string, unknown>) {
  if (!started) return;
  queue.push({ type, path: location.pathname, element, ts_client: now(), meta });
  persist();
  if (queue.length >= MAX_BATCH) flush(false);
}

function sessionMeta(): Record<string, unknown> {
  const a = getAcq();
  return {
    id: sessionId, visitor_id: visitorId, entry_path: entryPath, exit_path: location.pathname,
    device: deviceClass(), viewport_w: window.innerWidth, viewport_h: window.innerHeight,
    utm_source: a.utm_source || '', utm_medium: a.utm_medium || '', utm_campaign: a.utm_campaign || '',
    utm_term: a.utm_term || '', utm_content: a.utm_content || '',
    gclid: a.gclid || '', fbclid: a.fbclid || '',
    referrer: a.referrer || (document.referrer || ''),
    referrer_host: (() => { try { return document.referrer ? new URL(document.referrer).host : ''; } catch { return ''; } })(),
    consent_state: full ? (consent.ads ? 'behavior+ads' : 'behavior') : 'exempt',
    duration_s: Math.round((Date.now() - pageStart) / 1000),
  };
}

function flush(useBeacon: boolean) {
  if (!started) return;
  if (!queue.length && !replayQueue.length) return;
  const body = { session: sessionMeta(), events: queue, replay: replayQueue, page_views: pageViews };
  queue = []; replayQueue = []; pageViews = 0;
  const json = JSON.stringify(body);
  try {
    if (useBeacon && navigator.sendBeacon) { navigator.sendBeacon(ENDPOINT, new Blob([json], { type: 'application/json' })); return; }
  } catch { /* */ }
  fetch(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: json, keepalive: true }).catch(() => {});
}

// ── Captation ──
function onScroll() {
  const doc = document.documentElement;
  const scrollable = (doc.scrollHeight - window.innerHeight) || 1;
  const depth = Math.min(100, Math.round((window.scrollY / scrollable) * 100));
  if (depth > maxScroll) maxScroll = depth;
  for (const m of [25, 50, 75, 100]) {
    if (maxScroll >= m && !scrollMilestones.has(m)) { scrollMilestones.add(m); push('scroll', undefined, { scroll_depth: m }); }
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

// Clics + coords (heatmap) + rage-click : FULL uniquement (nécessite consentement)
function onClick(e: MouseEvent) {
  if (!started || !full) return;
  const el = e.target as Element | null;
  const docH = document.documentElement.scrollHeight || 1;
  const docW = document.documentElement.scrollWidth || 1;
  const xRel = Math.round(((e.pageX || 0) / docW) * 1000) / 1000;
  const yRel = Math.round(((e.pageY || 0) / docH) * 1000) / 1000;
  push('click', describeEl(el), { x_rel: xRel, y_rel: yRel, viewport: deviceClass() });
  const t = Date.now();
  recentClicks.push({ x: e.clientX, y: e.clientY, t });
  while (recentClicks.length && t - recentClicks[0].t > 800) recentClicks.shift();
  if (recentClicks.length >= 3) {
    const near = recentClicks.filter((c) => Math.hypot(c.x - e.clientX, c.y - e.clientY) < 35);
    if (near.length >= 3) { push('rage_click', describeEl(el), { x_rel: xRel, y_rel: yRel }); recentClicks.length = 0; }
  }
}

// Champ par champ : FULL uniquement (métadonnées only, jamais de valeur)
function fieldName(el: Element): string { return (el.getAttribute('name') || (el as HTMLElement).id || '').slice(0, 60); }
function fieldFilled(el: Element): boolean {
  const t = (el as HTMLInputElement).type;
  if (t === 'checkbox' || t === 'radio') return (el as HTMLInputElement).checked;
  return !!((el as HTMLInputElement).value || '').trim();
}
function isField(el: Element | null): el is HTMLElement {
  return !!el && ['INPUT', 'SELECT', 'TEXTAREA'].includes(el.tagName) && !!el.closest('form');
}
function onFocusIn(e: FocusEvent) {
  if (!started || !full) return;
  const el = e.target as Element; if (!isField(el)) return;
  formStarted = true; lastTouchedField = fieldName(el);
  push('field_focus', undefined, { field_name: lastTouchedField, filled: fieldFilled(el) });
}
function onFocusOut(e: FocusEvent) {
  if (!started || !full) return;
  const el = e.target as Element; if (!isField(el)) return;
  const val = (el as HTMLInputElement).value || '';
  push('field_blur', undefined, { field_name: fieldName(el), filled: fieldFilled(el), len: val.length });
}
function onChange(e: Event) {
  if (!started || !full) return;
  const el = e.target as Element; if (!isField(el)) return;
  lastTouchedField = fieldName(el);
  push('field_change', undefined, { field_name: lastTouchedField, filled: fieldFilled(el) });
}
function onSubmit() {
  if (!started) return;
  formSubmitted = true;
  push('form_submit', undefined, full ? { last_field: lastTouchedField } : {});
  flush(false);
}

// Funnel /devis : étapes (anonyme OK) ; le « dernier champ » reste full uniquement
function setupDevisStepObserver() {
  if (!location.pathname.startsWith('/devis')) return;
  const form = document.getElementById('quote-form'); if (!form) return;
  let lastStep = '';
  const emitStep = () => {
    const visible = form.querySelector('.qstep:not([hidden])') as HTMLElement | null;
    const step = visible ? (visible.getAttribute('data-step') || '') : '';
    if (step && step !== lastStep) { lastStep = step; push('form_step', undefined, { step_index: Number(step) }); }
  };
  emitStep();
  const mo = new MutationObserver(emitStep);
  form.querySelectorAll('.qstep').forEach((s) => mo.observe(s, { attributes: true, attributeFilter: ['hidden'] }));
}
function setupFormView() {
  const form = document.querySelector('form#quote-form, form#contact-form, form'); if (!form) return;
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting && !formViewed) {
          formViewed = true; push('form_view', describeEl(form), { form_id: (form as HTMLElement).id || '' }); io.disconnect();
        }
      });
    }, { threshold: 0.4 });
    io.observe(form);
  } else { formViewed = true; push('form_view'); }
}

function getDevisStep(): number | null {
  const visible = document.querySelector('#quote-form .qstep:not([hidden])') as HTMLElement | null;
  return visible ? Number(visible.getAttribute('data-step')) : null;
}
function emitPageView() {
  pageViews += 1; pageStart = Date.now(); maxScroll = 0; scrollMilestones.clear();
  push('page_view', undefined, { title: document.title ? document.title.slice(0, 120) : '' });
}
function emitPageLeave(useBeacon: boolean) {
  push('page_leave', undefined, { time_on_page_s: Math.round((Date.now() - pageStart) / 1000), max_scroll: maxScroll });
  if ((formViewed || formStarted) && !formSubmitted) {
    const meta: Record<string, unknown> = { step: getDevisStep() };
    if (full) meta.last_field = lastTouchedField;
    push('form_abandon', undefined, meta);
  }
  flush(useBeacon);
}

// ── Session replay (rrweb) — FULL uniquement ──
async function startReplay() {
  if (stopReplay || !full || !consent.behavior) return;
  try {
    const rr = await import('rrweb');
    const record = (rr as any).record;
    stopReplay = record({
      emit(event: unknown) {
        replayBuffer.push(event);
        if (!replayTimer) replayTimer = window.setTimeout(flushReplayBuffer, REPLAY_CHUNK_MS);
        if (replayBuffer.length >= 50) flushReplayBuffer();
      },
      maskAllInputs: true, maskTextClass: 'pii', blockClass: 'pii',
      maskInputOptions: { password: true, email: true, tel: true, text: true },
      recordCanvas: false, collectFonts: false,
      sampling: { mousemove: 50, scroll: 150, input: 'last' },
    }) || null;
  } catch { /* */ }
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
  stopReplay = null; flushReplayBuffer();
}

// ── Liaisons (posées UNE fois ; les handlers se filtrent selon started/full) ──
function bindOnce() {
  if (bound) return; bound = true;
  window.addEventListener('scroll', throttle(onScroll, SCROLL_THROTTLE_MS), { passive: true });
  document.addEventListener('click', onClick, true);
  document.addEventListener('focusin', onFocusIn, true);
  document.addEventListener('focusout', onFocusOut, true);
  document.addEventListener('change', onChange, true);
  document.addEventListener('submit', onSubmit, true);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') emitPageLeave(true); });
  window.addEventListener('pagehide', () => { stopReplayRecording(); emitPageLeave(true); });
  document.addEventListener('astro:page-load', () => { if (started) { emitPageView(); setupPage(); } });
}
function setupPage() {
  formViewed = false; formStarted = false; formSubmitted = false; lastTouchedField = '';
  setupFormView();
  setupDevisStepObserver();
}

// ── Démarrage / transitions de mode ──
function startSession(asFull: boolean) {
  full = asFull;
  if (full) setFullIds(); else setAnonymousIds();
  started = true;
  pageStart = Date.now();
  emitPageView();
  setupPage();
  if (!flushTimer) flushTimer = window.setInterval(() => flush(false), FLUSH_INTERVAL_MS);
  if (full) startReplay();
}
function upgradeToFull() {
  flush(false);          // on envoie les events anonymes en attente sous l'id anonyme
  full = true;
  setFullIds();          // ids persistants + cookies (lien lead)
  emitPageView();        // la session « consentie » démarre proprement
  setupPage();
  startReplay();
}
function downgradeToAnonymous() {
  const vid = visitorId; // visiteur consenti à purger
  stopReplayRecording();
  flush(false);
  try {
    const body = JSON.stringify({ action: 'purge', visitor_id: vid });
    if (navigator.sendBeacon) navigator.sendBeacon(ENDPOINT, new Blob([body], { type: 'application/json' }));
    else fetch(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true }).catch(() => {});
  } catch { /* */ }
  clearFullStorage();
  full = false;
  setAnonymousIds();     // bascule en mesure anonyme exemptée
  emitPageView();
}

/** Applique l'état de consentement (bandeau CNIL). Mesure anonyme toujours active. */
function apply(c: Consent) {
  consent = c || {};
  const wantFull = !!consent.behavior;
  if (!started) startSession(wantFull);
  else if (wantFull && !full) upgradeToFull();
  else if (!wantFull && full) downgradeToAnonymous();
}

function readStoredConsent(): Consent {
  try { return JSON.parse(localStorage.getItem('soloris_consent') || 'null') || {}; } catch { return {}; }
}

export function initBehaviorTracking() {
  if ((window as any).solorisBehavior) return;
  (window as any).solorisBehavior = { apply, isOn: () => started, isFull: () => full };
  bindOnce();
  window.addEventListener('soloris-consent', (e: Event) => apply((e as CustomEvent).detail || {}));
  // Démarre immédiatement : mesure anonyme (exemptée) si pas de consentement, full sinon.
  apply(readStoredConsent());
}
