// The daily console after Go Live: link + poster, Home (needs you), Members, Scan, Settings.
import { t, lang, setLang } from './i18n.js';
import { h, fill, run, toast, sheet, confirmSheet, field, toggle, icon, qrSvg, errText, friendly, today, addMonths, daysLeft, fmtDate, fmtAgo, money, nameOf, initial, debounce } from './ui.js';
import { S, rpc, loadGym, setGym, memberLink, brandOf, settingsOf, payOf, activePackages } from './state.js';
import { go, render, onLeave, route } from './nav.js';
import { frame, setNeedsDot } from './shell.js';
import { gymEditor, brandEditor, packagesEditor, payEditor, importer, safeLogo } from './parts.js';

const rf = window.rf;

// ---------------------------------------------------------------- link, QR, poster
async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch (e) { /* fall through */ }
  try {
    const ta = h('textarea', { style: { position: 'fixed', opacity: '0' } }); ta.value = text; document.body.appendChild(ta); ta.select();
    const ok = document.execCommand('copy'); ta.remove(); return ok;
  } catch (e) { return false; }
}
function linkBox() {
  const link = memberLink();
  const btn = h('button', { type: 'button', class: 'btn primary sm', 'data-act': 'copy' }, t('copy'));
  btn.addEventListener('click', async () => {
    const ok = await copyText(link);
    btn.textContent = ok ? t('copied') : t('copy'); toast(ok ? t('copied_long') : t('copy_fail'));
    setTimeout(() => { btn.textContent = t('copy'); }, 2000);
  });
  return h('div', { class: 'copy-line' }, h('code', { id: 'member-link' }, link), btn);
}
function posterEl() {
  const g = S.gym, b = brandOf(g), logo = safeLogo(b.logo), name = nameOf(g);
  return h('div', { class: 'poster', style: { background: b.primary } },
    h('div', { class: 'center', style: { display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' } },
      h('div', { class: 'plogo' }, logo ? h('img', { src: logo, alt: '' }) : initial(name)),
      h('div', { class: 'pname' }, name)),
    h('h4', null, t('poster_h')),
    h('div', { class: 'qr' }, qrSvg(memberLink()) || h('span', { style: { color: '#111' } }, memberLink())),
    h('ol', null, [t('poster_1'), t('poster_2'), t('poster_3')].map(x => h('li', null, x))),
    h('div', { class: 'plink' }, memberLink()),
    h('div', { class: 'pw' }, 'Powered by Refka'));
}
function printPoster() {
  fill(document.getElementById('print'), posterEl());
  window.print();
}

export function liveScreen(fresh) {
  const link = memberLink(), qr = qrSvg(link);
  const share = navigator.share ? h('button', { type: 'button', class: 'btn ghost full', onclick: () => navigator.share({ title: nameOf(S.gym), text: t('share_text', { g: nameOf(S.gym) }), url: link }).catch(() => {}) }, t('share')) : null;
  frame({ title: fresh ? t('live_bar') : t('set_link'), back: fresh ? null : 'settings', name: 'live' },
    fresh ? h('div', { class: 'party' }, h('span', null, '✓')) : null,
    h('h2', { class: fresh ? 'center' : '' }, fresh ? t('live_t') : t('link_t')),
    h('p', { class: 'lead' + (fresh ? ' center' : '') }, t('live_l')),
    h('div', { class: 'field' }, h('div', { class: 'label' }, t('live_link')), linkBox()),
    qr ? h('div', { class: 'qrw', id: 'qr' }, qr) : h('div', { class: 'notice warn' }, t('qr_fail')),
    h('p', { class: 'hint center' }, t('live_qr_h')),
    share,
    h('button', { type: 'button', class: 'btn ghost full', 'data-act': 'poster', onclick: () => go('poster') }, t('poster_open')),
    fresh ? h('button', { type: 'button', class: 'btn primary full', 'data-act': 'to-home', onclick: () => go('home') }, t('live_next')) : null,
    fresh && !S.counts.members ? h('div', { class: 'notice' }, t('live_tip')) : null);
}
export function posterScreen() {
  frame({ title: t('poster_t'), back: () => history.length > 1 ? history.back() : go('settings'), name: 'poster' },
    h('p', { class: 'lead', style: { margin: 0 } }, t('poster_l')),
    posterEl(),
    h('button', { type: 'button', class: 'btn primary full', 'data-act': 'print', onclick: printPoster }, t('poster_print')));
}

// ---------------------------------------------------------------- home
const METHOD = { instapay: 'pay_insta', wallet: 'pay_wallet', cash: 'pay_cash' };
const pkgName = x => (x && typeof x === 'object' ? nameOf(x) : x || '');

function needCard(n, after) {
  const err = h('div', { class: 'err', role: 'alert' });
  const kv = pairs => h('div', { class: 'kv' }, pairs.filter(p => p && p[1] != null && p[1] !== '').flatMap(([k, v, ltr]) => [h('span', null, k), h('b', { class: ltr ? 'ltr' : '' }, v)]));
  const head = (ic, cls, title, who) => h('div', { class: 'hd' }, h('span', { class: 'ic ' + cls }, icon(ic)),
    h('div', { class: 'tx' }, h('b', null, who || t('someone')), h('small', null, title + (n.at ? ' · ' + fmtAgo(n.at) : ''))));
  const card = h('div', { class: 'card', 'data-need': n.k, 'data-id': n.id });
  const act = (label, cls, name, fn, okMsg) => {
    const b = h('button', { type: 'button', class: 'btn sm ' + cls, 'data-act': name }, label);
    b.addEventListener('click', async () => {
      card.dataset.busy = '1';
      const r = await run(b, err, fn);
      delete card.dataset.busy;
      if (r.ok && r.data !== false) { toast(okMsg); card.remove(); after(); }
    });
    return b;
  };
  if (n.k === 'pay') {
    fill(card, head('cash', 'ok', t('need_pay'), n.name),
      kv([[t('n_amount'), n.amount != null ? money(n.amount) : null], [t('n_pkg'), pkgName(n.package)], [t('n_method'), n.method ? t(METHOD[n.method] || 'pay_other') : null], [t('n_ref'), n.ref, true]]),
      h('p', { class: 'hint' }, t(n.method === 'cash' ? 'need_pay_cash_h' : 'need_pay_h')), err,
      h('div', { class: 'row' },
        act(t('reject'), 'danger', 'reject', async () => (await confirmSheet(t('pay_rej_q'), t('pay_rej_h'), t('reject'), true)) ? rpc('owner_decide_payment', { p_id: n.id, p_ok: false }) : false, t('rejected')),
        act(t('pay_ok'), 'ok', 'approve', () => rpc('owner_decide_payment', { p_id: n.id, p_ok: true }), t('pay_ok_done'))));
  } else if (n.k === 'guest') {
    const approve = h('button', { type: 'button', class: 'btn sm ok', 'data-act': 'approve' }, t('guest_ok'));
    approve.addEventListener('click', () => guestSheet(n, () => { toast(t('guest_ok_done')); card.remove(); after(); }));
    fill(card, head('guest', 'warn', t('need_guest'), n.name),
      kv([[t('m_phone'), n.phone ? String(n.phone).replace(/^\+20/, '0') : null, true], [t('m_gender'), n.gender ? t(n.gender === 'm' ? 'g_m' : 'g_f') : null]]),
      h('p', { class: 'hint' }, t('need_guest_h')), err,
      h('div', { class: 'row' },
        act(t('guest_no'), 'danger', 'reject', async () => (await confirmSheet(t('guest_rej_q', { n: n.name || '' }), t('guest_rej_h'), t('guest_no'), true)) ? rpc('owner_decide_guest', { p_membership_id: n.id, p_ok: false, p_package_id: null, p_ends: null }) : false, t('rejected')),
        approve));
  } else if (n.k === 'report') {
    const about = n.about_name || (n.about && n.about.name) || null;
    const post = n.post || null, body = n.body || (post && post.body) || n.post_body || null, img = safeImg(n.img || (post && post.img) || n.post_img);
    fill(card, head('flag', 'danger', t('need_report'), n.name),
      kv([[t('r_about'), about], [t('r_reason'), n.reason]]),
      body ? h('div', { class: 'quote' }, body) : null, img ? h('img', { class: 'postimg', src: img, alt: '' }) : null,
      h('p', { class: 'hint' }, t('need_report_h')), err,
      h('div', { class: 'row' },
        (n.about_post || (post && post.id)) && (!post || post.status !== 'hidden') ? act(t('post_hide'), 'danger', 'hide', async () => { await rpc('owner_decide_post', { p_id: n.about_post || post.id, p_action: 'hide' }); await rpc('owner_resolve_report', { p_id: n.id }); }, t('post_hidden')) : null,
        act(t('report_done'), 'primary', 'done', () => rpc('owner_resolve_report', { p_id: n.id }), t('report_done_ok'))));
  } else {
    const img = safeImg(n.img);
    fill(card, head('post', '', t('need_post'), n.name),
      n.body ? h('div', { class: 'quote' }, n.body) : null, img ? h('img', { class: 'postimg', src: img, alt: '' }) : null, err,
      h('div', { class: 'row' },
        act(t('post_hide'), 'danger', 'hide', () => rpc('owner_decide_post', { p_id: n.id, p_action: 'hide' }), t('post_hidden')),
        act(t('post_ok'), 'ok', 'approve', () => rpc('owner_decide_post', { p_id: n.id, p_action: 'approve' }), t('post_ok_done'))));
  }
  return card;
}
const safeImg = u => (typeof u === 'string' && /^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(u) ? u : null);

function guestSheet(n, done) {
  sheet(close => {
    const pks = activePackages();
    const pk = h('select', { class: 'input' }, pks.map(p => h('option', { value: p.id }, nameOf(p) + ' · ' + money(p.price))));
    const en = h('input', { class: 'input', type: 'date', min: today(), value: pks[0] ? addMonths(today(), pks[0].months) : '' });
    pk.addEventListener('change', () => { const p = pks.find(x => x.id === pk.value); if (p) en.value = addMonths(today(), p.months); });
    const fE = field(t('m_ends'), en), err = h('div', { class: 'err', role: 'alert' });
    const ok = h('button', { type: 'button', class: 'btn ok', 'data-act': 'guest-confirm' }, t('guest_ok'));
    ok.addEventListener('click', async () => {
      const r = await run(ok, err, () => {
        if (!pk.value) throw friendly(t('err_need_package'));
        if (!en.value || en.value < today()) { fE.setErr(t('e_ends')); throw friendly(t('e_fix')); }
        return rpc('owner_decide_guest', { p_membership_id: n.id, p_ok: true, p_package_id: pk.value, p_ends: en.value });
      });
      if (r.ok) { close(); done(); }
    });
    return [h('h3', null, t('guest_sheet_t', { n: n.name || '' })), h('p', { class: 'mini' }, t('guest_sheet_h')),
      pks.length ? field(t('m_pkg'), pk) : h('div', { class: 'notice warn' }, t('err_need_package')), fE, err,
      h('div', { class: 'row' }, h('button', { type: 'button', class: 'btn ghost', onclick: close }, t('cancel')), ok)];
  });
}

export function homeScreen() {
  const statsEl = h('div', { class: 'stats' }), needsEl = h('div', { class: 'list', id: 'needs' });
  const err = h('div', { class: 'err', role: 'alert' });
  const stamp = h('span', { class: 'hint' });
  const refreshBtn = h('button', { type: 'button', class: 'btn link', 'data-act': 'refresh' }, t('refresh'));
  let sig = null, alive = true, loadedOnce = false;
  fill(needsEl, h('div', { class: 'boot', style: { minHeight: '120px' } }, h('span', { class: 'spin big' })));

  function paintStats(s) {
    s = s || {};
    const items = [['st_members', s.members], ['st_active', s.active_now], ['st_today', s.checkins_today], ['st_expiring', s.expiring_7d], ['st_refkas', s.refkas]];
    fill(statsEl, items.map(([k, v]) => h('div', { class: 'stat', 'data-stat': k }, h('b', null, v == null ? '0' : v), h('span', null, t(k)))));
  }
  function paintNeeds(needs) {
    setNeedsDot(needs.length);
    if (!needs.length) {
      return fill(needsEl, h('div', { class: 'empty', id: 'needs-empty' }, h('b', null, t('home_clear')), h('span', null, t(S.counts.members ? 'home_clear_h' : 'home_clear_new')),
        S.counts.members ? h('button', { type: 'button', class: 'btn ghost sm', onclick: () => go('link') }, t('home_share'))
          : h('button', { type: 'button', class: 'btn primary sm', onclick: () => go('members/add') }, t('mem_add'))));
    }
    fill(needsEl, needs.map(n => needCard(n, () => load(true))));
  }
  async function load(quiet, btn) {
    const r = await run(btn || null, quiet && loadedOnce ? h('div') : err, () => rpc('owner_home'));
    if (!alive || !r.ok) { if (!loadedOnce && alive) fill(needsEl, h('button', { type: 'button', class: 'btn ghost full', onclick: () => load(false) }, t('retry'))); return; }
    const d = r.data || {}; loadedOnce = true; err.textContent = '';
    if (d.gym) setGym(d.gym);
    paintStats(d.stats);
    const needs = d.needs || [], s = needs.map(n => n.k + n.id).join('|');
    // Do not redraw while he is in the middle of an action on a card or has a sheet open.
    const busy = needsEl.querySelector('[data-busy]') || document.querySelector('#layer .sheet');
    if (s !== sig && !(quiet && busy)) { sig = s; paintNeeds(needs); } else setNeedsDot(needs.length);
    stamp.textContent = t('updated_now');
  }
  refreshBtn.addEventListener('click', () => load(false, refreshBtn));
  const timer = setInterval(() => { if (document.visibilityState === 'visible') load(true); }, 30000);
  const onVis = () => { if (document.visibilityState === 'visible') load(true); };
  document.addEventListener('visibilitychange', onVis);
  onLeave(() => { alive = false; clearInterval(timer); document.removeEventListener('visibilitychange', onVis); });

  paintStats(null);
  frame({ title: nameOf(S.gym), brand: true, tabs: true, name: 'home' },
    h('div', { class: 'section-label' }, t('home_stats')), statsEl,
    h('div', { class: 'hd', style: { display: 'flex', alignItems: 'center', gap: '8px' } }, h('div', { class: 'section-label', style: { flex: '1', margin: 0 } }, t('home_needs')), stamp, refreshBtn),
    err, needsEl);
  load(false);
}

// ---------------------------------------------------------------- members
function memberState(m) {
  if (m.status === 'guest') return { k: 'guest', pill: 'warn', label: t('ms_guest') };
  const d = daysLeft(m.ends);
  if (d == null) return { k: 'active', pill: 'done', label: t('ms_open') };
  if (d < 0) return { k: 'ended', pill: 'bad', label: t('ms_ended', { n: -d }) };
  if (d === 0) return { k: 'soon', pill: 'warn', label: t('ms_today') };
  if (d <= 7) return { k: 'soon', pill: 'warn', label: t('ms_days', { n: d }) };
  return { k: 'active', pill: 'done', label: t('ms_days', { n: d }) };
}
export function membersScreen() {
  let all = [], filter = 'all', alive = true, seq = 0;
  const q = h('input', { class: 'input', type: 'search', dir: 'auto', placeholder: t('mem_search'), 'aria-label': t('mem_search'), enterkeyhint: 'search' });
  const chips = h('div', { class: 'chips scroll', role: 'tablist' }), listEl = h('div', { class: 'list', id: 'members' }), err = h('div', { class: 'err', role: 'alert' });
  const count = h('div', { class: 'hint' });
  const FILTERS = [['all', 'mf_all'], ['active', 'mf_active'], ['soon', 'mf_soon'], ['ended', 'mf_ended'], ['notjoined', 'mf_notjoined'], ['guest', 'mf_guest']];
  const match = m => filter === 'all' || (filter === 'notjoined' ? !m.joined && m.status !== 'guest' : memberState(m).k === filter);
  function paint() {
    fill(chips, FILTERS.map(([k, key]) => {
      const n = k === 'all' ? all.length : all.filter(m => (k === 'notjoined' ? !m.joined && m.status !== 'guest' : memberState(m).k === k)).length;
      return h('button', { type: 'button', class: 'chip' + (filter === k ? ' on' : ''), role: 'tab', 'aria-selected': String(filter === k), 'data-f': k, onclick: () => { filter = k; paint(); } }, t(key) + ' ' + n);
    }));
    const rows = all.filter(match);
    count.textContent = rows.length ? t('mem_count', { n: rows.length }) : '';
    if (!rows.length) {
      const none = !all.length && !q.value.trim();
      return fill(listEl, h('div', { class: 'empty' }, h('b', null, t(none ? 'mem_empty' : 'mem_none')), h('span', null, t(none ? 'mem_empty_h' : 'mem_none_h')),
        none ? h('button', { type: 'button', class: 'btn primary sm', onclick: () => go('members/add') }, t('mem_add')) : null));
    }
    fill(listEl, rows.slice(0, 300).map(m => {
      const st = memberState(m), e = h('div', { class: 'err', role: 'alert' });
      const ok = h('div', { class: 'okmsg', role: 'status' });
      const last = h('small', null, m.last_checkin ? t('mem_last', { t: fmtAgo(m.last_checkin) }) : t('mem_never'));
      const btn = h('button', { type: 'button', class: 'btn ghost sm', 'data-act': 'checkin' }, t('mem_checkin'));
      btn.addEventListener('click', async () => {
        ok.textContent = '';
        const r = await run(btn, e, () => rpc('owner_checkin', { p_membership_id: m.id }).catch(x => { throw x.code === 'expired' ? friendly(t('scan_expired')) : x.code === 'not_member' ? friendly(t('ms_guest')) : x; }));
        if (r.ok) { ok.textContent = t(r.data && r.data.already ? 'scan_already' : 'mem_checked'); m.last_checkin = new Date().toISOString(); last.textContent = t('mem_last', { t: fmtAgo(m.last_checkin) }); }
      });
      return h('div', { class: 'card', 'data-member': m.id },
        h('div', { class: 'hd' }, h('div', { class: 'tx' }, h('b', null, m.name || t('someone')), h('small', { class: 'ltr' }, String(m.phone || '').replace(/^\+20/, '0'))),
          h('span', { class: 'pill ' + st.pill }, st.label)),
        h('small', null, [pkgName(m.package) || t('mem_nopkg'), m.ends ? t('ends_on', { d: fmtDate(m.ends) }) : null, m.joined ? null : t('mem_notjoined')].filter(Boolean).join(' · ')),
        h('div', { class: 'hd' }, h('div', { class: 'tx' }, last), m.status === 'guest' ? null : btn), e, ok);
    }), rows.length > 300 ? h('div', { class: 'hint center' }, t('mem_more')) : null);
  }
  async function load() {
    const my = ++seq;
    const r = await run(null, err, () => rpc('owner_members', { p_q: q.value.trim() }));
    if (!alive || my !== seq) return;
    if (!r.ok) return fill(listEl, h('button', { type: 'button', class: 'btn ghost full', onclick: load }, t('retry')));
    all = r.data || []; paint();
  }
  q.addEventListener('input', debounce(load, 300));
  onLeave(() => { alive = false; });
  fill(listEl, h('div', { class: 'boot', style: { minHeight: '120px' } }, h('span', { class: 'spin big' })));
  frame({ title: t('tab_members'), tabs: true, name: 'members',
    right: h('button', { type: 'button', class: 'chip-btn', 'data-act': 'add-members', onclick: () => go('members/add') }, '+ ' + t('mem_add_short')) },
    q, chips, count, err, listEl);
  load();
}
export function addMembersScreen() {
  const im = importer();
  frame({ title: t('mem_add'), back: 'members', name: 'members-add' }, h('p', { class: 'lead', style: { margin: 0 } }, t('wz5_l')), im.el,
    h('button', { type: 'button', class: 'btn ghost full', onclick: () => go('members') }, t('mem_back')));
}

// ---------------------------------------------------------------- scan
export function scanScreen() {
  const resultEl = h('div', { id: 'scan-result', 'aria-live': 'assertive' });
  const code = h('input', { class: 'input ltr', dir: 'ltr', autocomplete: 'off', autocapitalize: 'none', spellcheck: 'false', placeholder: t('scan_ph'), 'aria-label': t('scan_code') });
  const err = h('div', { class: 'err', role: 'alert' });
  const send = h('button', { type: 'button', class: 'btn primary', 'data-act': 'scan-send' }, t('scan_check'));
  const camBox = h('div'), camErr = h('div', { class: 'err', role: 'alert' });
  let stream = null, raf = 0, busy = false, lastTok = '', lastAt = 0, alive = true;

  function show(kind, big, lines) {
    fill(resultEl, h('div', { class: 'scan-state ' + (kind === 'ok' ? 'st-ok' : 'st-bad'), 'data-result': kind },
      h('div', { class: 'mark' }, kind === 'ok' ? '✓' : '✕'), h('div', { class: 'big' }, big), lines.filter(Boolean).map(l => h('div', null, l))));
    if (navigator.vibrate) try { navigator.vibrate(kind === 'ok' ? 60 : [80, 60, 80]); } catch (e) { /* not allowed */ }
  }
  async function check(token, btn) {
    token = String(token || '').trim();
    if (!token) { err.textContent = t('e_scan_empty'); return; }
    if (busy) return; busy = true; err.textContent = '';
    const r = await run(btn || null, h('div'), () => rpc('owner_scan', { p_token: token }));
    busy = false;
    if (!alive) return;
    if (r.ok) {
      const d = r.data || {}, left = daysLeft(d.ends);
      const endLine = d.ends ? t(left != null && left < 0 ? 'scan_ended_on' : 'scan_until', { d: fmtDate(d.ends) }) : null;
      if (d.valid && d.ok !== false) show('ok', d.name || t('scan_ok'), [t(d.already ? 'scan_already' : 'scan_ok'), endLine]);
      else show('bad', d.name || t('scan_bad'), [t(left != null && left < 0 ? 'scan_expired' : 'scan_bad_h'), endLine]);
      code.value = '';
    } else {
      const c = r.error && r.error.code;
      show('bad', t(c === 'expired' ? 'scan_old' : c === 'not_found' || c === 'bad_input' ? 'scan_bad' : 'scan_fail'), [c === 'expired' ? t('scan_old_h') : c === 'not_found' || c === 'bad_input' ? t('scan_bad_h') : errText(r.error)]);
    }
  }
  send.addEventListener('click', () => check(code.value, send));
  code.addEventListener('keydown', e => { if (e.key === 'Enter') check(code.value, send); });

  function stop() { cancelAnimationFrame(raf); if (stream) stream.getTracks().forEach(x => x.stop()); stream = null; }
  async function startCam(btn) {
    const r = await run(btn, camErr, async () => {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw friendly(t('cam_none'));
      try { stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false }); }
      catch (e) { throw friendly(t(e && e.name === 'NotAllowedError' ? 'cam_denied' : 'cam_none')); }
    });
    if (!r.ok) return;
    if (!alive) return stop();
    const video = h('video', { playsinline: true, muted: true, autoplay: true });
    video.srcObject = stream;
    fill(camBox, h('div', { class: 'cam' }, video), h('button', { type: 'button', class: 'btn ghost full', onclick: () => { stop(); paintCam(); } }, t('cam_stop')));
    try { await video.play(); } catch (e) { /* autoplay */ }
    const det = new window.BarcodeDetector({ formats: ['qr_code'] });
    const tick = async () => {
      if (!stream) return;
      try {
        if (!busy && video.readyState >= 2) {
          const codes = await det.detect(video);
          const v = codes[0] && codes[0].rawValue;
          // The same code is not sent again for a few seconds, so one scan is one check-in.
          if (v && (v !== lastTok || Date.now() - lastAt > 4000)) { lastTok = v; lastAt = Date.now(); await check(v); }
        }
      } catch (e) { /* a frame that failed to decode */ }
      raf = requestAnimationFrame(tick);
    };
    tick();
  }
  function paintCam() {
    if ('BarcodeDetector' in window) {
      const b = h('button', { type: 'button', class: 'btn primary full', 'data-act': 'cam' }, t('cam_start'));
      b.addEventListener('click', () => startCam(b));
      fill(camBox, b);
    } else fill(camBox, h('div', { class: 'notice' }, t('cam_unsupported')));
  }
  paintCam();
  onLeave(() => { alive = false; stop(); });
  frame({ title: t('tab_scan'), tabs: true, name: 'scan' },
    h('p', { class: 'lead', style: { margin: 0 } }, t('scan_l')),
    resultEl, camBox, camErr,
    h('div', { class: 'section-label' }, t('scan_or')),
    h('div', { class: 'field' }, h('div', { class: 'hint' }, t('scan_code_h')), code, err), send);
}

