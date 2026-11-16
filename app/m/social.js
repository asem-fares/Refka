// Refka tab (For you, Feed, Requests, My Refkas), person sheet, request sheet, chat.
import { t, label, ago, ftime, fdate, slotLabel, dayLabel, localISO, errText, errCode } from './i18n.js';
import { h, fill, icon, btn, tag, note, gate, empty, chips, act, load, toast, avatar, safeImg, openSheet, closeSheet, confirmSheet, shrinkImage, photoPicker, loading, showErr, clearErr } from './ui.js';
import { S, rf, screens, hooks, push, back, render, setTab, setBadge, gymName, gid, isGuest } from './core.js';

const TIMES = ['morning', 'afternoon', 'evening', 'late'];
const counts = { req: 0, mine: 0 };
let peopleCache = [];
let badgeAt = 0;

/* ---------- badge ---------- */
export async function refreshBadge(force) {
  if (isGuest() || (!force && Date.now() - badgeAt < 20000)) return;
  badgeAt = Date.now();
  try {
    const [rq, rk] = await Promise.all([rf.rpc('requests_list', { p_gym: gid() }), rf.rpc('refkas_list', { p_gym: gid() })]);
    counts.req = (rq.incoming || []).length;
    counts.mine = (rk || []).reduce((a, r) => a + (Number(r.unread) || 0), 0);
    setBadge(counts.req + counts.mine); paintSegCounts();
  } catch (e) { /* a badge is not worth an error message */ }
}
hooks.badge = () => refreshBadge(false);
function paintSegCounts() {
  for (const k of ['req', 'mine']) {
    const b = document.querySelector('.seg [data-seg="' + k + '"]');
    if (!b) continue;
    const old = b.querySelector('.n'); if (old) old.remove();
    if (counts[k]) b.appendChild(h('span', { class: 'n' }, counts[k] > 9 ? '9+' : String(counts[k])));
  }
}

// Social lists need an active membership: guests and long expired members get an explanation instead.
function socialLoad(box, fetcher, paint) {
  if (isGuest()) return fill(box, gate(t('gateGuest', { g: gymName() })));
  return load(box, async () => {
    try { return { ok: await fetcher() }; }
    catch (e) { if (e && e.code === 'not_member') return { gate: true }; throw e; }
  }, r => {
    if (r.gate) return fill(box, gate(t('gateExpired')), btn(t('renew'), () => push('renew'), 'gold wide'));
    paint(r.ok);
  });
}

/* ---------- Refka tab ---------- */
screens.refka = () => ({
  title: t('tabRefka'),
  build(scr) {
    const segs = [['for', t('rkFor')], ['feed', t('rkFeed')], ['req', t('rkReq')], ['mine', t('rkMine')]];
    const box = h('div', { class: 'col', id: 'segbody' });
    let stop = null;
    const bar = h('div', { class: 'seg', role: 'tablist' }, segs.map(([k, lab]) => h('button', { type: 'button', role: 'tab', 'data-seg': k, onclick: () => pick(k) }, h('span', null, lab))));
    function pick(k) {
      S.seg = k;
      for (const b of bar.children) { const on = b.dataset.seg === k; b.classList.toggle('on', on); b.setAttribute('aria-selected', on ? 'true' : 'false'); }
      if (stop) { stop(); stop = null; }
      box._tk = (box._tk || 0) + 1; fill(box);
      stop = ({ for: segFor, feed: segFeed, req: segReq, mine: segMine })[k](box) || null;
    }
    scr.appendChild(bar); scr.appendChild(box);
    pick(S.seg);
    paintSegCounts(); refreshBadge(true);
    return () => { if (stop) stop(); };
  },
});

