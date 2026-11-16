#!/usr/bin/env node
// Local stand-in for the parts of Supabase the Refka front end uses through supabase-js v2:
//   /auth/v1/*  (signup, token, user, logout)   /rest/v1/rpc/<fn>   plus the static site on the same origin.
// Development only. Start: node dev/server.js   (needs dev/db.sh start + reset, or node dev/seed.js)
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const C = require('./common');

const PORT = Number(process.env.REFKA_PORT || 54321);
const SITE_ROOT = path.resolve(__dirname, '..');
const TOKEN_TTL = 3600;
const pool = C.makePool();

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'apikey, authorization, content-type, x-client-info, prefer, accept-profile, content-profile, x-supabase-api-version, accept, range',
  'Access-Control-Expose-Headers': 'content-range, content-profile',
  'Access-Control-Max-Age': '86400',
};

function send(res, status, body, headers) {
  const data = body === undefined ? '' : (Buffer.isBuffer(body) ? body : JSON.stringify(body));
  res.writeHead(status, { ...CORS, ...(body === undefined ? {} : { 'Content-Type': 'application/json; charset=utf-8' }), ...(headers || {}) });
  res.end(data);
}

function readBody(req, limit = 2 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = []; let n = 0;
    req.on('data', c => { n += c.length; if (n > limit) { reject(Object.assign(new Error('too large'), { status: 413 })); req.destroy(); } else chunks.push(c); });
    req.on('end', () => {
      const s = Buffer.concat(chunks).toString('utf8');
      if (!s.trim()) return resolve({});
      try { const j = JSON.parse(s); resolve(j && typeof j === 'object' ? j : {}); }
      catch { reject(Object.assign(new Error('bad json'), { status: 400 })); }
    });
    req.on('error', reject);
  });
}

const bearer = req => { const m = /^Bearer\s+(.+)$/i.exec(req.headers.authorization || ''); return m ? m[1].trim() : (req.headers.apikey || ''); };

// ------------------------------------------------------------------ auth
function userJson(u) {
  const t = new Date(u.created_at).toISOString();
  return { id: u.id, aud: 'authenticated', role: 'authenticated', email: u.email, email_confirmed_at: t, phone: '',
    confirmed_at: t, last_sign_in_at: u.last_sign_in_at ? new Date(u.last_sign_in_at).toISOString() : t,
    app_metadata: { provider: 'email', providers: ['email'] }, user_metadata: u.raw_user_meta_data || {},
    identities: [], created_at: t, updated_at: t, is_anonymous: false };
}
async function newSession(u) {
  const now = Math.floor(Date.now() / 1000);
  const refresh = crypto.randomBytes(24).toString('base64url');
  await pool.query('insert into auth.refresh_tokens (token, user_id) values ($1, $2)', [refresh, u.id]);
  await pool.query('update auth.users set last_sign_in_at = now() where id = $1', [u.id]);
  const access = C.signJwt({ ...C.claimsFor(u), iss: 'http://localhost:' + PORT + '/auth/v1', iat: now, exp: now + TOKEN_TTL,
    session_id: crypto.randomUUID(), is_anonymous: false });
  return { access_token: access, token_type: 'bearer', expires_in: TOKEN_TTL, expires_at: now + TOKEN_TTL, refresh_token: refresh, user: userJson(u) };
}
async function userFromReq(req) {
  const p = C.verifyJwt(bearer(req));
  if (!p || p.expired || !p.sub) return null;
  const r = await pool.query('select * from auth.users where id = $1', [p.sub]);
  return r.rows[0] || null;
}
const validEmail = e => typeof e === 'string' && e.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

