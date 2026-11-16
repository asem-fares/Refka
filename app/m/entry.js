// Entry: gym lookup, phone + PIN (sign in, or sign up when there is no account), join the gym.
import { t, errText, errCode, applyLang } from './i18n.js';
import { h, fill, icon, btn, tag, field, chips, act, applyGym, gymLogo, loading, onAuthLost } from './ui.js';
import { S, rf, root, hooks, render, gymName, langButton, setTitle, signOutToEntry } from './core.js';

const top = () => h('div', { class: 'top' }, langButton());
const powered = () => h('div', { class: 'pw' }, t('powered'));
function page(...kids) { fill(root(), h('main', { class: 'entry' }, top(), ...kids, powered())); }
function message(ic, title, text, action) {
  page(h('div', { class: 'center', style: { 'margin-top': '12vh' } }, h('span', { class: 'bigic' }, icon(ic, 34)), h('h1', { class: 'big' }, title), h('p', { class: 'mu' }, text), action || null));
}

hooks.entry = function () {
  const e = S.entry || (S.entry = { step: 'boot' });
  if (e.step === 'boot') return fill(root(), h('div', { class: 'boot', role: 'status' }, h('span', { class: 'spin' })));
  if (e.step === 'nogym') return message('link', t('noGymH'), t('noGymP'));
  if (e.step === 'badgym') return message('search', t('badGymH'), t('badGymP'));
  if (e.step === 'fail') return message('refresh', t('loadFailH'), e.msg || t('loadFailP'), btn(t('retry'), boot, 'sec'));
  if (e.step === 'auth') return authScreen(e);
  if (e.step === 'join') return joinScreen(e);
  if (e.step === 'joined') return joinedScreen(e);
};

export async function boot() {
  applyLang();
  onAuthLost(() => signOutToEntry(t('signedOutT')));
  hooks.authLost = () => signOutToEntry(t('signedOutT'));
  S.mode = 'entry'; S.entry = { step: 'boot' }; render();
  S.slug = (new URLSearchParams(location.search).get('g') || '').trim().toLowerCase();
  if (!S.slug) { S.entry = { step: 'nogym' }; return render(); }
  try {
    const gym = await rf.rpc('gym_public', { p_slug: S.slug });
    if (!gym) { S.entry = { step: 'badgym' }; return render(); }
    S.gym = gym; applyGym(gym.brand); setTitle();
    const sess = await rf.session();
    if (sess) return await afterAuth();
    S.entry = { step: 'auth' }; render();
  } catch (e) {
    if (errCode(e) === 'not_auth') return signOutToEntry();
    S.entry = { step: 'fail', msg: errCode(e) === 'offline' || errCode(e) === 'unknown' ? null : errText(e) }; render();
  }
}

// Loads me() and decides: straight into the app, or the join form.
async function afterAuth() {
  const me = await rf.rpc('me', {});
  S.profile = me.profile || null;
  S.ms = (me.memberships || []).find(m => m.gym && (m.gym.id === S.gym.id || m.gym.slug === S.gym.slug)) || null;
  if (S.profile && S.ms) return enterApp();
  S.entry = { step: 'join' }; render();
}
function enterApp() { S.mode = 'app'; S.tab = 'home'; S.stack = []; S.entry = null; render(); }

function hero() {
  return h('section', { class: 'hero' }, gymLogo(S.gym, 'big'), h('h1', { class: 'big' }, t('joinH', { g: gymName() })), h('p', null, t('joinP')));
}

function authScreen(e) {
  const phone = h('input', { class: 'in num', type: 'tel', inputmode: 'tel', autocomplete: 'tel', name: 'phone', placeholder: '01012345678', maxlength: '20', value: e.phone || '' });
  const pin = h('input', { class: 'in num', type: 'password', inputmode: 'numeric', autocomplete: 'current-password', name: 'pin', maxlength: '6', pattern: '[0-9]*', value: '' });
  const pin2 = h('input', { class: 'in num', type: 'password', inputmode: 'numeric', autocomplete: 'new-password', name: 'pin2', maxlength: '6', pattern: '[0-9]*' });
  const digitsOnly = el => el.addEventListener('input', () => { const v = el.value.replace(/[^\d]/g, '').slice(0, 6); if (v !== el.value) el.value = v; });
  digitsOnly(pin); digitsOnly(pin2);
  const err = h('div', { class: 'err', role: 'alert' });
  const extra = h('div', { class: 'col' });
  const go = btn(t('go'), null, 'wide', { type: 'submit' });
  let mode = 'in';   // 'in' = sign in first; 'offer' = no account found; 'up' = creating the account

  function check() {
    err.textContent = '';
    if (!rf.validPhone(phone.value)) { err.textContent = t('e_phone'); phone.focus(); return false; }
    if (!rf.validPin(pin.value)) { err.textContent = t('e_pin'); pin.focus(); return false; }
    if (mode === 'up' && pin2.value !== pin.value) { err.textContent = t('e_pin2'); pin2.focus(); return false; }
    return true;
  }
  function setMode(m) {
    mode = m;
    if (m === 'in') { fill(extra); go.textContent = t('go'); }
    if (m === 'offer') {
      go.textContent = t('go');
      const mk = btn(t('createAcc'), () => { setMode('up'); pin2.focus(); }, 'gold wide');
      fill(extra, h('div', { class: 'card warn', id: 'noacc' }, h('h3', null, t('noAccH')), h('p', { class: 'mu' }, t('noAccP')), mk));
    }
    if (m === 'up') {
      go.textContent = t('createAcc');
      fill(extra, h('div', { class: 'card', id: 'newacc' }, h('h3', null, t('newAccH')), h('p', { class: 'mu' }, t('newAccP')), field(t('pin2L'), pin2),
        h('button', { type: 'button', class: 'linkb', onclick: () => { setMode('in'); phone.focus(); } }, t('changeNum'))));
    }
  }
  const resetOnEdit = () => { if (mode === 'offer') setMode('in'); };
  phone.addEventListener('input', resetOnEdit); pin.addEventListener('input', resetOnEdit);

  async function submit() {
    if (!check()) return;
    e.phone = phone.value;
    try {
      if (mode === 'up') {
        const d = await rf.memberSignUp(phone.value, pin.value);
        if (!d || !d.session) await rf.memberSignIn(phone.value, pin.value);
      } else {
        await rf.memberSignIn(phone.value, pin.value);
      }
    } catch (x) {
      if (x && x.code === 'bad_login' && mode !== 'up') { setMode('offer'); return; }
      throw x;
    }
    await afterAuth();
  }
  const form = h('form', { class: 'col errhost', novalidate: true, onsubmit: ev => { ev.preventDefault(); act(go, submit); } },
    field(t('phoneL'), phone), field(t('pinL'), pin, t('pinHint')), extra, err, go);
  page(hero(), form, h('div', { class: 'note' }, icon('lock', 14), h('span', null, t('joinSafe'))));
}

