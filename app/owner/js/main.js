// Refka owner console entry: session, routing, sign up / sign in.
import { t, lang, applyLang } from './i18n.js';
import { h, fill, run, field, friendly, logoMark } from './ui.js';
import { S, loadGym } from './state.js';
import { go, render, route, setRenderer } from './nav.js';
import { frame, langButton } from './shell.js';
import { wizard, savedStep } from './wizard.js';
import { liveScreen, posterScreen, homeScreen, membersScreen, addMembersScreen, scanScreen, settingsScreen, settingsEdit } from './console.js';

const rf = window.rf;
const app = () => document.getElementById('app');

function fatal(msg, retry) {
  fill(app(), h('main', { class: 'screen center', style: { justifyContent: 'center' } },
    h('h2', null, t('oops')), h('p', { class: 'lead', style: { margin: 0 } }, msg),
    retry ? h('button', { type: 'button', class: 'btn primary', onclick: retry }, t('retry')) : null));
}

// ---------------------------------------------------------------- auth
function authScreen(mode) {
  const up = mode !== 'in';
  const name = h('input', { class: 'input', dir: 'auto', autocomplete: 'name', maxlength: 60, name: 'name' });
  const email = h('input', { class: 'input ltr', dir: 'ltr', type: 'email', inputmode: 'email', autocomplete: 'email', autocapitalize: 'none', spellcheck: 'false', maxlength: 120, name: 'email', placeholder: 'name@gmail.com' });
  const pw = h('input', { class: 'input ltr', dir: 'ltr', type: 'password', autocomplete: up ? 'new-password' : 'current-password', maxlength: 72, name: 'password' });
  const eye = h('button', { type: 'button', onclick: () => { const s = pw.type === 'password'; pw.type = s ? 'text' : 'password'; eye.textContent = t(s ? 'hide' : 'show'); } }, t('show'));
  const fN = field(t('au_name'), name), fE = field(t('au_email'), email);
  const fP = field(t('au_pw'), pw, { wrap: h('div', { class: 'pwbox' }, pw, eye), hint: up ? t('au_pw_h') : null });
  const err = h('div', { class: 'err', role: 'alert' }), info = h('div', { class: 'notice ok', hidden: true, role: 'status' });
  const btn = h('button', { type: 'submit', class: 'btn primary full', 'data-act': 'auth' }, t(up ? 'au_up_btn' : 'au_in_btn'));
  const form = h('form', { class: 'list', novalidate: true }, up ? fN : null, fE, fP, err, info, btn);
  form.addEventListener('submit', async ev => {
    ev.preventDefault(); info.hidden = true;
    const r = await run(btn, err, async () => {
      const em = email.value.trim().toLowerCase(); let bad = false;
      if (up && name.value.trim().length < 2) { fN.setErr(t('e_name')); bad = true; }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(em)) { fE.setErr(t('e_email')); bad = true; }
      if (pw.value.length < 8) { fP.setErr(t(up ? 'e_pw' : 'e_pw_in')); bad = true; }
      if (bad) throw friendly(t('e_fix'));
      const d = up ? await rf.ownerSignUp(em, pw.value, name.value.trim()) : await rf.ownerSignIn(em, pw.value);
      return d && d.session ? d.session : await rf.session();
    });
    if (!r.ok) {
      if (r.error && r.error.code === 'account_exists') fill(err, t('err_account_exists') + ' ', h('button', { type: 'button', class: 'btn link', onclick: () => go('auth/in') }, t('au_to_in_btn')));
      return;
    }
    if (!r.data) { info.hidden = false; info.textContent = t('au_confirm'); return; }   // hosted project asks to confirm the email first
    await start();
  });
  frame({ title: 'Refka', brand: true, right: langButton(), name: up ? 'signup' : 'signin' },
    h('h2', null, t(up ? 'au_up_t' : 'au_in_t')), h('p', { class: 'lead' }, t(up ? 'au_up_l' : 'au_in_l')), form,
    h('button', { type: 'button', class: 'btn link', 'data-act': 'auth-switch', onclick: () => go(up ? 'auth/in' : 'auth/up') }, t(up ? 'au_to_in' : 'au_to_up')));
}

function notOwnerScreen() {
  const err = h('div', { class: 'err', role: 'alert' });
  const b = h('button', { type: 'button', class: 'btn primary full' }, t('sign_out'));
  b.addEventListener('click', async () => { const r = await run(b, err, () => rf.signOut()); if (r.ok) { S.session = null; go('auth/in'); } });
  frame({ title: 'Refka', brand: true, right: langButton(), name: 'not-owner' }, h('h2', null, t('no_owner_t')), h('p', { class: 'lead' }, t('no_owner_l')), err, b);
}

// ---------------------------------------------------------------- routing
const isMember = () => { const u = S.session && S.session.user; return !!(u && u.user_metadata && u.user_metadata.kind === 'member'); };

function view() {
  const [a, b] = route();
  if (!S.session) return authScreen(a === 'auth' && b === 'up' ? 'up' : a === 'auth' && b === 'in' ? 'in' : (S.signup ? 'up' : S.returning ? 'in' : 'up'));
  if (isMember()) return notOwnerScreen();
  if (!S.gym) return a === 'setup' && b === '1' ? wizard(1) : go('setup/1', true);
  if (S.gym.status !== 'live') return a === 'setup' ? wizard(parseInt(b, 10) || savedStep()) : go('setup/' + savedStep(), true);
  switch (a) {
    case 'live': return liveScreen(b === 'new');
    case 'link': return liveScreen(false);
    case 'poster': return posterScreen();
    case 'members': return b === 'add' ? addMembersScreen() : membersScreen();
    case 'scan': return scanScreen();
    case 'settings': return b ? settingsEdit(b) : settingsScreen();
    case 'home': return homeScreen();
    default: return go('home', true);
  }
}

async function start() {
  fill(app(), h('div', { class: 'boot' }, h('span', { class: 'spin big' })));
  try {
    S.session = await rf.session();
    if (S.session && !isMember()) await loadGym(); else S.gym = null;
  } catch (e) {
    if (e && (e.code === 'not_auth')) { try { await rf.signOut(); } catch (x) { /* already out */ } S.session = null; }
    else return fatal(t(e && e.code === 'not_owner' ? 'err_not_owner' : 'err_offline'), start);
  }
  render();
}

applyLang();
try { S.returning = !!localStorage.getItem('rf_owner_seen'); } catch (e) { S.returning = false; }
S.signup = new URLSearchParams(location.search).get('signup') === '1';   // "Join now" on refka.tech
setRenderer(() => {
  applyLang();
  if (S.session) { try { localStorage.setItem('rf_owner_seen', '1'); } catch (e) { /* private mode */ } }
  view();
});
if (!rf) fatal(t('err_offline'), () => location.reload());
else {
  // The session ran out in the middle of work: back to sign in, nothing is lost on the server.
  window.addEventListener('rf-owner-signedout', async () => { try { await rf.signOut(); } catch (e) { /* already out */ } S.session = null; S.gym = null; go('auth/in'); });
  start();
}
export { lang, logoMark };