/* ---------- For you ---------- */
function personLine(p, sub, right) {
  const open = () => openPerson(p);
  return h('div', { class: 'row' },
    h('button', { type: 'button', class: 'plain grow', onclick: open, 'aria-label': t('viewProfile') + ': ' + p.name },
      avatar(p, 46), h('span', { class: 'grow' }, h('span', { class: 'nm', style: { display: 'block' } }, p.name), sub ? h('span', { class: 'mu', style: { display: 'block' } }, sub) : null)),
    right || null);
}
function relAction(p, after) {
  if (p.relation === 'refka') return tag(t('refka'), 'gold');
  if (p.relation === 'out') return tag(t('sentAlready'));
  if (p.relation === 'in') return btn(t('answer'), () => { closeSheet(); S.seg = 'req'; if (S.tab !== 'refka' || S.stack.length) setTab('refka'); else render(); }, 'sm sec');
  return btn(t('bTT'), () => openRequest(p, after), 'sm', { 'data-tt': p.user_id });
}
function sharedTimes(p) {
  const mine = (S.profile && S.profile.times) || [];
  return (p.times || []).filter(x => mine.includes(x));
}
function segFor(box) {
  const q = h('input', { class: 'in', type: 'search', placeholder: t('search'), 'aria-label': t('search'), maxlength: '60', enterkeyhint: 'search' });
  const list = h('div', { class: 'col', id: 'people' });
  let tm = 0;
  const run = () => socialLoad(list, () => rf.rpc('people', { p_gym: gid(), p_q: q.value.trim() }), ps => {
    if (!q.value.trim()) peopleCache = ps;
    if (!ps.length) return fill(list, empty(q.value.trim() ? t('noFound') : t('noSug')));
    fill(list, ps.map(p => {
      const sh = sharedTimes(p);
      const sub = [label('g_', p.goal), label('x_', p.level)].filter(Boolean).join(' · ');
      return h('article', { class: 'card person', 'data-user': p.user_id, 'data-name': p.name },
        personLine(p, sub, h('span', { class: 'errhost', 'data-rel': p.relation }, relAction(p, run))),
        sh.length ? h('div', { class: 'overlap' }, icon('cal', 14), h('span', null, t('ovl', { d: sh.map(x => label('s_', x)).join(' · ') }))) : null);
    }));
  });
  q.addEventListener('input', () => { clearTimeout(tm); tm = setTimeout(() => { fill(list); run(); }, 350); });
  if (isGuest()) { fill(box, list); run(); return; }
  fill(box, q, h('p', { class: 'mu' }, t('sugP')), list);
  run();
  return () => clearTimeout(tm);
}

/* ---------- person sheet ---------- */
async function openPerson(p0) {
  let p = peopleCache.find(x => x.user_id === p0.user_id) || p0;
  openSheet(p.name, sheet => {
    const body = h('div', { class: 'col' });
    const paint = () => {
      const rows = [];
      if (p.goal) rows.push(h('div', { class: 'between' }, h('span', { class: 'mu' }, t('goal')), h('b', null, label('g_', p.goal))));
      if (p.level) rows.push(h('div', { class: 'between' }, h('span', { class: 'mu' }, t('level')), h('b', null, label('x_', p.level))));
      if (p.times && p.times.length) rows.push(h('div', { class: 'between' }, h('span', { class: 'mu' }, t('when')), h('span', { class: 'tags' }, p.times.map(x => tag(label('s_', x), sharedTimes(p).includes(x) ? 'g' : '')))));
      const blockB = btn([icon('ban', 16), t('block')], () => confirmBlock(p), 'danger');
      const repB = btn([icon('flag', 16), t('report')], () => openReport({ user: p }), 'sec');
      fill(body,
        h('div', { class: 'center' }, avatar(p, 88), p.bio ? h('p', { class: 'wrapany' }, p.bio) : null),
        rows.length ? h('div', { class: 'card' }, rows) : null,
        p.relation ? h('div', { class: 'errhost col', id: 'personact' }, relActionWide(p)) : null,
        h('div', { class: 'btns' }, repB, blockB));
    };
    paint();
    if (p.relation === undefined && !isGuest()) {   // opened from the feed or a request: fetch the full card
      rf.rpc('people', { p_gym: gid(), p_q: '' }).then(ps => { peopleCache = ps; const f = ps.find(x => x.user_id === p.user_id); if (f && sheet.isConnected) { p = f; paint(); } }).catch(() => {});
    }
    return body;
  });
}
function relActionWide(p) {
  const a = relAction(p, () => { if (S.tab === 'refka' && !S.stack.length && S.seg === 'for') render(); });
  if (a.classList.contains('btn')) { a.classList.remove('sm'); a.classList.add('wide'); }
  return a;
}
function confirmBlock(p, then) {
  confirmSheet({ title: t('blockH', { n: p.name }), text: t('blockP'), yes: t('block'), danger: true, run: async () => {
    await rf.rpc('block_user', { p_user: p.user_id });
    peopleCache = peopleCache.filter(x => x.user_id !== p.user_id);
    toast(t('blocked'));
    if (then) then(); else render();
    refreshBadge(true);
  } });
}
function openReport({ user, post }) {
  let reason = null;
  openSheet(post ? t('reportPostH') : t('reportH', { n: user.name }), () => {
    const err = h('div', { class: 'err', role: 'alert' });
    const go = btn(t('reportDo'), () => {
      err.textContent = '';
      if (!reason) { err.textContent = t('e_reason'); return; }
      act(go, async () => {
        await rf.rpc('report', { p_gym: gid(), p_user: post ? null : user.user_id, p_post: post ? post.id : null, p_reason: t('rs_' + reason) });
        closeSheet(); toast(t('reported', { g: gymName() }));
      }, { limit: t('limitReport') });
    }, 'wide');
    return [h('p', { class: 'mu' }, t('reportP', { g: gymName() })),
      chips(['harassment', 'offensive', 'spam', 'other'].map(k => [k, t('rs_' + k)]), v => v === reason, v => { reason = v; }, { id: 'reasons' }),
      h('div', { class: 'col errhost' }, err, go)];
  });
}

