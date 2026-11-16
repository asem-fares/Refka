// Test only: an in-page stand-in for app/lib/api.js (window.rf) that follows CONTRACT.md and the shapes in
// supabase/migrations/0002_functions.sql. Used by e2e.js when RF_MOCK=1 (no backend running). State lives in localStorage.
(function () {
  class RfError extends Error { constructor(code, raw) { super(code); this.code = code; this.raw = raw; } }
  const KEY = 'rf_mock_db';
  const uid = () => 'xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx'.replace(/x/g, () => (Math.random() * 16 | 0).toString(16));
  const iso = d => d.toISOString().slice(0, 10);
  const day = n => iso(new Date(Date.now() + n * 864e5));
  const ago = min => new Date(Date.now() - min * 6e4).toISOString();
  function seed() {
    const g = uid(), u = 'u-atlas', pk1 = uid(), pk3 = uid();
    const m = (name, phone, gender, status, pk, ends, joined) => ({ id: uid(), gym_id: g, name, phone, gender, status, package_id: pk, starts: day(-20), ends, user_id: joined ? uid() : null });
    const ms = [m('Omar Hassan', '+201001110001', 'm', 'active', pk1, day(12), true), m('منى سعيد', '+201001110002', 'f', 'active', pk3, day(3), true),
      m('Karim Adel', '+201001110003', 'm', 'listed', pk1, day(-5), false), m('Youssef Nabil', '+201001110004', 'm', 'guest', null, null, true), m('سارة علي', '+201001110005', 'f', 'guest', null, null, true)];
    return {
      session: null,
      users: [{ id: u, email: 'owner@atlas.test', password: 'atlas1234', kind: 'owner' }],
      gyms: [{ id: g, slug: 'atlas', name: 'Atlas Gym', name_ar: 'أطلس جيم', country: 'EG', currency: 'EGP', brand: { primary: '#0D6B6E', accent: '#B07A1F' }, settings: { cross: true, posts: 'approve' }, pay: { instapay: 'atlas@instapay', cash: true }, status: 'live', owner_id: u, created_at: ago(9999) }],
      packages: [{ id: pk1, gym_id: g, name: '1 month', name_ar: 'شهر', months: 1, price: 600, before_price: null, until: null, active: true, sort: 1 },
        { id: pk3, gym_id: g, name: '3 months', name_ar: '3 شهور', months: 3, price: 1500, before_price: 1800, until: day(20), active: true, sort: 3 }],
      members: ms,
      payments: [{ id: uid(), gym_id: g, membership_id: ms[0].id, package_id: pk1, amount: 600, method: 'instapay', ref: 'IP-778812', status: 'pending', at: ago(50) },
        { id: uid(), gym_id: g, membership_id: ms[1].id, package_id: pk3, amount: 1500, method: 'cash', ref: null, status: 'pending', at: ago(30) }],
      posts: [{ id: uid(), gym_id: g, name: 'Omar Hassan', body: 'New personal best on deadlift today!', img: null, status: 'pending', at: ago(20) },
        { id: uid(), gym_id: g, name: 'منى سعيد', body: 'مين نازل يتمرن بكرة الصبح؟', img: null, status: 'pending', at: ago(10) },
        { id: uid(), gym_id: g, name: 'Karim Adel', body: 'Selling supplements, call me', img: null, status: 'live', at: ago(300) }],
      reports: [], checkins: [],
    };
  }
  let db;
  try { db = JSON.parse(localStorage.getItem(KEY)); } catch (e) { db = null; }
  if (!db) { db = seed(); db.reports.push({ id: uid(), gym_id: db.gyms[0].id, name: 'منى سعيد', reason: 'Spam', about_user: null, post_id: db.posts[2].id, status: 'open', at: ago(5) }); }
  const save = () => localStorage.setItem(KEY, JSON.stringify(db));
  save();
  const fail = c => { throw new RfError(c, { message: c }); };
  const me = () => (db.session ? db.users.find(u => u.id === db.session.user.id) : null) || fail('not_auth');
  const gymOf = () => db.gyms.find(g => g.owner_id === me().id);
  const need = () => gymOf() || fail('not_owner');
  const gj = g => { const o = Object.assign({}, g); delete o.owner_id; return o; };
  const brief = id => { const p = db.packages.find(x => x.id === id); return p ? { id: p.id, name: p.name, name_ar: p.name_ar, months: p.months } : null; };
  const checkLive = g => {
    if (!db.packages.some(p => p.gym_id === g.id && p.active)) fail('need_package');
    if (!(g.pay.cash || g.pay.instapay || g.pay.wallet)) fail('need_pay');
  };
  const phone = p => { let d = String(p || '').replace(/[^\d]/g, ''); if (/^01\d{9}$/.test(d)) d = '2' + d; return /^\d{10,15}$/.test(d) ? '+' + d : null; };
  const addM = (iso0, n) => { const d = new Date(iso0 + 'T12:00:00Z'); d.setUTCMonth(d.getUTCMonth() + n); return iso(d); };
  const F = {
    gym_public({ p_slug }) { const g = db.gyms.find(x => x.slug === String(p_slug).toLowerCase() && x.status === 'live'); return g ? { id: g.id, slug: g.slug, name: g.name, name_ar: g.name_ar, brand: g.brand, status: g.status, packages: [] } : null; },
    owner_create_gym({ p_name, p_name_ar, p_slug }) {
      const u = me(), s = String(p_slug || '').toLowerCase();
      if (!p_name || p_name.length < 2) fail('bad_input');
      if (!/^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/.test(s) || s.includes('--') || ['app', 'admin', 'api', 'refka', 'owner', 'www'].includes(s)) fail('slug_bad');
      if (gymOf()) fail('dup');
      if (db.gyms.some(g => g.slug === s)) fail('slug_taken');
      const g = { id: uid(), slug: s, name: p_name, name_ar: p_name_ar, country: 'EG', currency: 'EGP', brand: {}, settings: { cross: true, posts: 'all' }, pay: { cash: false }, status: 'draft', owner_id: u.id, created_at: new Date().toISOString() };
      db.gyms.push(g); return gj(g);
    },
    owner_get_gym() {
      me(); const g = gymOf(); if (!g) return null;
      const ms = db.members.filter(m => m.gym_id === g.id), c = s => ms.filter(m => m.status === s).length;
      return { gym: gj(g), packages: db.packages.filter(p => p.gym_id === g.id), counts: { members: c('listed') + c('active'), active: c('active'), listed: c('listed'), guests: c('guest') } };
    },
    owner_update_gym({ p_patch }) {
      const g = need();
      for (const k in p_patch) {
        if (!['name', 'name_ar', 'brand', 'settings', 'pay'].includes(k)) fail('bad_input');
        if (k === 'name' || k === 'name_ar') g[k] = p_patch[k];
        else { g[k] = Object.assign({}, g[k], p_patch[k]); for (const x in g[k]) if (g[k][x] == null) delete g[k][x]; }
      }
      if (g.status === 'live') checkLive(g);
      return gj(g);
    },
    owner_upsert_package({ p }) {
      const g = need(); let r = p.id ? db.packages.find(x => x.id === p.id && x.gym_id === g.id) : null;
      if (p.id && !r) fail('not_found');
      const n = Object.assign({ active: true, sort: 0, before_price: null, until: null }, r, p);
      if (!n.name || !(n.months >= 1 && n.months <= 36) || !(n.price > 0)) fail('bad_input');
      if (n.before_price != null) { if (!n.until) fail('before_needs_until'); if (n.before_price <= n.price) fail('bad_input'); }
      if (r) Object.assign(r, n); else { r = Object.assign(n, { id: uid(), gym_id: g.id }); db.packages.push(r); }
      if (g.status === 'live') checkLive(g);
      return r;
    },
    owner_delete_package({ p_id }) {
      const g = need(), i = db.packages.findIndex(x => x.id === p_id && x.gym_id === g.id); if (i < 0) fail('not_found');
      const keep = db.packages.slice(); db.packages.splice(i, 1);
      if (g.status === 'live') { try { checkLive(g); } catch (e) { db.packages = keep; throw e; } }
      return { ok: true };
    },
    owner_import_members({ p_rows }) {
      const g = need(); let added = 0, updated = 0; const errors = [];
      p_rows.forEach((r, i) => {
        const ph = phone(r.phone);
        if (!ph) return errors.push({ row: i, code: 'bad_phone' });
        if (!r.name || r.name.trim().length < 2 || r.name.length > 60) return errors.push({ row: i, code: 'bad_name' });
        if (r.package_id && !db.packages.some(p => p.id === r.package_id && p.gym_id === g.id)) return errors.push({ row: i, code: 'bad_package' });
        const m = db.members.find(x => x.gym_id === g.id && x.phone === ph);
        if (m) { Object.assign(m, { name: r.name, gender: r.gender || m.gender, package_id: r.package_id || m.package_id, ends: r.ends || m.ends }); updated++; }
        else { db.members.push({ id: uid(), gym_id: g.id, name: r.name, phone: ph, gender: r.gender || null, status: 'listed', package_id: r.package_id || null, starts: r.starts || null, ends: r.ends || null, user_id: null }); added++; }
      });
      return { added, updated, errors };
    },
    owner_go_live() { const g = need(); checkLive(g); g.status = 'live'; return gj(g); },
    owner_home() {
      const g = need(), mem = id => db.members.find(m => m.id === id) || {}, needs = [];
      db.payments.filter(p => p.gym_id === g.id && p.status === 'pending').forEach(p => needs.push({ k: 'pay', id: p.id, at: p.at, name: mem(p.membership_id).name, phone: mem(p.membership_id).phone, amount: p.amount, method: p.method, ref: p.ref, package: brief(p.package_id), ends: mem(p.membership_id).ends }));
      db.members.filter(m => m.gym_id === g.id && m.status === 'guest').forEach(m => needs.push({ k: 'guest', id: m.id, at: ago(40), name: m.name, phone: m.phone, gender: m.gender }));
      db.reports.filter(r => r.gym_id === g.id && r.status === 'open').forEach(r => { const po = db.posts.find(x => x.id === r.post_id); needs.push({ k: 'report', id: r.id, at: r.at, name: r.name, reason: r.reason, about: null, post: po ? { id: po.id, body: po.body, img: po.img, status: po.status, at: po.at } : null }); });
      db.posts.filter(p => p.gym_id === g.id && p.status === 'pending').forEach(p => needs.push({ k: 'post', id: p.id, at: p.at, name: p.name, body: p.body, img: p.img }));
      const ms = db.members.filter(m => m.gym_id === g.id && m.status !== 'guest'), cs = db.checkins.filter(c => c.gym_id === g.id);
      return { gym: gj(g), needs, stats: { members: ms.length, active_now: new Set(cs.map(c => c.membership_id)).size, checkins_today: cs.length, expiring_7d: ms.filter(m => m.ends && m.ends >= day(0) && m.ends <= day(7)).length, refkas: 0 } };
    },
    owner_members({ p_q }) {
      const g = need(), q = String(p_q || '').toLowerCase().trim(), dg = q.replace(/[^\d]/g, '').replace(/^0/, '');
      return db.members.filter(m => m.gym_id === g.id && (!q || m.name.toLowerCase().includes(q) || (dg && m.phone.includes(dg)))).sort((a, b) => a.name.localeCompare(b.name))
        .map(m => ({ id: m.id, name: m.name, phone: m.phone, gender: m.gender, status: m.status, package: brief(m.package_id), starts: m.starts, ends: m.ends, joined: !!m.user_id, last_checkin: (db.checkins.filter(c => c.membership_id === m.id).pop() || {}).at || null }));
    },
    owner_decide_payment({ p_id, p_ok }) {
      const g = need(), p = db.payments.find(x => x.id === p_id && x.gym_id === g.id && x.status === 'pending'); if (!p) fail('not_found');
      if (p_ok) { const m = db.members.find(x => x.id === p.membership_id), pk = db.packages.find(x => x.id === p.package_id); m.package_id = pk.id; m.ends = addM(m.ends && m.ends > day(0) ? m.ends : day(0), pk.months); }
      p.status = p_ok ? 'ok' : 'rejected'; return { ok: true };
    },
    owner_decide_guest({ p_membership_id, p_ok, p_package_id, p_ends }) {
      const g = need(), m = db.members.find(x => x.id === p_membership_id && x.gym_id === g.id && x.status === 'guest'); if (!m) fail('not_found');
      if (!p_ok) { db.members = db.members.filter(x => x !== m); return { ok: true }; }
      if (p_ends && p_ends < day(0)) fail('bad_input');
      Object.assign(m, { status: 'active', package_id: p_package_id || null, starts: day(0), ends: p_ends || null }); return { ok: true, ends: m.ends };
    },
    owner_decide_post({ p_id, p_action }) { const g = need(), p = db.posts.find(x => x.id === p_id && x.gym_id === g.id); if (!p) fail('not_found'); p.status = p_action === 'approve' ? 'live' : 'hidden'; return { ok: true }; },
    owner_resolve_report({ p_id }) { const g = need(), r = db.reports.find(x => x.id === p_id && x.gym_id === g.id); if (!r) fail('not_found'); r.status = 'done'; return { ok: true }; },
    owner_scan({ p_token }) {
      const g = need(), parts = String(p_token || '').trim().split('.');
      if (parts.length !== 4 || parts[0] !== 'rf1') fail('bad_input');
      const m = db.members.find(x => x.id === parts[1] && x.gym_id === g.id); if (!m) fail('bad_input');
      if (parts[3] === 'old') fail('expired');
      if (m.status !== 'active' || (m.ends && m.ends < day(0))) return { ok: false, valid: false, name: m.name, ends: m.ends, already: false };
      db.checkins.push({ gym_id: g.id, membership_id: m.id, at: new Date().toISOString() });
      return { ok: true, valid: true, name: m.name, ends: m.ends, already: false };
    },
    owner_checkin({ p_membership_id }) {
      const g = need(), m = db.members.find(x => x.id === p_membership_id && x.gym_id === g.id); if (!m) fail('not_found');
      if (m.status === 'guest') fail('not_member'); if (m.ends && m.ends < day(0)) fail('expired');
      db.checkins.push({ gym_id: g.id, membership_id: m.id, at: new Date().toISOString() }); return { ok: true, already: false };
    },
  };
  const wait = ms => new Promise(r => setTimeout(r, ms));
  async function rpc(name, args) {
    await wait(60);
    if (!F[name]) fail('unknown');
    try { return JSON.parse(JSON.stringify(F[name](args || {}) ?? null)); } finally { save(); }
  }
  const sess = u => ({ access_token: 'mock', user: { id: u.id, email: u.email, user_metadata: { kind: u.kind, name: u.name } } });
  window.rf = {
    sb: null, rpc, RfError, mock: true,
    session: async () => db.session,
    signOut: async () => { db.session = null; save(); },
    ownerSignUp: async (email, password, name) => {
      await wait(60);
      if (db.users.some(u => u.email === email)) fail('account_exists');
      const u = { id: uid(), email, password, name, kind: 'owner' }; db.users.push(u); db.session = sess(u); save(); return { session: db.session, user: db.session.user };
    },
    ownerSignIn: async (email, password) => {
      await wait(60);
      const u = db.users.find(x => x.email === email && x.password === password); if (!u) fail('bad_login');
      db.session = sess(u); save(); return { session: db.session, user: db.session.user };
    },
  };
})();
