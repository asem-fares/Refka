// Small DOM helpers. All user text goes in through text nodes, never through innerHTML.
import { t, lang } from './i18n.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

/** h('div', {class:'x', onclick:fn}, child, 'text', [more]) */
export function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  if (attrs) for (const k in attrs) {
    const v = attrs[k];
    if (v == null || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k === 'class') el.className = v;
    else if (k === 'value') el.value = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, v);
  }
  add(el, kids);
  return el;
}
function add(el, kids) {
  for (const k of kids) {
    if (k == null || k === false) continue;
    if (Array.isArray(k)) add(el, k);
    else el.appendChild(k instanceof Node ? k : document.createTextNode(String(k)));
  }
}
export function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); return el; }
export function fill(el, ...kids) { clear(el); add(el, kids); return el; }

/** Static line icons (paths are constants in this file, never user data). */
const ICONS = {
  home: 'M3 11l9-8 9 8M5 10v10h14V10',
  users: 'M16 20v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1M9.5 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7M21 20v-1a4 4 0 0 0-3-3.8M15.5 4.2a3.5 3.5 0 0 1 0 6.6',
  scan: 'M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M4 12h16',
  gear: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6M19 12a7 7 0 0 0-.1-1.3l2-1.5-2-3.4-2.3.9a7 7 0 0 0-2.2-1.3L14 3h-4l-.4 2.4a7 7 0 0 0-2.2 1.3l-2.3-.9-2 3.4 2 1.5a7 7 0 0 0 0 2.6l-2 1.5 2 3.4 2.3-.9a7 7 0 0 0 2.2 1.3L10 21h4l.4-2.4a7 7 0 0 0 2.2-1.3l2.3.9 2-3.4-2-1.5c.1-.4.1-.9.1-1.3',
  cash: 'M3 7h18v10H3zM12 14.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5M6 10v4M18 10v4',
  guest: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8M4 21a8 8 0 0 1 12-6.9M19 15v6M16 18h6',
  flag: 'M5 21V4M5 4h11l-2 4 2 4H5',
  post: 'M4 5h16v11H9l-5 4z',
  tag: 'M3 12V4h8l10 10-8 8zM7.5 8.5h.01',
  brush: 'M4 20c3 0 4-1.5 4-3.5S9.5 13 11 13s3 1.2 3 3M10.5 13.5L20 4',
  link: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3A4 4 0 0 0 11 18.7l1-1',
  gym: 'M4 9v6M7 6v12M17 6v12M20 9v6M7 12h10',
  globe: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18M3 12h18M12 3c2.5 2.5 3.5 5.5 3.5 9s-1 6.5-3.5 9c-2.5-2.5-3.5-5.5-3.5-9S9.500 5.500 12 3',
  out: 'M14 4h5v16h-5M10 8l-4 4 4 4M6 12h10',
  check: 'M5 12.5l4.5 4.5L19 7.500',
};
export function icon(name) {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  const p = document.createElementNS(SVG_NS, 'path');
  p.setAttribute('d', ICONS[name] || ICONS.check);
  svg.appendChild(p);
  return svg;
}
export function logoMark() {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 120 104');
  svg.setAttribute('aria-hidden', 'true');
  const mk = (tag, a) => { const e = document.createElementNS(SVG_NS, tag); for (const k in a) e.setAttribute(k, a[k]); return e; };
  const defs = mk('defs', {}), lg = mk('linearGradient', { id: 'rflg', x1: '0', x2: '1' });
  lg.append(mk('stop', { offset: '0', 'stop-color': '#0D6B6E' }), mk('stop', { offset: '1', 'stop-color': '#C9973A' }));
  defs.append(lg);
  svg.append(defs,
    mk('circle', { cx: 38, cy: 22, r: 12, fill: 'url(#rflg)' }), mk('circle', { cx: 82, cy: 22, r: 12, fill: 'url(#rflg)' }),
    mk('path', { d: 'M60,62 C44,32 12,32 12,62 C12,92 44,92 60,62 C76,32 108,32 108,62 C108,92 76,92 60,62', fill: 'none', stroke: 'url(#rflg)', 'stroke-width': 18, 'stroke-linecap': 'round' }));
  return svg;
}

