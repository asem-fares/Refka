// Me tab: profile, privacy, language, sign out.
import { t, lang, label } from './i18n.js';
import { h, fill, icon, btn, tag, note, chips, field, act, toast, avatar, confirmSheet, shrinkImage, photoPicker } from './ui.js';
import { S, rf, screens, push, back, gymName, toggleLang, signOutToEntry } from './core.js';

const GOALS = ['muscle', 'fat', 'fit', 'strength', 'crossfit', 'fight'];
const LEVELS = ['new', 'mid', 'adv', 'pro'];
const TIMES = ['morning', 'afternoon', 'evening', 'late'];

function li(ic, title, sub, onclick, props) {
  return h('button', { type: 'button', class: 'li', onclick, ...(props || {}) }, h('span', { class: 'ic' }, icon(ic)),
    h('span', { class: 'grow' }, h('b', { style: { display: 'block' } }, title), sub ? h('span', { class: 'mu', style: { display: 'block' } }, sub) : null),
    h('span', { class: 'chev' }, icon('chev')));
}
const visLabel = p => (p.vis === 'all' ? t('pvAll', { g: gymName() }) : p.vis === 'gender' ? t('pvGender_' + (p.gender === 'f' ? 'f' : 'm')) : t('pvNone'));

screens.me = () => ({
  title: t('tabMe'),
  build(scr) {
    const p = S.profile;
    const tags = [label('g_', p.goal), label('x_', p.level)].filter(Boolean);
    fill(scr,
      h('section', { class: 'card center', id: 'mecard' }, avatar(p, 84), h('h2', { class: 'big' }, p.name),
        p.phone ? h('span', { class: 'mu ltr' }, p.phone) : null,
        p.bio ? h('p', { class: 'wrapany' }, p.bio) : null,
        tags.length ? h('div', { class: 'tags', style: { 'justify-content': 'center' } }, tags.map(x => tag(x, 'g'))) : null),
      h('div', { class: 'card', style: { gap: '0', 'padding-block': '2px' } },
        li('edit', t('editProfile'), null, () => push('edit'), { id: 'li-edit' }),
        li('shield', t('privacy'), visLabel(p), () => push('privacy'), { id: 'li-privacy' }),
        li('gym', t('aboutGym', { g: gymName() }), null, () => push('gym'), { id: 'li-gym' })),
      h('div', { class: 'card', style: { gap: '0', 'padding-block': '2px' } },
        li('globe', t('lang'), [t('langName'), lang() === 'ar' ? ' ← ' : ' → ', h('span', { lang: lang() === 'ar' ? 'en' : 'ar' }, t('otherLang'))], toggleLang, { id: 'li-lang' }),
        h('button', { type: 'button', class: 'li danger', id: 'li-out', onclick: () => confirmSheet({ title: t('signOutH'), text: t('signOutP'), yes: t('signOut'), danger: true, run: () => signOutToEntry() }) },
          h('span', { class: 'ic' }, icon('out')), h('b', { class: 'grow' }, t('signOut')))),
      h('div', { class: 'pw' }, t('powered')));
  },
});