// ---------------------------------------------------------------- settings
export function settingsScreen() {
  const g = S.gym, st = settingsOf(g), p = payOf(g);
  const nav = (path, ic, title, detail) => h('button', { type: 'button', class: 'card navrow', 'data-go': path, onclick: () => go(path) },
    h('span', { class: 'ic' }, icon(ic)), h('span', { class: 'tx' }, h('b', null, title), detail ? h('small', null, detail) : null), h('span', { class: 'chev', 'aria-hidden': 'true' }, '›'));
  const payBits = [p.instapay ? t('pay_insta') : null, p.wallet ? t('pay_wallet') : null, p.cash ? t('pay_cash') : null].filter(Boolean).join(' · ');

  // feed rule and men-women requests save on tap
  const ruleErr = h('div', { class: 'err', role: 'alert' }), ruleOk = h('div', { class: 'okmsg', role: 'status' });
  const saveSettings = async (patch, btn, revert) => {
    ruleOk.textContent = '';
    const r = await run(btn, ruleErr, async () => setGym(await rpc('owner_update_gym', { p_patch: { settings: Object.assign({}, settingsOf(S.gym), patch) } })));
    if (r.ok) ruleOk.textContent = t('saved'); else revert();
  };
  let posts = st.posts;
  const seg = h('div', { class: 'seg', role: 'radiogroup', 'aria-label': t('set_posts') });
  const postsHint = h('div', { class: 'hint' });
  const paintSeg = () => {
    fill(seg, [['all', 'posts_all'], ['approve', 'posts_approve'], ['off', 'posts_off']].map(([v, k]) => {
      const b = h('button', { type: 'button', class: posts === v ? 'on' : '', role: 'radio', 'aria-checked': String(posts === v), 'data-posts': v }, t(k));
      b.addEventListener('click', () => { if (posts === v) return; const old = posts; posts = v; paintSeg(); saveSettings({ posts: v }, seg.querySelector('[data-posts=' + v + ']'), () => { posts = old; paintSeg(); }); });
      return b;
    }));
    postsHint.textContent = t('posts_' + posts + '_h');
  };
  paintSeg();
  const crossT = toggle(st.cross, v => saveSettings({ cross: v }, null, () => { crossT.classList.toggle('on', !v); crossT.setAttribute('aria-checked', String(!v)); }), t('set_cross'));
  crossT.dataset.act = 'cross';

  const langSeg = h('div', { class: 'seg' }, [['ar', 'العربية'], ['en', 'English']].map(([v, l]) =>
    h('button', { type: 'button', class: lang() === v ? 'on' : '', lang: v, 'data-lang': v, onclick: () => { setLang(v); render(); } }, l)));
  const outErr = h('div', { class: 'err', role: 'alert' });
  const out = h('button', { type: 'button', class: 'btn danger full', 'data-act': 'signout' }, t('sign_out'));
  out.addEventListener('click', async () => {
    if (!await confirmSheet(t('sign_out_q'), '', t('sign_out'), true)) return;
    const r = await run(out, outErr, () => rf.signOut());
    if (r.ok) { S.session = null; S.gym = null; go('auth'); }
  });
  const email = S.session && S.session.user ? S.session.user.email : '';

  frame({ title: t('tab_settings'), tabs: true, name: 'settings' },
    h('div', { class: 'section-label' }, t('set_share')),
    nav('link', 'link', t('set_link'), t('set_link_h')),
    h('div', { class: 'section-label' }, t('set_gym')),
    nav('settings/gym', 'gym', t('set_name'), nameOf(g)),
    nav('settings/brand', 'brush', t('wz2_t'), t('set_brand_h')),
    nav('settings/packages', 'tag', t('wz3_t'), t('set_pk_h', { n: activePackages().length })),
    nav('settings/pay', 'cash', t('wz4_t'), payBits || t('rv_no_pay')),
    nav('members/add', 'users', t('mem_add'), t('rv_members', { n: S.counts.members || 0 })),
    h('div', { class: 'section-label' }, t('set_rules')),
    h('div', { class: 'card' }, h('b', null, t('set_posts')), seg, postsHint),
    h('div', { class: 'card' }, h('div', { class: 'trow' }, h('div', { class: 'tx' }, h('b', null, t('set_cross')), h('small', null, t('set_cross_h'))), crossT)),
    ruleErr, ruleOk,
    h('div', { class: 'section-label' }, t('set_lang')),
    langSeg,
    h('div', { class: 'section-label' }, t('set_account')),
    email ? h('div', { class: 'hint ltr' }, email) : null,
    out, outErr);
}

export function settingsEdit(which) {
  const map = {
    gym: [t('set_name'), gymEditor, t('wz1_l')],
    brand: [t('wz2_t'), brandEditor, t('wz2_l')],
    packages: [t('wz3_t'), () => packagesEditor({ showActive: true }), t('wz3_l2')],
    pay: [t('wz4_t'), payEditor, t('wz4_l')],
  };
  const m = map[which]; if (!m) return go('settings', true);
  const ed = m[1]();
  const err = h('div', { class: 'err', role: 'alert' }), ok = h('div', { class: 'okmsg', role: 'status' });
  const btn = h('button', { type: 'button', class: 'btn primary full', 'data-act': 'save' }, t('save'));
  btn.addEventListener('click', async () => {
    ok.textContent = '';
    const r = await run(btn, err, () => ed.save());
    if (r.ok) { ok.textContent = t('saved'); toast(t('saved')); if (which === 'packages') render(); }
  });
  frame({ title: m[0], back: 'settings', name: 'settings-' + which }, h('p', { class: 'lead', style: { margin: 0 } }, m[2]), ed.el, err, ok, btn);
}
export { route };
