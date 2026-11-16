// DOM helpers. Rule: data from people or the server only ever enters the page as text nodes or
// vetted attributes. innerHTML is used for the static icon set below and nothing else.
import { t, errText, errCode } from './i18n.js';

export function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  if (props) {
    for (const k in props) {
      const v = props[k];
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else if (k === 'value') el.value = v;
      else if (k === 'style' && typeof v === 'object') { for (const s in v) el.style.setProperty(s, v[s]); }
      else if (v === true) el.setAttribute(k, '');
      else el.setAttribute(k, String(v));
    }
  }
  add(el, kids);
  return el;
}
export function add(el, kids) {
  for (const k of kids) {
    if (k == null || k === false || k === true) continue;
    if (Array.isArray(k)) add(el, k);
    else if (k instanceof Node) el.appendChild(k);
    else el.appendChild(document.createTextNode(String(k)));
  }
  return el;
}
export function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); return el; }
export function fill(el, ...kids) { clear(el); return add(el, kids); }

const ic = {
  back: '<path d="M15 18l-6-6 6-6"/>', chev: '<path d="M9 18l6-6-6-6"/>', home: '<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/>',
  refka: '<circle cx="9" cy="8" r="3.2"/><circle cx="16.5" cy="9" r="2.6"/><path d="M3 20c.6-3.4 3-5.5 6-5.5s5.4 2.1 6 5.5"/><path d="M14.5 14.8c2.9-.6 5.6 1.2 6.3 4.7"/>',
  gym: '<path d="M3 21h18M5 21V8l7-5 7 5v13"/><path d="M9 21v-6h6v6"/>', me: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4.5-6 8-6s7 2 8 6"/>',
  qr: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3h-3zM20 14v.01M14 20h.01M17 20h4v-3"/>',
  check: '<path d="M5 12l5 5L20 7"/>', plus: '<path d="M12 5v14M5 12h14"/>', x: '<path d="M6 6l12 12M18 6L6 18"/>',
  lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 018 0v4"/>',
  cal: '<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M8 2v4M16 2v4"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7v.01"/>', chat: '<path d="M4 5h16v11H8l-4 4z"/>',
  shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18"/>',
  receipt: '<path d="M6 2h12v20l-3-2-3 2-3-2-3 2z"/><path d="M9 7h6M9 11h6M9 15h4"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2 21c.7-4 3.6-6 7-6s6.3 2 7 6"/><path d="M16 4.5a3.5 3.5 0 010 7M18 15c2 .8 3.4 2.8 4 6"/>',
  flame: '<path d="M12 22c4 0 7-3 7-7 0-5-5-7-5-12-3 2-5 5-5 8-1-1-2-2-2-4-2 2-2 5-2 8 0 4 3 7 7 7z"/>',
  dots: '<circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>', send: '<path d="M4 12l16-8-6 16-3-7z"/>',
  photo: '<rect x="3" y="5" width="18" height="15" rx="2"/><circle cx="12" cy="12.5" r="3.5"/><path d="M8 5l1.5-2h5L16 5"/>',
  out: '<path d="M10 4H5v16h5"/><path d="M14 8l4 4-4 4M18 12H9"/>', flag: '<path d="M5 21V4h11l-1.5 4L16 12H5"/>',
  ban: '<circle cx="12" cy="12" r="9"/><path d="M5.6 5.6l12.8 12.8"/>', trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>', search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
  link: '<path d="M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1"/>',
  refresh: '<path d="M20 11a8 8 0 10-2.3 6.3"/><path d="M20 4v7h-7"/>',
};
export function icon(name, size = 18) {
  const tp = document.createElement('template');
  tp.innerHTML = `<svg width="${Number(size)}" height="${Number(size)}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ic[name] || ''}</svg>`;
  return tp.content.firstChild;
}

