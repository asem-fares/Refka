// Shared by dev/server.js, dev/seed.js and supabase/tests/run.js. Local development only.
'use strict';
const crypto = require('crypto');
const { Pool } = require('pg');

const PG = {
  host: process.env.REFKA_PGHOST || '127.0.0.1',
  port: Number(process.env.REFKA_PGPORT || 55432),
  user: process.env.REFKA_PGUSER || 'postgres',
  password: process.env.REFKA_PGPASSWORD || undefined,
};
const ANON_KEY = process.env.REFKA_ANON_KEY || 'dev-anon-key';
const JWT_SECRET = process.env.REFKA_JWT_SECRET || 'refka-local-dev-jwt-secret-not-for-production';

function makePool(database) {
  const pool = new Pool({ ...PG, database: database || process.env.REFKA_DB || 'refka', max: 10 });
  pool.on('error', () => {}); // idle connections die when the database is reset; the pool reconnects
  return pool;
}

// ---- passwords (scrypt) and tokens
function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  return 'scrypt$' + salt.toString('hex') + '$' + crypto.scryptSync(String(pw), salt, 32).toString('hex');
}
function checkPassword(pw, stored) {
  const p = String(stored || '').split('$');
  if (p.length !== 3 || p[0] !== 'scrypt') return false;
  const want = Buffer.from(p[2], 'hex');
  const got = crypto.scryptSync(String(pw), Buffer.from(p[1], 'hex'), 32);
  return want.length === got.length && crypto.timingSafeEqual(want, got);
}
const b64u = b => Buffer.from(b).toString('base64url');
function signJwt(payload) {
  const head = b64u(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64u(JSON.stringify(payload));
  const sig = crypto.createHmac('sha256', JWT_SECRET).update(head + '.' + body).digest('base64url');
  return head + '.' + body + '.' + sig;
}
// returns the payload, or null (bad token), or {expired:true}
function verifyJwt(token) {
  const p = String(token || '').split('.');
  if (p.length !== 3) return null;
  const sig = crypto.createHmac('sha256', JWT_SECRET).update(p[0] + '.' + p[1]).digest();
  let got;
  try { got = Buffer.from(p[2], 'base64url'); } catch { return null; }
  if (got.length !== sig.length || !crypto.timingSafeEqual(got, sig)) return null;
  let payload;
  try { payload = JSON.parse(Buffer.from(p[1], 'base64url').toString('utf8')); } catch { return null; }
  if (!payload || typeof payload !== 'object') return null;
  if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return { expired: true };
  return payload;
}

// claims the SQL functions see through auth.jwt(), same shape as a Supabase access token
function claimsFor(user) {
  return { sub: user.id, role: 'authenticated', aud: 'authenticated', email: user.email,
    user_metadata: user.raw_user_meta_data || user.user_metadata || {},
    app_metadata: { provider: 'email', providers: ['email'] } };
}

class RpcError extends Error {
  constructor(status, body) { super(body.message); this.status = status; this.body = body; this.code = body.message; }
}

// Calls public.<fn>(named args) the way PostgREST does: inside a transaction, as role anon or authenticated,
// with request.jwt.claims set. claims = null means anon.
async function rpc(pool, claims, fn, args) {
  args = args || {};
  if (!/^[a-z_]+$/.test(fn)) throw new RpcError(404, { code: 'PGRST202', message: 'function not found', details: null, hint: null });
  const client = await pool.connect();
  try {
    const meta = await client.query(
      `select p.proargnames as names, p.provolatile as vol,
              array(select format_type(t, null) from unnest(p.proargtypes) with ordinality as x(t, i) order by i) as types
       from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and p.proname = $1`, [fn]);
    if (meta.rows.length !== 1) throw new RpcError(404, { code: 'PGRST202', message: 'Could not find the function public.' + fn + ' in the schema cache', details: null, hint: null });
    const names = meta.rows[0].names || [], types = meta.rows[0].types || [];
    const parts = [], vals = [];
    for (const k of Object.keys(args)) {
      const i = names.indexOf(k);
      if (i < 0 || i >= types.length) throw new RpcError(404, { code: 'PGRST202', message: 'Could not find the function public.' + fn + '(' + Object.keys(args).join(', ') + ') in the schema cache', details: null, hint: null });
      const v = args[k], t = types[i];
      vals.push(v === null || v === undefined ? null
        : (t === 'json' || t === 'jsonb' || typeof v === 'object') ? JSON.stringify(v) : String(v));
      parts.push('"' + k + '" := $' + vals.length + '::' + t);
    }
    await client.query('begin');
    try {
      // PostgREST runs STABLE and IMMUTABLE functions in a read-only transaction; do the same so a
      // function that writes but is declared stable fails here exactly as it would on Supabase.
      if (meta.rows[0].vol !== 'v') await client.query('set transaction read only');
      await client.query('set local role ' + (claims ? 'authenticated' : 'anon'));
      await client.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify(claims || { role: 'anon' })]);
      const r = await client.query('select public."' + fn + '"(' + parts.join(', ') + ') as r', vals);
      await client.query('commit');
      return r.rows[0].r;
    } catch (e) {
      await client.query('rollback').catch(() => {});
      if (e instanceof RpcError) throw e;
      const status = e.code === '42501' ? (claims ? 403 : 401) : 400;
      throw new RpcError(status, { code: e.code || 'XX000', message: e.message, details: e.detail || null, hint: e.hint || null });
    }
  } finally {
    client.release();
  }
}

module.exports = { PG, ANON_KEY, JWT_SECRET, makePool, hashPassword, checkPassword, signJwt, verifyJwt, claimsFor, rpc, RpcError };
