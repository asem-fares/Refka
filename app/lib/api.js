// Shared Refka client. One rule: every data call is rf.rpc(name, args). No table access from the front end.
// Requires supabase-js UMD (window.supabase) and app/config.js loaded first.
(function () {
  const cfg = window.REFKA_CONFIG;
  const sb = window.supabase.createClient(cfg.url, cfg.anon, { auth: { persistSession: true, autoRefreshToken: true } });
  class RfError extends Error { constructor(code, raw) { super(code); this.code = code; this.raw = raw; } }
  const codeOf = e => { const m = (e && (e.message || e.error_description || e.msg)) || 'unknown'; return /^[a-z_]+$/.test(m) ? m : 'unknown'; };
  function phoneDigits(p) {
    let d = String(p || '').replace(/[^\d]/g, '');
    if (d.startsWith('00')) d = d.slice(2);
    if (/^01\d{9}$/.test(d)) d = '2' + d;          // Egyptian local form
    return d;
  }
  const phoneEmail = p => 'p' + phoneDigits(p) + '@m.refka.tech';
  const validPhone = p => /^\d{10,15}$/.test(phoneDigits(p));
  const validPin = p => /^\d{6}$/.test(String(p || ''));
  async function rpc(name, args) {
    const { data, error } = await sb.rpc(name, args || {});
    if (error) throw new RfError(codeOf(error), error);
    return data;
  }
  async function wrapAuth(p) {
    const { data, error } = await p;
    if (error) {
      const m = (error.message || '').toLowerCase();
      const code = m.includes('already') ? 'account_exists' : m.includes('invalid') ? 'bad_login' : m.includes('rate') ? 'slow_down' : 'auth_failed';
      throw new RfError(code, error);
    }
    return data;
  }
  window.rf = {
    sb, rpc, RfError, phoneDigits, validPhone, validPin,
    session: async () => (await sb.auth.getSession()).data.session,
    signOut: () => sb.auth.signOut(),
    ownerSignUp: (email, password, name) => wrapAuth(sb.auth.signUp({ email, password, options: { data: { kind: 'owner', name } } })),
    ownerSignIn: (email, password) => wrapAuth(sb.auth.signInWithPassword({ email, password })),
    memberSignUp: (phone, pin) => wrapAuth(sb.auth.signUp({ email: phoneEmail(phone), password: String(pin), options: { data: { kind: 'member', phone: '+' + phoneDigits(phone) } } })),
    memberSignIn: (phone, pin) => wrapAuth(sb.auth.signInWithPassword({ email: phoneEmail(phone), password: String(pin) })),
  };
})();