/* ---------- colors + gym theme ---------- */
const hexOk = s => typeof s === 'string' && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(s.trim());
const hex6 = s => { s = s.trim().replace('#', ''); return '#' + (s.length === 3 ? s.split('').map(c => c + c).join('') : s).toLowerCase(); };
const rgb = x => [0, 2, 4].map(i => parseInt(x.slice(1).substr(i, 2), 16));
const lum = x => { const [r, g, b] = rgb(x).map(v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }); return .2126 * r + .7152 * g + .0722 * b; };
const mix = (a, b, p) => { const A = rgb(a), B = rgb(b); return '#' + A.map((v, i) => Math.round(v * (1 - p) + B[i] * p).toString(16).padStart(2, '0')).join(''); };
const contrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
let brandNow = null;
const darkMq = window.matchMedia('(prefers-color-scheme: dark)');
export function applyGym(brand) {
  brandNow = brand || brandNow || {};
  const p = hexOk(brandNow.primary) ? hex6(brandNow.primary) : '#0d6b6e';
  const a = hexOk(brandNow.accent) ? hex6(brandNow.accent) : '#c9973a';
  const dark = darkMq.matches;
  const bg = dark ? '#0b0b0c' : '#f7f7f5';
  // the primary used as text or icons has to stay readable on the page background
  let gt = p, i = 0;
  while (contrast(gt, bg) < 4.5 && i++ < 12) gt = mix(gt, dark ? '#ffffff' : '#000000', .15);
  const st = document.documentElement.style;
  st.setProperty('--g', p); st.setProperty('--g2', a); st.setProperty('--gt', gt);
  st.setProperty('--gon', contrast(p, '#ffffff') >= contrast(p, '#111111') ? '#fff' : '#111');
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', bg);
}
darkMq.addEventListener('change', () => applyGym());