async function handleAuth(req, res, url) {
  const route = url.pathname.replace(/^\/auth\/v1/, '');
  if (route === '/signup' && req.method === 'POST') {
    const b = await readBody(req);
    const email = String(b.email || '').trim().toLowerCase();
    if (!validEmail(email)) return send(res, 400, { code: 400, error_code: 'validation_failed', msg: 'Unable to validate email address: invalid format' });
    if (typeof b.password !== 'string' || b.password.length < 6) return send(res, 422, { code: 422, error_code: 'weak_password', msg: 'Password should be at least 6 characters.' });
    const meta = b.data && typeof b.data === 'object' && !Array.isArray(b.data) ? b.data : {};
    let u;
    try {
      u = (await pool.query('insert into auth.users (email, raw_user_meta_data, encrypted_password) values ($1, $2, $3) returning *',
        [email, JSON.stringify(meta), C.hashPassword(b.password)])).rows[0];
    } catch (e) {
      if (e.code === '23505') return send(res, 422, { code: 422, error_code: 'user_already_exists', msg: 'User already registered' });
      throw e;
    }
    return send(res, 200, await newSession(u));
  }
  if (route === '/token' && req.method === 'POST') {
    const b = await readBody(req);
    const grant = url.searchParams.get('grant_type');
    if (grant === 'password') {
      const email = String(b.email || '').trim().toLowerCase();
      const u = (await pool.query('select * from auth.users where email = $1', [email])).rows[0];
      if (!u || !C.checkPassword(b.password || '', u.encrypted_password)) {
        return send(res, 400, { code: 400, error_code: 'invalid_credentials', msg: 'Invalid login credentials', error: 'invalid_grant', error_description: 'Invalid login credentials' });
      }
      return send(res, 200, await newSession(u));
    }
    if (grant === 'refresh_token') {
      const r = await pool.query('delete from auth.refresh_tokens where token = $1 returning user_id', [String(b.refresh_token || '')]);
      const u = r.rows[0] && (await pool.query('select * from auth.users where id = $1', [r.rows[0].user_id])).rows[0];
      if (!u) return send(res, 400, { code: 400, error_code: 'refresh_token_not_found', msg: 'Invalid Refresh Token: Refresh Token Not Found', error: 'invalid_grant', error_description: 'Invalid Refresh Token: Refresh Token Not Found' });
      return send(res, 200, await newSession(u));
    }
    return send(res, 400, { code: 400, error_code: 'invalid_request', msg: 'unsupported_grant_type', error: 'unsupported_grant_type', error_description: 'unsupported grant type' });
  }
  if (route === '/user' && (req.method === 'GET' || req.method === 'PUT')) {
    const u = await userFromReq(req);
    if (!u) return send(res, 401, { code: 401, error_code: 'bad_jwt', msg: 'invalid JWT: unable to parse or verify signature' });
    if (req.method === 'PUT') {
      const b = await readBody(req);
      if (b.password !== undefined) {
        if (typeof b.password !== 'string' || b.password.length < 6) return send(res, 422, { code: 422, error_code: 'weak_password', msg: 'Password should be at least 6 characters.' });
        await pool.query('update auth.users set encrypted_password = $2 where id = $1', [u.id, C.hashPassword(b.password)]);
      }
      if (b.data && typeof b.data === 'object' && !Array.isArray(b.data)) {
        u.raw_user_meta_data = (await pool.query('update auth.users set raw_user_meta_data = raw_user_meta_data || $2::jsonb where id = $1 returning raw_user_meta_data',
          [u.id, JSON.stringify(b.data)])).rows[0].raw_user_meta_data;
      }
    }
    return send(res, 200, userJson(u));
  }
  if (route === '/logout' && req.method === 'POST') {
    const u = await userFromReq(req);
    if (u) await pool.query('delete from auth.refresh_tokens where user_id = $1', [u.id]);
    return send(res, 204);
  }
  if (route === '/settings' && req.method === 'GET') {
    return send(res, 200, { external: { email: true }, disable_signup: false, mailer_autoconfirm: true });
  }
  return send(res, 404, { code: 404, error_code: 'not_found', msg: 'not found' });
}