/* ---------- request sheet: kind + day + time, no free text ---------- */
function openRequest(p, after) {
  const st = { kind: 'train', day: null, time: null };
  const days = []; const now = new Date();
  for (let i = 0; i < 7; i++) { const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i); days.push(localISO(d)); }
  const shared = sharedTimes(p);
  if (shared.length === 1) st.time = shared[0];
  openSheet(t('reqH', { n: p.name }), () => {
    const err = h('div', { class: 'err', role: 'alert' });
    const go = btn(t('sendR'), () => {
      err.textContent = '';
      if (!st.day || !st.time) { err.textContent = t('e_slot'); return; }
      act(go, async () => {
        await rf.rpc('request_send', { p_gym: gid(), p_to: p.user_id, p_kind: st.kind, p_slot: st.day + ':' + st.time });
        p.relation = 'out';
        closeSheet(); toast(t('reqSent', { n: p.name }));
        if (after) after();
      });
    }, 'wide', { id: 'reqsend' });
    return [
      h('div', { class: 'fld' }, h('div', { class: 'lbl' }, t('type')), chips([['train', t('rt_train')], ['spot', t('rt_spot')]], v => v === st.kind, v => { st.kind = v; }, { id: 'kinds' })),
      h('div', { class: 'fld' }, h('div', { class: 'lbl' }, t('whenDay')), chips(days.map(d => [d, dayLabel(d)]), v => v === st.day, v => { st.day = v; }, { id: 'days' })),
      h('div', { class: 'fld' }, h('div', { class: 'lbl' }, t('whenR')), chips(TIMES.map(k => [k, t('s_' + k)]), v => v === st.time, v => { st.time = v; }, { id: 'slots' })),
      note(t('noFree'), 'shield'),
      h('div', { class: 'col errhost' }, err, go)];
  });
}