/** QR as an SVG element (qrcode-generator global). Returns null if the library did not load. */
export function qrSvg(text) {
  if (typeof window.qrcode !== 'function') return null;
  try {
    const q = window.qrcode(0, 'M'); q.addData(text); q.make();
    const n = q.getModuleCount(); let d = '';
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (q.isDark(y, x)) d += `M${x} ${y}h1v1h-1z`;
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', `-1 -1 ${n + 2} ${n + 2}`);
    svg.setAttribute('shape-rendering', 'crispEdges');
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', 'QR');
    const p = document.createElementNS(SVG_NS, 'path');
    p.setAttribute('d', d); p.setAttribute('fill', '#111');
    svg.appendChild(p);
    return svg;
  } catch (e) { return null; }
}

// ---------- errors ----------
/** Friendly text for an RfError (or anything thrown). */
export function errText(e) {
  let code = (e && e.code) || 'unknown';
  const raw = e && e.raw && String(e.raw.message || '');
  if (code === 'unknown' && (!navigator.onLine || /fetch|network|load failed/i.test(raw || String(e && e.message)))) code = 'offline';
  const key = 'err_' + code;
  const s = t(key);
  return s === key ? t('err_unknown') : s;
}

// ---------- feedback ----------
/**
 * Run an async action from a button: shows a spinner, blocks double taps,
 * writes a friendly error next to the control. Returns {ok, data} so callers never have a dead end.
 */
export async function run(btn, errEl, fn) {
  if (btn && btn.classList.contains('busy')) return { ok: false };
  if (errEl) errEl.textContent = '';
  let sp;
  if (btn) { btn.classList.add('busy'); btn.setAttribute('aria-busy', 'true'); sp = h('span', { class: 'spin' }); btn.prepend(sp); }
  try {
    return { ok: true, data: await fn() };
  } catch (e) {
    if (!(e && e.code)) console.warn('[owner]', e);
    const msg = (e && e.friendly) || errText(e);
    if (errEl) errEl.textContent = msg; else toast(msg);
    return { ok: false, error: e };
  } finally {
    if (btn) { btn.classList.remove('busy'); btn.removeAttribute('aria-busy'); if (sp) sp.remove(); }
  }
}
/** An error with ready text, for client side checks. */
export function friendly(msg) { const e = new Error(msg); e.friendly = msg; e.code = 'client'; return e; }

let toastTimer;
export function toast(msg) {
  const layer = document.getElementById('layer');
  layer.querySelectorAll('.toast').forEach(x => x.remove());
  const el = h('div', { class: 'toast', role: 'status' }, msg);
  layer.appendChild(el);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.remove(), 2600);
}

/** Bottom sheet. build(close) returns the content nodes. */
export function sheet(build) {
  const layer = document.getElementById('layer');
  const close = () => { wrap.remove(); document.removeEventListener('keydown', onKey); };
  const onKey = e => { if (e.key === 'Escape') close(); };
  const box = h('div', { class: 'box', role: 'dialog', 'aria-modal': 'true' });
  const wrap = h('div', { class: 'sheet', onclick: e => { if (e.target === wrap) close(); } }, box);
  add(box, [build(close)]);
  layer.appendChild(wrap);
  document.addEventListener('keydown', onKey);
  const f = box.querySelector('input,select,textarea,button');
  if (f) f.focus({ preventScroll: true });
  return close;
}
/** Yes / no question. Resolves true or false. */
export function confirmSheet(title, body, yes, danger) {
  return new Promise(res => {
    sheet(close => [
      h('h3', null, title), body ? h('p', { class: 'mini' }, body) : null,
      h('div', { class: 'row' },
        h('button', { class: 'btn ghost', onclick: () => { close(); res(false); } }, t('cancel')),
        h('button', { class: 'btn ' + (danger ? 'danger' : 'primary'), onclick: () => { close(); res(true); } }, yes)),
    ]);
  });
}

