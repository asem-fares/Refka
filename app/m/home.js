// Home tab, renew flow and the gym page.
import { t, L, fdate, money, months } from './i18n.js';
import { h, fill, icon, btn, tag, note, gate, chips, field, act, load, toast, copyText, qrSvg, gymLogo, applyGym } from './ui.js';
import { S, rf, screens, hooks, push, back, gymName, gid, firstName } from './core.js';

export function memState(m) {
  if (!m || m.status === 'guest') return 'guest';
  if (m.days_left != null && m.days_left < 0) return 'ended';
  if (m.days_left != null && m.days_left <= 7) return 'soon';
  return 'active';
}
export async function fetchHome() {
  const d = await rf.rpc('member_home', { p_gym: gid() });
  S.home = d;
  if (d && d.gym) { S.gym = { ...S.gym, ...d.gym }; applyGym(S.gym.brand); }
  if (d && d.membership && S.ms) S.ms = { ...S.ms, ...d.membership };
  return d;
}
const pkgName = p => (p ? L(p.name, p.name_ar) : '');
const cur = () => (S.gym && S.gym.currency) || 'EGP';

/* ---------- Home ---------- */
screens.home = () => ({
  title: gymName(),
  build(scr) {
    let qrTimer = 0, tick = 0, alive = true;
    const box = h('div', { class: 'col' });
    scr.appendChild(h('h2', { class: 'big', id: 'greet' }, t('hi', { n: firstName() })));
    scr.appendChild(box);

    function paint(d) {
      clearTimeout(qrTimer); clearInterval(tick);
      const m = d.membership, st = memState(m);
      const stTag = { guest: ['st_guest', 'warn'], ended: ['st_ended', 'bad'], soon: ['st_soon', 'warn'], active: ['st_active', 'ok'] }[st];
      const card = h('section', { class: 'card g mem', id: 'memcard' },
        h('div', { class: 'between' }, h('span', { class: 'mu' }, t('memH')), tag(t(stTag[0]), stTag[1])),
        h('h3', null, st === 'guest' ? t('st_guest') : (pkgName(m.package) || t('st_none'))));
      if (st === 'guest') card.appendChild(h('p', { class: 'mu' }, t('guestCard', { g: gymName() })));
      else if (m.ends == null) card.appendChild(h('p', { class: 'mu' }, t('noEnd')));
      else if (st === 'ended') card.appendChild(h('p', { class: 'mu' }, t('endedOn', { d: fdate(m.ends) })));
      else card.appendChild(h('div', { class: 'between' },
        m.days_left === 0 ? h('b', null, t('lastDay')) : h('div', { class: 'row' }, h('span', { class: 'days' }, String(m.days_left)), h('span', { class: 'mu' }, t('daysLeft'))),
        h('span', { class: 'mu' }, t('endsOn', { d: fdate(m.ends) }))));

      const kids = [card];
      if (d.pending_payment) kids.push(h('section', { class: 'card warn', id: 'paywait' }, h('h3', null, t('rnWait', { g: gymName() })), h('p', { class: 'mu' }, t('rnWaitP'))));

      // QR
      const qr = h('section', { class: 'card', id: 'qrcard' }, h('h3', null, t('qrH')));
      if (d.qr && d.qr.token && typeof window.qrcode === 'function') {
        const left = h('span', { class: 'cnt' });
        qr.appendChild(h('div', { class: 'qrbox', id: 'qr', 'data-token': d.qr.token }, qrSvg(d.qr.token)));
        qr.appendChild(note(t('qrP')));
        qr.appendChild(h('div', { class: 'between errhost' }, left));
        const ttl = Math.max(2, Math.min(60, Number(d.qr.ttl) || (Number(d.qr.exp) - Date.now() / 1000) || 60));
        const until = Date.now() + ttl * 1000;
        const upd = () => { left.textContent = t('codeIn', { s: Math.max(0, Math.round((until - Date.now()) / 1000)) }); };
        upd(); tick = setInterval(upd, 1000);
        qrTimer = setTimeout(refresh, Math.max(1500, ttl * 1000 - 1500));
      } else {
        qr.appendChild(gate(st === 'guest' ? t('qrGuest', { g: gymName() }) : st === 'ended' ? t('qrExpired') : t('qrNone'), 'qr'));
        if (st !== 'guest' && st !== 'ended') { const again = btn(t('qrNew'), () => act(again, async () => paint(await fetchHome())), 'sec sm'); qr.appendChild(h('div', { class: 'errhost' }, again)); }
      }
      kids.push(qr);

      kids.push(h('div', { class: 'stats' },
        h('div', { class: 'stat', id: 'herenow' }, h('b', null, String(d.here_now || 0)), h('span', null, t('hereNow'))),
        h('div', { class: 'stat', id: 'weekins' }, h('b', null, String(d.week_checkins || 0)), h('span', null, t('weekIns')))));
      if (!d.pending_payment) kids.push(btn(m.package ? t('renew') : t('payFirst'), () => push('renew'), 'wide ' + (st === 'ended' || st === 'soon' || st === 'guest' ? 'gold' : 'sec'), { id: 'renewbtn' }));
      kids.push(h('div', { class: 'card', style: { gap: '0', 'padding-block': '2px' } },
        h('button', { type: 'button', class: 'li', id: 'aboutgym', onclick: () => push('gym') }, h('span', { class: 'ic' }, icon('gym')), h('b', { class: 'grow' }, t('aboutGym', { g: gymName() })), h('span', { class: 'chev' }, icon('chev')))));
      fill(box, kids);
    }
    async function refresh() {
      if (!alive) return;
      if (document.visibilityState !== 'visible') return;      // resumes from the visibility handler
      try { const d = await fetchHome(); if (alive) paint(d); }
      catch (e) {
        if (!alive) return;
        clearInterval(tick);
        const q = box.querySelector('#qr'); if (q) q.remove();
        const host = box.querySelector('#qrcard');
        if (host) { const again = btn(t('qrNew'), () => act(again, async () => paint(await fetchHome())), 'sec sm'); host.appendChild(h('div', { class: 'errhost col' }, h('div', { class: 'err', role: 'alert' }, t('qrFail')), again)); }
      }
    }
    const onVis = () => { if (document.visibilityState === 'visible' && alive && S.home) refresh(); };
    document.addEventListener('visibilitychange', onVis);
    if (S.home) paint(S.home);
    load(box, fetchHome, paint);
    if (hooks.badge) hooks.badge();
    return () => { alive = false; clearTimeout(qrTimer); clearInterval(tick); document.removeEventListener('visibilitychange', onVis); };
  },
});