/* ---------- Requests ---------- */
function reqTags(r) { return h('div', { class: 'tags' }, tag(label('rt_', r.kind), 'g'), r.slot ? tag(slotLabel(r.slot)) : null); }
function segReq(box) {
  const run = () => socialLoad(box, () => rf.rpc('requests_list', { p_gym: gid() }), d => {
    const inc = d.incoming || [], out = d.outgoing || [];
    counts.req = inc.length; setBadge(counts.req + counts.mine); paintSegCounts();
    const kids = [h('div', { class: 'h2' }, t('inH2'))];
    if (!inc.length) kids.push(empty(t('noReq')));
    inc.forEach(r => {
      const yes = btn(t('accept'), () => act(yes, async () => {
        const res = await rf.rpc('request_respond', { p_id: r.id, p_accept: true });
        toast(t('acceptedT', { n: r.from.name })); refreshBadge(true);
        if (res && res.refka_id) { S.seg = 'mine'; push('chat', { id: res.refka_id, with: r.from }); } else run();
      }), '', { 'data-accept': r.id });
      const no = btn(t('notNowR'), () => act(no, async () => { await rf.rpc('request_respond', { p_id: r.id, p_accept: false }); toast(t('declinedT')); run(); }), 'sec', { 'data-decline': r.id });
      kids.push(h('article', { class: 'card', 'data-req': r.id, 'data-name': r.from.name }, personLine(r.from, [label('g_', r.from.goal), ago(r.at)].filter(Boolean).join(' · ')), reqTags(r), h('div', { class: 'btns errhost' }, yes, no)));
    });
    kids.push(h('div', { class: 'h2' }, t('outH')));
    if (!out.length) kids.push(empty(t('noOut')));
    out.forEach(r => {
      const stText = r.status === 'pending' ? t('waiting', { n: r.to.name }) : r.status === 'accepted' ? t('accepted', { n: r.to.name }) : r.status === 'declined' ? t('declinedOut') : t('cancelledOut');
      const cancel = r.status === 'pending' ? btn(t('cancelReq'), () => act(cancel, async () => { await rf.rpc('request_cancel', { p_id: r.id }); toast(t('cancelledT')); run(); }), 'sec sm', { 'data-cancel': r.id }) : null;
      kids.push(h('article', { class: 'card', 'data-out': r.id, 'data-name': r.to.name, 'data-status': r.status }, personLine(r.to, ago(r.at)), reqTags(r),
        h('div', { class: 'between errhost' }, r.status === 'accepted' ? tag(stText, 'ok') : h('span', { class: 'mu' }, stText), cancel)));
    });
    fill(box, kids);
  });
  run();
}

/* ---------- My Refkas ---------- */
function segMine(box) {
  socialLoad(box, () => rf.rpc('refkas_list', { p_gym: gid() }), rs => {
    counts.mine = rs.reduce((a, r) => a + (Number(r.unread) || 0), 0); setBadge(counts.req + counts.mine); paintSegCounts();
    if (!rs.length) return fill(box, empty(t('mineEmpty')));
    fill(box, rs.map(r => h('button', { type: 'button', class: 'card', 'data-refka': r.id, 'data-name': r.with.name, onclick: () => push('chat', { id: r.id, with: r.with }) },
      h('div', { class: 'row' }, avatar(r.with, 46),
        h('div', { class: 'grow' }, h('div', { class: 'nm' }, r.with.name),
          h('div', { class: 'mu nm', style: { 'font-weight': '400' } }, r.last ? (r.last.mine ? t('youPfx') : '') + r.last.body : t('noMsgs'))),
        h('div', { style: { display: 'flex', 'flex-direction': 'column', 'align-items': 'flex-end', gap: '4px', flex: '0 0 auto' } },
          h('span', { class: 'cnt' }, r.last ? ago(r.last.at) : t('since', { d: fdate(r.since) })),
          r.unread ? tag(String(r.unread) + ' ' + t('unread'), 'bad') : null)))));
  });
}

