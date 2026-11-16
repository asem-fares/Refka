// Page frame: top bar, optional progress, content, optional bottom tabs.
import { t, lang, setLang } from './i18n.js';
import { h, fill, icon, logoMark } from './ui.js';
import { go, render, route } from './nav.js';
import { S } from './state.js';

export function langButton() {
  return h('button', { type: 'button', class: 'chip-btn', 'data-act': 'lang', lang: lang() === 'ar' ? 'en' : 'ar',
    onclick: () => { setLang(lang() === 'ar' ? 'en' : 'ar'); render(); } }, t('lang_other'));
}

const TABS = [['home', 'home', 'tab_home'], ['members', 'users', 'tab_members'], ['scan', 'scan', 'tab_scan'], ['settings', 'gear', 'tab_settings']];

/** opts: {title, back (path or fn), right (node), brand (bool), step:[n,total], tabs (bool), name (data-screen)} */
export function frame(opts, ...content) {
  const app = document.getElementById('app');
  const bar = h('header', { class: 'bar' },
    opts.back ? h('button', { type: 'button', class: 'back', 'aria-label': t('back'), onclick: () => (typeof opts.back === 'function' ? opts.back() : go(opts.back)) }, '←') : null,
    opts.brand ? h('div', { class: 'brand' }, logoMark(), h('span', null, opts.title || 'Refka')) : h('h1', null, opts.title || ''),
    opts.step ? h('span', { class: 'steps-mini' }, t('step_of', { n: opts.step[0], t: opts.step[1] })) : null,
    opts.right || null);
  const screen = h('main', { class: 'screen' + (opts.tabs ? ' has-tabs' : ''), 'data-screen': opts.name || '' }, content);
  fill(app, bar,
    opts.step ? h('div', { class: 'prog', role: 'progressbar', 'aria-valuemin': 1, 'aria-valuemax': opts.step[1], 'aria-valuenow': opts.step[0] }, h('i', { style: { width: Math.round(opts.step[0] / opts.step[1] * 100) + '%' } })) : null,
    screen,
    opts.tabs ? tabs() : null);
  document.title = (opts.title ? opts.title + ' · ' : '') + 'Refka';
  return screen;
}

function tabs() {
  const cur = route()[0] || 'home';
  return h('div', { class: 'tabs' }, h('nav', { 'aria-label': t('nav') }, TABS.map(([path, ic, key]) =>
    h('button', { type: 'button', class: cur === path ? 'on' : '', 'data-tab': path, 'aria-current': cur === path ? 'page' : null, onclick: () => go(path) },
      icon(ic), h('span', null, t(key)),
      path === 'home' && S.needsCount ? h('span', { class: 'dot', id: 'needs-dot' }, S.needsCount > 99 ? '99+' : S.needsCount) : null))));
}
export function setNeedsDot(n) {
  S.needsCount = n;
  const btn = document.querySelector('.tabs [data-tab=home]'); if (!btn) return;
  let dot = btn.querySelector('.dot');
  if (!n) { if (dot) dot.remove(); return; }
  if (!dot) { dot = h('span', { class: 'dot' }); btn.appendChild(dot); }
  dot.textContent = n > 99 ? '99+' : n;
}