/* ---------- Renew ---------- */
function payMethods() {
  const p = (S.gym && S.gym.pay) || {};
  const out = [];
  if (p.instapay && String(p.instapay).trim()) out.push(['instapay', t('payInsta')]);
  if (p.wallet && String(p.wallet).trim()) out.push(['wallet', t('payWallet')]);
  if (p.cash === true) out.push(['cash', t('payDesk')]);
  return out;
}
function copyRow(value, id) {
  const b = btn(t('copy'), async () => { const ok = await copyText(String(value)); if (ok) { b.textContent = t('copied'); toast(t('copied')); setTimeout(() => { b.textContent = t('copy'); }, 1800); } }, 'sec sm');
  return h('div', { class: 'copyrow', id }, h('b', { class: 'ltr' }, String(value)), b);
}
function pkgCard(p, sel, onclick) {
  return h(onclick ? 'button' : 'div', { type: onclick ? 'button' : null, class: 'card' + (sel ? ' sel' : ''), 'data-pkg': p.id, 'aria-pressed': onclick ? (sel ? 'true' : 'false') : null, onclick },
    h('div', { class: 'between' }, h('b', { class: 'wrapany' }, pkgName(p)),
      h('span', null, p.before_price ? h('span', { class: 'strike' }, money(p.before_price, cur())) : null, h('span', { class: 'price' }, money(p.price, cur())))),
    h('div', { class: 'between' }, h('span', { class: 'mu' }, months(p.months)), p.before_price && p.until ? tag(t('offerUntil', { d: fdate(p.until) }), 'gold') : null));
}