screens.edit = () => ({
  title: t('editProfile'),
  build(scr) {
    const p = S.profile;
    const st = { goal: p.goal || null, level: p.level || null, times: new Set(p.times || []), avatar: p.avatar || null, avatarDirty: false };
    const name = h('input', { class: 'in', type: 'text', maxlength: '60', autocomplete: 'name', value: p.name || '', name: 'name' });
    const bio = h('textarea', { class: 'in', rows: '2', maxlength: '300', placeholder: t('bioPh'), name: 'bio' }); bio.value = p.bio || '';
    const err = h('div', { class: 'err', role: 'alert' });
    const avBox = h('span', null);
    const paintAv = () => fill(avBox, avatar({ ...p, name: name.value || p.name, avatar: st.avatar }, 84));
    const picker = photoPicker(async f => {
      err.textContent = ''; pick.classList.add('busy');
      try { st.avatar = await shrinkImage(f, { max: 256, limit: 50000, square: true }); st.avatarDirty = true; paintAv(); paintRm(); } catch (e) { err.textContent = t('e_img'); }
      pick.classList.remove('busy');
    });
    picker.id = 'avatarfile';
    const pick = btn([icon('photo', 16), t('addPhoto')], () => picker.click(), 'sec sm');
    const rm = btn(t('rmPhoto'), () => { st.avatar = null; st.avatarDirty = true; paintAv(); paintRm(); }, 'ghost sm');
    const paintRm = () => { rm.classList.toggle('hidden', !st.avatar); pick.lastChild.textContent = st.avatar ? t('chPhoto') : t('addPhoto'); };
    paintAv(); paintRm();
    // one choice that can be cleared by tapping it again; unknown stored values stay selectable
    const single = (keys, prefix, key, id) => {
      const items = keys.map(k => [k, t(prefix + k)]);
      if (st[key] && !keys.includes(st[key])) items.push([st[key], st[key]]);
      return chips(items, v => v === st[key], v => { st[key] = st[key] === v ? null : v; }, { id });
    };
    const timeItems = TIMES.map(k => [k, t('s_' + k)]);
    for (const x of st.times) if (!TIMES.includes(x)) timeItems.push([x, x]);
    const save = btn(t('save'), null, 'wide', { type: 'submit', id: 'savebtn' });
    const form = h('form', { class: 'col errhost', novalidate: true, onsubmit: ev => {
      ev.preventDefault(); err.textContent = '';
      const n = name.value.replace(/\s+/g, ' ').trim();
      if (!n) { err.textContent = t('e_name'); name.focus(); return; }
      if (Array.from(n).length < 2) { err.textContent = t('e_nameShort'); name.focus(); return; }
      act(save, async () => {
        const patch = { name: n, bio: bio.value.trim() || null, goal: st.goal, level: st.level, times: [...st.times] };
        if (st.avatarDirty) patch.avatar = st.avatar;
        S.profile = await rf.rpc('update_profile', { p_patch: patch });
        toast(t('savedT')); back();
      });
    } },
    h('div', { class: 'card center' }, avBox, h('div', { class: 'btns', style: { 'justify-content': 'center' } }, pick, rm), picker),
    field(t('nameL'), name), field(t('bioL'), bio),
    h('div', { class: 'fld' }, h('div', { class: 'lbl' }, t('goalL')), single(GOALS, 'g_', 'goal', 'goals')),
    h('div', { class: 'fld' }, h('div', { class: 'lbl' }, t('levelL')), single(LEVELS, 'x_', 'level', 'levels')),
    h('div', { class: 'fld' }, h('div', { class: 'lbl' }, t('timesL')), chips(timeItems, v => st.times.has(v), v => { if (st.times.has(v)) st.times.delete(v); else st.times.add(v); }, { id: 'times' }), h('div', { class: 'hint' }, t('timesH'))),
    err, save);
    fill(scr, form);
  },
});

screens.privacy = () => ({
  title: t('privacy'),
  build(scr) {
    const box = h('div', { class: 'col errhost', id: 'privacy' });
    const g = gymName();
    const cross = !(S.gym && S.gym.settings && S.gym.settings.cross === false);
    const paint = () => {
      const p = S.profile, gk = p.gender === 'f' ? 'f' : 'm';
      const minor = new Date().getFullYear() - Number(p.birth_year) < 18;
      const opts = [
        ['all', t('pvAll', { g }), cross ? t('pvAllP', { g }) : t('pvAllP', { g }).split('. ')[0] + '. ' + t('pvAllPNoCross', { g })],
        ['gender', t('pvGender_' + gk), t('pvGenderP_' + gk, { g })],
        ['none', t('pvNone'), t('pvNoneP')],
      ];
      fill(box, h('div', { class: 'h2' }, t('pvSee')),
        opts.map(([v, title, text]) => {
          const sel = p.vis === v;
          const b = h('button', { type: 'button', class: 'card opt' + (sel ? ' sel' : ''), role: 'radio', 'aria-checked': sel ? 'true' : 'false', 'data-vis': v, onclick: () => {
            if (S.profile.vis === v) return;
            act(b, async () => { S.profile = await rf.rpc('update_profile', { p_patch: { vis: v } }); paint(); toast(t('savedT')); });
          } }, h('span', { class: 'rd' }), h('span', { class: 'grow' }, h('b', { style: { display: 'block' } }, title), h('span', { class: 'mu', style: { display: 'block' } }, text)));
          return b;
        }),
        note(t('pvReq'), 'lock'), minor ? note(t('pvMinor')) : null);
    };
    paint();
    scr.appendChild(box);
  },
});
export { lang };