// ------------------------------------------------------------------ rest (rpc only, like the contract says)
async function handleRest(req, res, url) {
  const m = /^\/rest\/v1\/rpc\/([^/]+)$/.exec(url.pathname);
  if (!m) return send(res, 404, { code: 'PGRST205', message: 'Only /rest/v1/rpc/<function> exists here: the front end never touches tables', details: null, hint: null });
  if (req.method !== 'POST' && req.method !== 'GET') return send(res, 405, { code: 'PGRST117', message: 'Unsupported HTTP method', details: null, hint: null });
  const fn = m[1];
  if (!/^[a-z_]+$/.test(fn)) return send(res, 404, { code: 'PGRST202', message: 'function not found', details: null, hint: null });
  const tok = bearer(req);
  let claims = null;
  if (tok && tok !== C.ANON_KEY) {
    const p = C.verifyJwt(tok);
    if (!p) return send(res, 401, { code: 'PGRST301', message: 'JWSError JWSInvalidSignature', details: null, hint: null });
    if (p.expired) return send(res, 401, { code: 'PGRST303', message: 'JWT expired', details: null, hint: null });
    claims = p;
  }
  const args = req.method === 'POST' ? await readBody(req) : Object.fromEntries(url.searchParams);
  if (Array.isArray(args)) return send(res, 400, { code: 'PGRST102', message: 'arguments must be a JSON object', details: null, hint: null });
  try {
    const out = await C.rpc(pool, claims, fn, args);
    return send(res, 200, out === undefined ? null : out);
  } catch (e) {
    if (e instanceof C.RpcError) return send(res, e.status, e.body);
    throw e;
  }
}

// ------------------------------------------------------------------ static site
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif',
  '.ico': 'image/x-icon', '.avif': 'image/avif', '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.otf': 'font/otf',
  '.xml': 'application/xml; charset=utf-8', '.txt': 'text/plain; charset=utf-8', '.md': 'text/markdown; charset=utf-8',
  '.map': 'application/json; charset=utf-8', '.mp4': 'video/mp4', '.webm': 'video/webm', '.pdf': 'application/pdf', '.wasm': 'application/wasm' };

function serveStatic(req, res, url) {
  let rel;
  try { rel = decodeURIComponent(url.pathname); } catch { return send(res, 400, { message: 'bad path' }); }
  const segs = rel.split('/').filter(Boolean);
  if (rel.includes('\0') || segs.some(s => s === '..' || s.startsWith('.') || s === 'node_modules')) return notFound(res);
  let file = path.join(SITE_ROOT, ...segs);
  if (file !== SITE_ROOT && !file.startsWith(SITE_ROOT + path.sep)) return notFound(res);
  let st;
  try { st = fs.statSync(file); } catch { st = null; }
  if (st && st.isDirectory()) {
    if (!rel.endsWith('/')) { res.writeHead(301, { ...CORS, Location: rel + '/' + (url.search || '') }); return res.end(); }
    file = path.join(file, 'index.html');
    try { st = fs.statSync(file); } catch { st = null; }
  }
  if (!st && !path.extname(file)) { // pretty URLs: /pay -> /pay.html
    try { st = fs.statSync(file + '.html'); file += '.html'; } catch { st = null; }
  }
  if (!st || !st.isFile()) return notFound(res);
  res.writeHead(200, { ...CORS, 'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream',
    'Content-Length': st.size, 'Cache-Control': 'no-store' });
  if (req.method === 'HEAD') return res.end();
  fs.createReadStream(file).on('error', () => res.destroy()).pipe(res);
}
function notFound(res) {
  let body = '<h1>404</h1>';
  try { body = fs.readFileSync(path.join(SITE_ROOT, '404.html')); } catch {}
  res.writeHead(404, { ...CORS, 'Content-Type': 'text/html; charset=utf-8' });
  res.end(body);
}

// ------------------------------------------------------------------ router
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  try {
    if (req.method === 'OPTIONS') { res.writeHead(204, CORS); return res.end(); }
    if (url.pathname.startsWith('/auth/v1/')) return await handleAuth(req, res, url);
    if (url.pathname.startsWith('/rest/v1')) return await handleRest(req, res, url);
    if (url.pathname === '/__health') {
      await pool.query('select 1');
      return send(res, 200, { ok: true });
    }
    if (req.method === 'GET' || req.method === 'HEAD') return serveStatic(req, res, url);
    return send(res, 405, { message: 'method not allowed' });
  } catch (e) {
    if (res.headersSent) return res.destroy();
    if (e.status) return send(res, e.status, { code: String(e.status), message: e.message, details: null, hint: null });
    console.error(new Date().toISOString(), req.method, url.pathname, e.message);
    send(res, 500, { code: 'XX000', message: 'dev server error: ' + e.message, details: null, hint: 'is the database up? run dev/db.sh start' });
  }
});
server.listen(PORT, () => console.log('Refka dev server on http://localhost:' + PORT + '  (site: /app/, auth: /auth/v1, rpc: /rest/v1/rpc/<fn>)'));