screens.renew = () => ({
  title: t('rnH', { g: gymName() }),
  build(scr) {
    const box = h('div', { class: 'col' });
    scr.appendChild(box);
    const st = { pkg: null, method: null };
    function waiting() {
      fill(box, h('section', { class: 'card warn center', id: 'paywait' }, h('span', { class: 'bigic' }, icon('clock', 32)), h('h3', null, t('rnWait', { g: gymName() })), h('p', { class: 'mu' }, t('rnWaitP'))), btn(t('back'), back, 'sec wide'));
    }
    function paint(d) {
      if (d.pending_payment) return waiting();
      const pkgs = (S.gym.packages || []), methods = payMethods();
      if (!pkgs.length) return fill(box, gate(t('noPkgs', { g: gymName() }), 'info'), btn(t('back'), back, 'sec wide'));
      if (!methods.length) return fill(box, gate(t('noPay', { g: gymName() }), 'info'), btn(t('back'), back, 'sec wide'));
      if (!st.pkg || !pkgs.some(p => p.id === st.pkg)) st.pkg = pkgs.length === 1 ? pkgs[0].id : null;
      if (!st.method || !methods.some(m => m[0] === st.method)) st.method = methods.length === 1 ? methods[0][0] : null;
      const list = h('div', { class: 'col', id: 'pkgs' });
      const detail = h('div', { class: 'col', id: 'paydetail' });
      const ref = h('input', { class: 'in num', type: 'text', name: 'ref', maxlength: '60', autocomplete: 'off', autocapitalize: 'off' });
      const err = h('div', { class: 'err', role: 'alert' });
      const send = btn('', null, 'wide', { type: 'submit', id: 'rnsend' });
      const paintPk = () => fill(list, pkgs.map(p => pkgCard(p, st.pkg === p.id, () => { st.pkg = p.id; paintPk(); paintDetail(); })));
      function paintDetail() {
        const p = pkgs.find(x => x.id === st.pkg);
        const amt = p ? money(p.price, cur()) : '';
        send.textContent = st.method === 'cash' ? t('cashGo') : t('sendProof', { g: gymName() });
        if (!st.method || !p) return fill(detail);
        if (st.method === 'cash') return fill(detail, h('div', { class: 'card' }, h('p', null, t('cashP', { a: amt }))));
        fill(detail, h('div', { class: 'h2' }, t('rn3')), h('div', { class: 'card' },
          h('p', null, st.method === 'instapay' ? t('instaTo', { a: amt }) : t('walletTo', { a: amt })),
          copyRow(S.gym.pay[st.method], 'payaddr'),
          field(t('ref'), ref, t('refH'))));
      }
      const meth = chips(methods, v => v === st.method, v => { st.method = v; paintDetail(); }, { id: 'methods', 'aria-label': t('rn2') });
      const form = h('form', { class: 'col errhost', novalidate: true, onsubmit: ev => {
        ev.preventDefault(); err.textContent = '';
        if (!st.pkg || !st.method) { err.textContent = t('e_pick'); return; }
        const r = ref.value.replace(/\s+/g, ' ').trim();
        if (st.method !== 'cash' && r.length < 4) { err.textContent = t('e_ref'); ref.focus(); return; }
        act(send, async () => {
          try { await rf.rpc('member_renew', { p_gym: gid(), p_package_id: st.pkg, p_method: st.method, p_ref: st.method === 'cash' ? null : r }); }
          catch (e) { if (e && e.code === 'pending_exists') { S.home.pending_payment = true; waiting(); } throw e; }
          S.home.pending_payment = true; waiting(); toast(t('rnSent', { g: gymName() }));
        });
      } },
      S.ms && S.ms.status === 'guest' ? note(t('rnGuest')) : null,
      h('div', { class: 'h2' }, t('rn1')), list, h('div', { class: 'h2' }, t('rn2')), meth, detail, err, send);
      paintPk(); paintDetail();
      fill(box, form);
    }
    load(box, fetchHome, paint);
  },
});

/* ---------- Gym page ---------- */
screens.gym = () => ({
  title: t('aboutGym', { g: gymName() }),
  build(scr) {
    const box = h('div', { class: 'col' });
    scr.appendChild(box);
    function paint() {
      const pkgs = S.gym.packages || [], pay = S.gym.pay || {};
      const kids = [h('section', { class: 'card g center' }, gymLogo(S.gym, 'big'), h('h2', { class: 'big' }, gymName()))];
      kids.push(h('div', { class: 'h2' }, t('pkgs')));
      if (pkgs.length) pkgs.forEach(p => kids.push(pkgCard(p, false, null))); else kids.push(gate(t('noPkgs', { g: gymName() }), 'info'));
      kids.push(h('div', { class: 'h2' }, t('howPay')));
      const ways = [];
      if (pay.instapay && String(pay.instapay).trim()) ways.push(h('div', { class: 'fld' }, h('div', { class: 'lbl' }, t('payInstaL')), copyRow(pay.instapay)));
      if (pay.wallet && String(pay.wallet).trim()) ways.push(h('div', { class: 'fld' }, h('div', { class: 'lbl' }, t('payWalletL')), copyRow(pay.wallet)));
      if (pay.cash === true) ways.push(h('p', null, t('payCashL')));
      kids.push(ways.length ? h('section', { class: 'card', id: 'howpay' }, ways) : gate(t('noPay', { g: gymName() }), 'info'));
      kids.push(btn(S.ms && S.ms.package ? t('renew') : t('payFirst'), () => push('renew'), 'wide'));
      fill(box, kids);
    }
    if (S.home) paint(); else load(box, fetchHome, paint);
  },
});