// ---------- form bits ----------
export function field(label, input, opts = {}) {
  const id = input.id || (input.id = 'f' + Math.random().toString(36).slice(2, 8));
  const err = h('div', { class: 'err', role: 'alert' });
  const el = h('div', { class: 'field' },
    h('label', { for: id }, label, opts.optional ? h('span', { class: 'optl' }, ' ' + t('optional')) : null),
    opts.wrap || input,
    opts.hint ? h('div', { class: 'hint' }, opts.hint) : null, err);
  el.err = err; el.input = input;
  el.setErr = m => { err.textContent = m || ''; (opts.wrap || input).classList.toggle('bad', !!m); };
  input.addEventListener('input', () => el.setErr(''));
  return el;
}
export function toggle(on, onChange, label) {
  const b = h('button', { type: 'button', class: 'toggle' + (on ? ' on' : ''), role: 'switch', 'aria-checked': String(!!on), 'aria-label': label });
  b.addEventListener('click', () => { const v = !b.classList.contains('on'); b.classList.toggle('on', v); b.setAttribute('aria-checked', String(v)); onChange(v); });
  return b;
}

// ---------- values ----------
const pad = n => String(n).padStart(2, '0');
export const isoOf = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const today = () => isoOf(new Date());
export function addMonths(iso, n) {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1 + n, 1);
  const last = new Date(dt.getFullYear(), dt.getMonth() + 1, 0).getDate();
  dt.setDate(Math.min(d, last));
  return isoOf(dt);
}
export function daysLeft(iso) {
  if (!iso) return null;
  const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number);
  const a = new Date(y, m - 1, d), n = new Date(); n.setHours(0, 0, 0, 0);
  return Math.round((a - n) / 864e5);
}
const loc = () => (lang() === 'ar' ? 'ar-EG-u-nu-latn' : 'en-GB');
export function fmtDate(iso) {
  if (!iso) return '';
  const s = String(iso);
  const d = s.length <= 10 ? new Date(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10)) : new Date(s);
  if (isNaN(d)) return s;
  return new Intl.DateTimeFormat(loc(), { day: 'numeric', month: 'short', year: 'numeric' }).format(d);
}
export function fmtAgo(ts) {
  if (!ts) return '';
  const d = new Date(ts); if (isNaN(d)) return '';
  const min = Math.max(0, Math.round((Date.now() - d) / 6e4));
  if (min < 1) return t('ago_now');
  if (min < 60) return t('ago_min', { n: min });
  const hr = Math.round(min / 60);
  if (hr < 24) return t('ago_hr', { n: hr });
  const dy = Math.round(hr / 24);
  if (dy < 30) return t('ago_day', { n: dy });
  return fmtDate(d.toISOString());
}
export const money = n => t('egp', { n: Number(n || 0).toLocaleString('en-US') });
/** Arabic-Indic and Persian digits to 0-9. */
export const latinDigits = s => String(s == null ? '' : s).replace(/[٠-٩]/g, c => c.charCodeAt(0) - 0x660).replace(/[۰-۹]/g, c => c.charCodeAt(0) - 0x6F0);
/** Pick the right language for a {name, name_ar} thing. */
export const nameOf = o => !o ? '' : (lang() === 'ar' ? (o.name_ar || o.name) : (o.name || o.name_ar)) || '';
export const initial = s => (String(s || '').trim()[0] || 'R').toUpperCase();
export function debounce(fn, ms) { let tm; return (...a) => { clearTimeout(tm); tm = setTimeout(() => fn(...a), ms); }; }