// Only raster data URLs and https images are ever put into an <img>.
export const safeImg = s => (typeof s === 'string' && (/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(s) || /^https:\/\/[^\s"'<>]+$/.test(s)) ? s : null);

export function gymLogo(gym, cls) {
  const box = h('span', { class: 'lg ' + (cls || '') });
  const src = safeImg(gym && gym.brand && gym.brand.logo);
  const name = (gym && (gym.name || gym.name_ar)) || 'R';
  if (src) {
    const img = h('img', { src, alt: '' });
    img.addEventListener('error', () => { fill(box, firstLetter(name)); });
    box.appendChild(img);
  } else box.textContent = firstLetter(name);
  return box;
}
const firstLetter = s => Array.from(String(s || '?').trim())[0].toUpperCase();
function initials(s) {
  const w = String(s || '?').trim().split(/\s+/).filter(Boolean);
  return (w.length ? w : ['?']).slice(0, 2).map(x => Array.from(x)[0]).join(document.documentElement.lang === 'ar' ? ' ' : '').toUpperCase();
}
const AVC = ['#3B6EA8', '#8A5A9E', '#2F8F6B', '#B5653A', '#A8455B', '#5B6770', '#7A6A2E', '#3F7F8C'];
export function avatar(p, size = 44) {
  const key = String((p && (p.user_id || p.name)) || '');
  let n = 0; for (let i = 0; i < key.length; i++) n = (n * 31 + key.charCodeAt(i)) >>> 0;
  const el = h('span', { class: 'av', 'aria-hidden': 'true', style: { width: size + 'px', height: size + 'px', background: AVC[n % AVC.length], 'font-size': Math.round(size * .36) + 'px' } });
  const src = safeImg(p && p.avatar);
  if (src) el.appendChild(h('img', { src, alt: '' })); else el.textContent = initials(p && p.name);
  return el;
}

/* ---------- small components ---------- */
export const btn = (label, onclick, cls = '', props) => h('button', { type: 'button', class: 'btn ' + cls, onclick, ...(props || {}) }, label);
export const tag = (label, cls = '') => h('span', { class: 'tag ' + cls }, label);
export const note = (text, ic2 = 'info') => h('div', { class: 'note' }, icon(ic2, 14), h('span', null, text));
export const gate = (text, ic2 = 'lock') => h('div', { class: 'gate' }, icon(ic2, 16), h('span', null, text));
export const empty = text => h('div', { class: 'card mu' }, text);
export const loading = () => h('div', { class: 'loading', role: 'status' }, h('span', { class: 'spin' }), h('span', null, t('loading')));
export function chips(items, isOn, onPick, props) {
  // items: [[value, label]]; returns a group whose buttons carry aria-pressed
  const wrap = h('div', { class: 'chips', role: 'group', ...(props || {}) });
  const paint = () => { for (const b of wrap.children) { const on = isOn(b.dataset.v); b.classList.toggle('on', on); b.setAttribute('aria-pressed', on ? 'true' : 'false'); } };
  for (const [v, lab] of items) wrap.appendChild(h('button', { type: 'button', class: 'ch', 'data-v': v, onclick: () => { onPick(v); paint(); } }, lab));
  paint();
  wrap.repaint = paint;
  return wrap;
}
export function field(labelText, input, hint) {
  const id = input.id || ('f' + Math.random().toString(36).slice(2, 8));
  input.id = id;
  return h('div', { class: 'fld' }, h('label', { for: id }, labelText), input, hint ? h('div', { class: 'hint' }, hint) : null);
}

/* ---------- feedback ---------- */
let toastEl = null, toastTm = 0;
// Lives in <body>, outside #root, so it survives the re-render that often follows an action (back, tab change).
export function toast(msg) {
  if (toastEl) toastEl.remove();
  toastEl = h('div', { class: 'toast', role: 'status', 'aria-live': 'polite' }, msg);
  document.body.appendChild(toastEl);
  clearTimeout(toastTm);
  toastTm = setTimeout(() => { if (toastEl) { toastEl.remove(); toastEl = null; } }, 2800);
}
export function closeToast() { clearTimeout(toastTm); if (toastEl) { toastEl.remove(); toastEl = null; } }
function errHost(el) { return el.closest('.errhost') || el.parentElement; }
export function showErr(el, msg) {
  const host = errHost(el);
  if (!host) return toast(msg);
  let e = null;
  for (const c of host.children) if (c.classList.contains('auto')) e = c;
  if (!e) { e = h('div', { class: 'err auto', role: 'alert' }); host.appendChild(e); }
  e.textContent = msg;
}
export function clearErr(el) {
  const host = errHost(el);
  if (host) for (const c of [...host.children]) if (c.classList.contains('auto')) c.remove();
}
let authLost = () => {};
export const onAuthLost = fn => { authLost = fn; };
// Runs an action from a control: spinner + disabled while it runs, the error shown next to the control.
export async function act(el, fn, ov) {
  if (el.classList.contains('busy')) return false;
  clearErr(el);
  const was = el.disabled;
  el.disabled = true; el.classList.add('busy'); el.setAttribute('aria-busy', 'true');
  try { await fn(); return true; }
  catch (e) {
    if (!(e && e.code)) console.error(e);
    if (errCode(e) === 'not_auth') { authLost(); return false; }
    const msg = (ov && ov[errCode(e)]) || errText(e);
    if (el.isConnected) showErr(el, msg); else toast(msg);
    return false;
  } finally { el.disabled = was; el.classList.remove('busy'); el.removeAttribute('aria-busy'); }
}
// Loads data into a container: spinner, then render(data); on failure a polite card with a retry.
export async function load(box, fetcher, render) {
  const token = (box._tk = (box._tk || 0) + 1);
  if (!box.firstChild) box.appendChild(loading());
  try {
    const data = await fetcher();
    if (box._tk !== token || !box.isConnected) return;
    clear(box); render(data);
  } catch (e) {
    if (box._tk !== token || !box.isConnected) return;
    if (!(e && e.code)) console.error(e);
    if (errCode(e) === 'not_auth') return authLost();
    fill(box, h('div', { class: 'card center' }, h('div', { class: 'err', role: 'alert' }, errText(e)), btn(t('retry'), () => { clear(box); load(box, fetcher, render); }, 'sec sm')));
  }
}

/* ---------- bottom sheet ---------- */
let sheetNow = null;
export function closeSheet() { if (sheetNow) { sheetNow.remove(); sheetNow = null; document.removeEventListener('keydown', escKey); } }
function escKey(e) { if (e.key === 'Escape') closeSheet(); }
export function openSheet(title, build) {
  closeSheet();
  const sheet = h('div', { class: 'sheet', role: 'dialog', 'aria-modal': 'true', 'aria-label': title, tabindex: '-1' },
    h('div', { class: 'grab' }),
    h('div', { class: 'sh' }, h('h3', null, title), h('button', { type: 'button', class: 'ib', 'aria-label': t('close'), onclick: closeSheet }, icon('x'))));
  const bg = h('div', { class: 'sheetbg', onclick: e => { if (e.target === bg) closeSheet(); } }, sheet);
  add(sheet, [build(sheet)]);
  document.getElementById('root').appendChild(bg);
  sheetNow = bg;
  document.addEventListener('keydown', escKey);
  sheet.focus({ preventScroll: true });
  return sheet;
}
// A yes/no sheet whose yes button runs the action with feedback and closes on success.
export function confirmSheet({ title, text, yes, danger, run }) {
  openSheet(title, () => {
    const go = btn(yes, () => act(go, async () => { await run(); closeSheet(); }), danger ? 'danger' : '');
    return [h('p', { class: 'mu' }, text), h('div', { class: 'btns' }, btn(t('cancel'), closeSheet, 'sec'), go)];
  });
}

/* ---------- clipboard + images ---------- */
export async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch (e) { /* fall through */ }
  try {
    const ta = h('textarea', { style: { position: 'fixed', opacity: '0' } }); ta.value = text;
    document.body.appendChild(ta); ta.select(); const ok = document.execCommand('copy'); ta.remove(); return ok;
  } catch (e) { return false; }
}
function readImage(file) {
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(file); const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); res(img); };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('img')); };
    img.src = url;
  });
}
// Resizes a picked photo in the browser and returns a JPEG data URL no longer than `limit` characters.
export async function shrinkImage(file, { max, limit, square }) {
  const img = await readImage(file);
  let side = max, q = .82;
  for (let i = 0; i < 12; i++) {
    let sw = img.naturalWidth, sh = img.naturalHeight, sx = 0, sy = 0;
    if (!sw || !sh) throw new Error('img');
    if (square) { const m = Math.min(sw, sh); sx = (sw - m) / 2; sy = (sh - m) / 2; sw = sh = m; }
    const k = Math.min(1, side / Math.max(sw, sh));
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(sw * k)); c.height = Math.max(1, Math.round(sh * k));
    const cx = c.getContext('2d');
    cx.fillStyle = '#fff'; cx.fillRect(0, 0, c.width, c.height);
    cx.drawImage(img, sx, sy, sw, sh, 0, 0, c.width, c.height);
    const out = c.toDataURL('image/jpeg', q);
    if (out.length <= limit && out.startsWith('data:image/jpeg')) return out;
    if (q > .5) q -= .12; else { side = Math.round(side * .78); q = .78; }
  }
  throw new Error('img');
}
export function photoPicker(onFile) {
  const inp = h('input', { type: 'file', accept: 'image/*', class: 'hidden', 'aria-hidden': 'true', tabindex: '-1' });
  inp.addEventListener('change', () => { const f = inp.files && inp.files[0]; inp.value = ''; if (f) onFile(f); });
  return inp;
}

/* ---------- QR ---------- */
export function qrSvg(text) {
  const qr = window.qrcode(0, 'M'); qr.addData(String(text)); qr.make();
  const n = qr.getModuleCount(), pad = 2; let d = '';
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) d += `M${c + pad} ${r + pad}h1v1h-1z`;
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${n + pad * 2} ${n + pad * 2}`); svg.setAttribute('shape-rendering', 'crispEdges'); svg.setAttribute('role', 'img');
  const path = document.createElementNS(NS, 'path'); path.setAttribute('d', d); path.setAttribute('fill', '#000');
  svg.appendChild(path);
  return svg;
}
