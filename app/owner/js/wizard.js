// Setup wizard: six steps, each saved on "Save and continue". He can leave and come back; the step is remembered.
import { t } from './i18n.js';
import { h, run, fmtDate, money, nameOf, icon } from './ui.js';
import { S, rpc, setGym, loadGym, brandOf, payOf, hasPay, activePackages, mem, linkPrefix } from './state.js';
import { go } from './nav.js';
import { frame, langButton } from './shell.js';
import { gymEditor, brandEditor, packagesEditor, payEditor, importer } from './parts.js';

export const STEPS = 6;
const stepKey = () => 'step_' + (S.gym ? S.gym.id : 'new');
export const savedStep = () => (S.gym ? Math.min(STEPS, Math.max(2, parseInt(mem.get(stepKey()), 10) || 2)) : 1);
const remember = n => { if (S.gym) mem.set(stepKey(), String(n)); };

function nextBar(label, onNext, extra) {
  const err = h('div', { class: 'err', role: 'alert' });
  const btn = h('button', { type: 'button', class: 'btn primary full', 'data-act': 'next' }, label);
  btn.addEventListener('click', async () => { const r = await run(btn, err, onNext); if (r.ok && r.data) go(r.data); });
  return h('div', { class: 'list' }, err, btn, extra || null);
}

export function wizard(n) {
  if (!S.gym && n !== 1) return go('setup/1', true);
  if (S.gym && S.gym.status === 'live') return go('home', true);
  n = Math.min(STEPS, Math.max(1, n || 1));
  remember(Math.max(n, 2));
  const opts = { title: t('wz_title'), step: [n, STEPS], right: langButton(), back: n > 1 ? 'setup/' + (n - 1) : null, name: 'setup-' + n };
  const to = k => 'setup/' + k;

  if (n === 1) {
    const ed = gymEditor();
    return frame(opts, h('h2', null, t('wz1_t')), h('p', { class: 'lead' }, t('wz1_l')), ed.el,
      nextBar(t('save_next'), async () => { await ed.save(); return to(2); }));
  }
  if (n === 2) {
    const ed = brandEditor();
    return frame(opts, h('h2', null, t('wz2_t')), h('p', { class: 'lead' }, t('wz2_l')), ed.el,
      nextBar(t('save_next'), async () => { await ed.save(); return to(3); }));
  }
  if (n === 3) {
    const ed = packagesEditor({ suggest: true });
    return frame(opts, h('h2', null, t('wz3_t')), h('p', { class: 'lead' }, t(S.packages.length ? 'wz3_l2' : 'wz3_l')), ed.el,
      nextBar(t('save_next'), async () => { await ed.save(); return to(4); }));
  }
  if (n === 4) {
    const ed = payEditor();
    return frame(opts, h('h2', null, t('wz4_t')), h('p', { class: 'lead' }, t('wz4_l')), ed.el,
      nextBar(t('save_next'), async () => { await ed.save(); return to(5); }));
  }
  if (n === 5) {
    const im = importer();
    const cont = h('button', { type: 'button', class: 'btn primary full', 'data-act': 'next', onclick: () => go(to(6)) }, t('continue'));
    return frame(opts, h('h2', null, t('wz5_t')), h('p', { class: 'lead' }, t('wz5_l')),
      S.counts.members ? h('div', { class: 'notice ok' }, t('wz5_have', { n: S.counts.members })) : null,
      im.el, cont,
      S.counts.members ? null : h('button', { type: 'button', class: 'btn link', 'data-act': 'skip', onclick: () => go(to(6)) }, t('wz5_skip')),
      h('p', { class: 'hint center' }, t('wz5_later')));
  }
  return review(opts);
}

function review(opts) {
  const g = S.gym, b = brandOf(g), p = payOf(g), pk = activePackages();
  const payBits = [p.instapay ? t('pay_insta') : null, p.wallet ? t('pay_wallet') : null, p.cash ? t('pay_cash') : null].filter(Boolean);
  const line = (step, ic, title, detail, done, must) => h('button', { type: 'button', class: 'card navrow' + (!done && must ? ' next' : ''), 'data-step': step, onclick: () => go('setup/' + step) },
    h('span', { class: 'ic' + (done ? ' ok' : must ? ' danger' : '') }, icon(done ? 'check' : ic)),
    h('span', { class: 'tx' }, h('b', null, title), h('small', null, detail)),
    h('span', { class: 'pill ' + (done ? 'done' : must ? 'bad' : 'todo') }, done ? t('done') : must ? t('needed') : t('later')));
  const err = h('div', { class: 'err', role: 'alert' });
  const fix = h('div');
  const btn = h('button', { type: 'button', class: 'btn primary full', 'data-act': 'golive' }, t('go_live'));
  btn.addEventListener('click', async () => {
    fix.replaceChildren();
    const r = await run(btn, err, async () => { setGym(await rpc('owner_go_live')); await loadGym(); });
    if (r.ok) return go('live/new');
    const code = r.error && r.error.code, step = code === 'need_package' ? 3 : code === 'need_pay' ? 4 : 0;
    if (step) fix.appendChild(h('button', { type: 'button', class: 'btn ghost full', onclick: () => go('setup/' + step) }, t(step === 3 ? 'fix_packages' : 'fix_pay')));
  });
  const ready = pk.length > 0 && hasPay(g);
  return frame(opts, h('h2', null, t('wz6_t')), h('p', { class: 'lead' }, t(ready ? 'wz6_l' : 'wz6_l_miss')),
    h('div', { class: 'list' },
      line(1, 'gym', nameOf(g), h('span', { class: 'ltr' }, linkPrefix() + g.slug), true, true),
      line(2, 'brush', t('wz2_t'), b.logo ? t('rv_brand_logo') : t('rv_brand'), !!(g.brand && g.brand.primary), false),
      line(3, 'tag', t('wz3_t'), pk.length ? pk.map(x => nameOf(x) + ' ' + money(x.price)).join(' · ') : t('rv_no_pk'), pk.length > 0, true),
      line(4, 'cash', t('wz4_t'), payBits.length ? payBits.join(' · ') : t('rv_no_pay'), hasPay(g), true),
      line(5, 'users', t('wz5_t'), S.counts.members ? t('rv_members', { n: S.counts.members }) : t('rv_no_members'), !!S.counts.members, false)),
    h('div', { class: 'notice' }, t('wz6_note')),
    h('div', { class: 'list' }, err, fix, btn));
}
export { fmtDate };