/* ---------- Feed ---------- */
function segFeed(box) {
  if (isGuest()) return void fill(box, gate(t('gateGuest', { g: gymName() })));
  const off = S.home && S.home.gym && S.home.gym.settings && S.home.gym.settings.posts === 'off';
  if (off) return void fill(box, gate(errText({ code: 'posts_off' }), 'info'));
  const list = h('div', { class: 'col', id: 'feed' });
  const comp = h('div', { class: 'col' });
  fill(box, h('p', { class: 'mu' }, t('feedP')), comp, list);

  // composer
  let img = null;
  const ta = h('textarea', { class: 'in', rows: '2', maxlength: '500', placeholder: t('postPh'), 'aria-label': t('postPh'), id: 'posttext' });
  const cnt = h('span', { class: 'cnt' }, '0/500');
  ta.addEventListener('input', () => { cnt.textContent = Array.from(ta.value).length + '/500'; });
  const prev = h('div', { class: 'prev hidden' });
  const err = h('div', { class: 'err', role: 'alert' });
  const photoB = btn([icon('photo', 16), t('addPhoto')], () => picker.click(), 'sec sm', { id: 'postphoto' });
  const setImg = v => {
    img = v;
    photoB.lastChild.textContent = v ? t('chPhoto') : t('addPhoto');
    prev.classList.toggle('hidden', !v);
    fill(prev, v ? [h('img', { src: v, alt: '' }), h('button', { type: 'button', class: 'ib', 'aria-label': t('rmPhoto'), onclick: () => setImg(null) }, icon('x', 16))] : []);
  };
  const picker = photoPicker(async f => {
    err.textContent = ''; photoB.classList.add('busy');
    try { setImg(await shrinkImage(f, { max: 1080, limit: 190000 })); } catch (e) { err.textContent = t('e_img'); }
    photoB.classList.remove('busy');
  });
  picker.id = 'postfile';
  const post = btn(t('postBtn'), () => {
    err.textContent = '';
    const body = ta.value.trim();
    if (!body && !img) { err.textContent = t('e_post'); ta.focus(); return; }
    act(post, async () => {
      let r;
      try { r = await rf.rpc('post_create', { p_gym: gid(), p_body: body, p_img: img }); }
      catch (e) { if (e && e.code === 'posts_off') { if (S.home && S.home.gym) S.home.gym.settings = { ...(S.home.gym.settings || {}), posts: 'off' }; fill(box, gate(errText(e), 'info')); return; } throw e; }
      ta.value = ''; cnt.textContent = '0/500'; setImg(null);
      const p = r.post;
      toast(p.status === 'pending' ? t('postSent', { g: gymName() }) : t('posted'));
      const e0 = list.querySelector('.mu.card'); if (e0 && !list.querySelector('.post')) e0.remove();
      list.insertBefore(postCard(p), list.firstChild);
    }, { limit: t('limitPost') });
  }, 'sm', { id: 'postsend' });
  fill(comp, h('section', { class: 'card errhost', id: 'composer' }, ta, prev, picker, err, h('div', { class: 'between' }, photoB, h('div', { class: 'row' }, cnt, post))));

  // list + paging
  function page(before) {
    return rf.rpc('feed', { p_gym: gid(), p_before: before || null });
  }
  function addPosts(ps) {
    ps.forEach(p => list.appendChild(postCard(p)));
    if (ps.length >= 20) {
      const more = btn(t('more'), () => act(more, async () => { const nx = await page(ps[ps.length - 1].at); wrap.remove(); addPosts(nx); }), 'sec wide');
      const wrap = h('div', { class: 'errhost col' }, more);
      list.appendChild(wrap);
    }
  }
  socialLoad(list, () => page(null), ps => {
    if (!ps.length) return fill(list, empty(t('feedEmpty')));
    fill(list); addPosts(ps);
  });
}
function postCard(p) {
  const card = h('article', { class: 'card post', 'data-post': p.id, 'data-by': p.by ? p.by.name : '', 'data-mine': p.mine ? '1' : '0' });
  const menu = h('button', { type: 'button', class: 'ib', 'aria-label': t('postOpts'), onclick: () => postMenu(p, card) }, icon('dots'));
  const who = p.by || { name: '' };
  const head = h('div', { class: 'row' },
    p.mine ? h('span', { class: 'plain grow' }, avatar(who, 40), h('span', { class: 'grow' }, h('span', { class: 'nm', style: { display: 'block' } }, who.name), h('span', { class: 'mu', style: { display: 'block' } }, ago(p.at))))
      : h('button', { type: 'button', class: 'plain grow', onclick: () => openPerson(who), 'aria-label': t('viewProfile') + ': ' + who.name }, avatar(who, 40), h('span', { class: 'grow' }, h('span', { class: 'nm', style: { display: 'block' } }, who.name), h('span', { class: 'mu', style: { display: 'block' } }, ago(p.at)))),
    menu);
  const src = safeImg(p.img);
  const foot = h('div', { class: 'between errhost' });
  if (p.mine) {
    foot.appendChild(h('span', { class: 'mu', 'data-respects': String(p.respects || 0) }, t('respectN', { n: p.respects || 0 })));
    if (p.status === 'pending') foot.appendChild(tag(t('pendingP', { g: gymName() }), 'warn'));
    if (p.status === 'hidden') foot.appendChild(tag(t('st_hidden'), 'bad'));
  } else {
    const paintR = b => { b.className = 'btn sm ' + (p.respected ? 'sec' : 'gold'); fill(b, icon('flame', 16), p.respected ? t('respected') : t('respect')); b.setAttribute('aria-pressed', p.respected ? 'true' : 'false'); };
    const rb = btn('', () => act(rb, async () => { const r = await rf.rpc('post_respect', { p_id: p.id }); p.respected = r && typeof r.respected === 'boolean' ? r.respected : !p.respected; paintR(rb); }), 'sm', { 'data-respect': p.id });
    paintR(rb); foot.appendChild(rb);
  }
  fill(card, head, p.body ? h('p', { class: 'wrapany' }, p.body) : null, src ? h('img', { class: 'pimg', src, alt: t('photoAlt', { n: who.name }), loading: 'lazy' }) : null, foot);
  return card;
}
function postMenu(p, card) {
  openSheet(t('postOpts'), () => {
    if (p.mine) {
      const del = btn([icon('trash', 16), t('delPost')], () => act(del, async () => {
        await rf.rpc('post_delete', { p_id: p.id });
        const list = card.parentElement; card.remove(); closeSheet(); toast(t('deleted'));
        if (list && !list.querySelector('.post')) fill(list, empty(t('feedEmpty')));
      }), 'danger wide', { id: 'delpost' });
      return [h('p', { class: 'mu' }, t('delPostP')), h('div', { class: 'col errhost' }, del)];
    }
    return h('div', { class: 'col' },
      btn([icon('me', 16), t('viewProfile')], () => openPerson(p.by), 'sec wide'),
      btn([icon('flag', 16), t('report')], () => openReport({ user: p.by, post: p }), 'sec wide', { id: 'reportpost' }),
      btn([icon('ban', 16), t('block')], () => confirmBlock(p.by), 'danger wide'));
  });
}

