// Shared state, the screen shell (header, scroll area, tabs) and navigation.
import { t, L, lang, setLang } from './i18n.js';
import { h, add, fill, icon, gymLogo, closeSheet, toast, closeToast } from './ui.js';

export const rf = window.rf;
export const S = {
  slug: null, gym: null,        // gym_public
  profile: null, ms: null,      // me(): my profile and my membership in this gym
  home: null,                   // last member_home
  mode: 'entry', tab: 'home', seg: 'for', stack: [], badge: 0,
};
export const screens = {};      // name -> (params) => { title, right?, build(scr) -> cleanup?, footer?, scrClass? }
export const hooks = { entry: () => {} };
export const root = () => document.getElementById('root');
export const gymName = () => L(S.gym && S.gym.name, S.gym && S.gym.name_ar);
export const gid = () => S.gym.id;
export const firstName = () => String((S.profile && S.profile.name) || '').trim().split(/\s+/)[0] || '';
export const isGuest = () => !S.ms || S.ms.status === 'guest';

let cleanup = null;
function runCleanup() { if (cleanup) { try { cleanup(); } catch (e) { console.error(e); } cleanup = null; } }

export function render() {
  runCleanup(); closeSheet();
  if (S.mode !== 'app') return hooks.entry();
  const top = S.stack[S.stack.length - 1];
  const name = top ? top.name : S.tab;
  const sc = screens[name]((top && top.params) || {});
  const head = h('header', { class: 'ah' },
    top ? h('button', { type: 'button', class: 'ib flip', 'aria-label': t('back'), onclick: back }, icon('back')) : gymLogo(S.gym),
    h('h1', { class: 'tt' }, sc.title || gymName()), sc.right || null);
  const scr = h('main', { class: 'scr ' + (sc.scrClass || ''), id: 'scr', 'data-screen': name });
  fill(root(), head, scr, sc.footer || null, top ? null : tabBar());
  const c = sc.build(scr);
  if (typeof c === 'function') cleanup = c;
}

function tabBar() {
  const mk = (id, ic, label, mid) => {
    const on = S.tab === id;
    return h('button', { type: 'button', class: (mid ? 'mid ' : '') + (on ? 'on' : ''), 'aria-current': on ? 'page' : null, 'data-tab': id, onclick: () => setTab(id) },
      mid ? h('span', { class: 'ic' }, icon(ic, 24)) : icon(ic, 22),
      h('span', null, label),
      mid && S.badge ? h('span', { class: 'dot', 'aria-label': String(S.badge) }, S.badge > 9 ? '9+' : String(S.badge)) : null);
  };
  return h('nav', { class: 'tabs' }, mk('home', 'home', t('tabHome')), mk('refka', 'refka', t('tabRefka'), true), mk('me', 'me', t('tabMe')));
}
export function setTab(id) { S.tab = id; S.stack = []; render(); }
export function setBadge(n) {
  n = Math.max(0, Number(n) || 0);
  if (n === S.badge) return;
  S.badge = n;
  const bar = root().querySelector('.tabs');
  if (bar && S.mode === 'app') bar.replaceWith(tabBar());
}

export function push(name, params) {
  S.stack.push({ name, params: params || {} });
  try { history.pushState({ d: S.stack.length }, ''); } catch (e) { /* ignore */ }
  render();
}
export function back() {
  if (!S.stack.length) return;
  if (history.state && history.state.d) history.back(); else { S.stack.pop(); render(); }
}
window.addEventListener('popstate', () => {
  if (S.mode === 'app' && S.stack.length) { S.stack.pop(); render(); }
});

export function langButton() {
  return h('button', { type: 'button', class: 'langb', lang: lang() === 'ar' ? 'en' : 'ar', onclick: toggleLang }, icon('globe', 16), t('otherLang'));
}
export function toggleLang() { closeToast(); setLang(lang() === 'ar' ? 'en' : 'ar'); setTitle(); render(); }
export function setTitle() { document.title = S.gym ? gymName() : 'Refka'; }

export async function signOutToEntry(msg) {
  try { await rf.signOut(); } catch (e) { /* already out */ }
  S.profile = null; S.ms = null; S.home = null; S.stack = []; S.tab = 'home'; S.seg = 'for'; S.badge = 0; S.mode = 'entry';
  S.entry = { step: 'auth' };
  render();
  if (msg) toast(msg);
}
export { add };