function joinScreen(e) {
  const signOut = h('button', { type: 'button', class: 'linkb', style: { 'align-self': 'center' }, onclick: () => signOutToEntry() }, t('notYou'));
  const overrides = { dup: t('e_joinDup'), limit: t('e_joinFull') };
  async function join(name, gender, year) {
    const r = await rf.rpc('member_join', { p_slug: S.slug, p_name: name, p_gender: gender, p_birth_year: year });
    const me = await rf.rpc('me', {});
    S.profile = me.profile;
    S.ms = (me.memberships || []).find(m => m.gym && (m.gym.id === S.gym.id || m.gym.slug === S.gym.slug)) || r.membership;
    S.entry = { step: 'joined', matched: !!r.matched }; render();
  }
  if (S.profile) {   // already has a Refka profile from another gym: one tap
    const go = btn(t('joinGo', { g: gymName() }), () => act(go, () => join(S.profile.name, S.profile.gender, S.profile.birth_year), overrides), 'wide');
    return page(hero(), h('div', { class: 'col errhost' }, h('p', null, t('joinAgainP', { n: S.profile.name, g: gymName() })), go), signOut);
  }
  const name = h('input', { class: 'in', type: 'text', autocomplete: 'name', name: 'name', maxlength: '60', value: e.name || '' });
  const year = h('input', { class: 'in num', type: 'text', inputmode: 'numeric', name: 'year', maxlength: '4', placeholder: '1998', value: e.year || '' });
  year.addEventListener('input', () => { const v = year.value.replace(/[^\d]/g, '').slice(0, 4); if (v !== year.value) year.value = v; });
  let gender = e.gender || null;
  const sex = chips([['m', t('man')], ['f', t('woman')]], v => v === gender, v => { gender = v; e.gender = v; }, { 'aria-label': t('sex') });
  const err = h('div', { class: 'err', role: 'alert' });
  const go = btn(t('joinGo', { g: gymName() }), null, 'wide', { type: 'submit' });
  const form = h('form', { class: 'col errhost', novalidate: true, onsubmit: ev => {
    ev.preventDefault(); err.textContent = '';
    const n = name.value.replace(/\s+/g, ' ').trim(), y = parseInt(year.value, 10), now = new Date().getFullYear();
    e.name = name.value; e.year = year.value;
    if (!n || !gender || !year.value) { err.textContent = t('e_about'); return; }
    if (Array.from(n).length < 2) { err.textContent = t('e_nameShort'); name.focus(); return; }
    if (!(y >= now - 90 && y <= now - 13)) { err.textContent = t('e_year'); year.focus(); return; }
    act(go, () => join(n, gender, y), overrides);
  } }, field(t('nameL'), name), h('div', { class: 'fld' }, h('div', { class: 'lbl' }, t('sex')), sex), field(t('by'), year), err, go);
  page(h('div', { class: 'row' }, gymLogo(S.gym), h('div', { class: 'grow' }, h('h1', { class: 'big' }, t('aboutH')), h('p', { class: 'mu' }, t('aboutP', { g: gymName() })))), form, signOut);
}

function joinedScreen(e) {
  const n = String(S.profile.name || '').trim().split(/\s+/)[0];
  const ok = e.matched;
  page(h('div', { class: 'center', id: ok ? 'joined-matched' : 'joined-guest', style: { 'margin-top': '8vh' } },
    gymLogo(S.gym, 'big'),
    tag(ok ? t('matchedTag') : t('guestTag'), ok ? 'ok' : 'warn'),
    h('h1', { class: 'big' }, ok ? t('matchedH', { n }) : t('guestH', { n })),
    h('p', { class: 'mu' }, ok ? t('matchedP', { g: gymName() }) : t('guestP', { g: gymName() })),
    btn(t('openApp'), enterApp, 'wide')));
}
export { loading };