/* ---------- Chat ---------- */
screens.chat = ({ id, with: other }) => {
  const scrBox = { el: null };
  const ta = h('textarea', { class: 'in', rows: '1', maxlength: '1000', placeholder: t('typeMsg'), 'aria-label': t('typeMsg'), id: 'chattext', enterkeyhint: 'send' });
  const sendB = h('button', { type: 'button', class: 'btn', 'aria-label': t('send'), id: 'chatsend' }, icon('send', 20));
  const errBox = h('div', { class: 'err hidden', role: 'alert' });
  const footer = h('div', { class: 'composewrap' }, errBox, h('div', { class: 'compose' }, ta, sendB));
  const menuB = h('button', { type: 'button', class: 'ib', 'aria-label': t('chatOpts'), id: 'chatmenu', onclick: menu }, icon('dots'));
  let closed = false;
  function menu() {
    openSheet(other.name, () => h('div', { class: 'col' },
      closed ? null : btn(t('endRefka'), () => confirmSheet({ title: t('endH', { n: other.name }), text: t('endP'), yes: t('endDo'), danger: true, run: async () => { await rf.rpc('refka_end', { p_id: id }); toast(t('ended')); refreshBadge(true); back(); } }), 'sec wide', { id: 'endrefka' }),
      btn([icon('flag', 16), t('report')], () => openReport({ user: other }), 'sec wide'),
      btn([icon('ban', 16), t('block')], () => confirmBlock(other, () => back()), 'danger wide', { id: 'blockchat' })));
  }
  return {
    title: other.name, right: menuB, footer, scrClass: 'chatscr',
    build(scr) {
      scrBox.el = scr;
      let alive = true, last = null, timer = 0, busy = false, first = true;
      const seen = new Set();
      scr.appendChild(loading());
      const atBottom = () => scr.scrollHeight - scr.scrollTop - scr.clientHeight < 80;
      const toBottom = () => { scr.scrollTop = scr.scrollHeight; };
      function bubble(m) {
        return h('div', { class: 'bub' + (m.mine ? ' me' : ''), 'data-msg': m.id || '', 'data-mine': m.mine ? '1' : '0' }, m.body, h('small', null, ftime(m.at)));
      }
      function addMsgs(ms) {
        const stick = first || atBottom();
        for (const m of ms) {
          if (seen.has(m.id)) continue;
          seen.add(m.id);
          const pend = m.mine ? scr.querySelector('.bub.pend[data-id="' + m.id + '"]') : null;
          if (pend) pend.remove();
          scr.appendChild(bubble(m));
          if (!last || String(m.at) > String(last)) last = m.at;
        }
        if (stick) toBottom();
      }
      function close(code) {
        closed = true; clearInterval(timer);
        ta.disabled = true; sendB.disabled = true;
        const l = scr.querySelector('.loading'); if (l) l.remove();
        if (!scr.querySelector('.sys.end')) scr.appendChild(h('div', { class: 'sys end', id: 'chatended' }, code === 'not_member' ? t('memEnded') : code === 'hidden' ? t('hiddenChat') : t('chatEnded')));
        toBottom();
      }
      async function poll() {
        if (!alive || closed || busy || document.visibilityState !== 'visible') return;
        busy = true;
        try {
          const ms = await rf.rpc('chat_list', { p_refka: id, p_after: last });
          if (!alive) return;
          if (first) { const l = scr.querySelector('.loading'); if (l) l.remove(); if (!ms.length) scr.appendChild(h('div', { class: 'sys', id: 'chatempty' }, t('chatEmpty'))); }
          if (ms.length) { const e0 = scr.querySelector('#chatempty'); if (e0) e0.remove(); }
          addMsgs(ms); first = false; errBox.classList.add('hidden');
        } catch (e) {
          if (!alive) return;
          const c = errCode(e);
          if (c === 'not_auth') { alive = false; return hooks.authLost && hooks.authLost(); }
          if (['not_found', 'blocked', 'hidden', 'not_member'].includes(c)) close(c);
          else if (first) { errBox.textContent = errText(e); errBox.classList.remove('hidden'); }
        } finally { busy = false; }
      }
      async function send() {
        const body = ta.value.trim();
        if (!body || closed) return;
        ta.value = ''; ta.style.height = '';
        errBox.classList.add('hidden');
        const e0 = scr.querySelector('#chatempty'); if (e0) e0.remove();
        const el = h('div', { class: 'bub me pend', 'data-mine': '1' }, body);
        scr.appendChild(el); toBottom();
        try {
          const r = await rf.rpc('chat_send', { p_refka: id, p_body: body });
          seen.add(r.id); el.classList.remove('pend'); el.dataset.msg = r.id;
          el.appendChild(h('small', null, ftime(r.at)));
        } catch (e) {
          const c = errCode(e);
          el.classList.add('fail');
          if (['not_found', 'blocked', 'hidden', 'not_member'].includes(c)) { el.remove(); return close(c); }
          const again = h('button', { type: 'button', class: 'linkb', style: { color: 'inherit', 'min-height': '32px', 'text-decoration': 'underline' }, onclick: () => { el.remove(); ta.value = body; send(); } }, t('resend'));
          el.appendChild(h('small', null, t('sendFail') + ' · ', again));
          errBox.textContent = c === 'limit' ? t('limitChat') : errText(e); errBox.classList.remove('hidden');
        }
      }
      sendB.onclick = send;
      ta.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); send(); } });
      ta.addEventListener('input', () => { ta.style.height = 'auto'; ta.style.height = Math.min(110, ta.scrollHeight + 2) + 'px'; });
      const onVis = () => { if (document.visibilityState === 'visible') poll(); };
      document.addEventListener('visibilitychange', onVis);
      poll();
      timer = setInterval(poll, 4000);       // only runs while this screen is open; poll() skips hidden pages
      return () => { alive = false; clearInterval(timer); document.removeEventListener('visibilitychange', onVis); };
    },
  };
};
export { showErr, clearErr };
