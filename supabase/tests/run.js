#!/usr/bin/env node
// Refka backend tests. Resets the database refka_test (never the shared dev db "refka"), applies the local
// prelude + migrations through dev/db.sh, then drives every RPC the way PostgREST does (one transaction per
// call, role anon or authenticated, request.jwt.claims set, read-only for STABLE functions).
// Usage: node supabase/tests/run.js      Env: REFKA_TEST_DB (default refka_test)
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const C = require('../../dev/common');
const pg = require(path.join(__dirname, '../../dev/node_modules/pg'));
pg.types.setTypeParser(1082, v => v);           // date columns as 'YYYY-MM-DD'

const DB = process.env.REFKA_TEST_DB || 'refka_test';
if (DB === 'refka') { console.error('refusing to run against the shared dev database "refka"'); process.exit(2); }
const ROOT = path.resolve(__dirname, '../..');

// ------------------------------------------------------------------ tiny harness
let total = 0, failed = 0;
function check(name, cond, info) {
  total++;
  if (cond) { console.log('PASS ' + name); return true; }
  failed++;
  let s = '';
  if (info !== undefined) { try { s = typeof info === 'string' ? info : JSON.stringify(info); } catch { s = String(info); } }
  console.log('FAIL ' + name + (s ? '  -> ' + s.slice(0, 400) : ''));
  return false;
}
const errCode = e => (e instanceof C.RpcError ? (e.body.code === '42501' ? '42501' : e.code) : (e && (e.code || e.message)));
async function rejects(name, promise, code) {
  try {
    const r = await promise;
    return check(name, false, 'expected error ' + code + ', got ' + JSON.stringify(r));
  } catch (e) {
    const got = errCode(e);
    return check(name, got === code, 'expected ' + code + ', got ' + got + (e.message && e.message !== got ? ' (' + e.message + ')' : ''));
  }
}
async function ok(name, promise) {
  try { const r = await promise; check(name, true); return r; }
  catch (e) { check(name, false, 'error ' + errCode(e) + ' ' + (e.message || '')); return undefined; }
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  execFileSync(path.join(ROOT, 'dev/db.sh'), ['reset', DB], { stdio: ['ignore', 'ignore', 'inherit'] });
  const pool = C.makePool(DB);
  const sql = async (q, p) => (await pool.query(q, p)).rows;
  const one = async (q, p) => (await sql(q, p))[0];
  const day = async n => (await one(`select (public.rf_today() + $1::int)::text as d`, [n])).d;
  const addMonths = async (d, m) => (await one(`select ($1::date + make_interval(months => $2))::date::text as d`, [d, m])).d;
  const today = await day(0);
  const year = Number(today.slice(0, 4));

  // users go straight into auth.users, like dev/seed.js does
  const U = {}, PH = {};
  async function mkUser(key, email, meta) {
    U[key] = (await pool.query('insert into auth.users (email, raw_user_meta_data, encrypted_password) values ($1,$2,$3) returning *',
      [email, JSON.stringify(meta), C.hashPassword('123456')])).rows[0];
  }
  async function mkMember(key, local) {
    PH[key] = '+2' + local;
    await mkUser(key, 'p2' + local + '@m.refka.tech', { kind: 'member', phone: '+2' + local });
  }
  const outputs = [];                                     // every RPC result, for the leak checks at the end
  async function as(key, fn, args) {
    const r = await C.rpc(pool, C.claimsFor(U[key]), fn, args || {});
    outputs.push({ key, fn, out: JSON.stringify(r) });
    return r;
  }
  const anon = async (fn, args) => {
    const r = await C.rpc(pool, null, fn, args || {});
    outputs.push({ key: null, fn, out: JSON.stringify(r) });
    return r;
  };
  // run raw SQL as a client role (what a stolen anon key or a member JWT could do with PostgREST table routes)
  async function asRole(role, claims, statements) {
    const c = await pool.connect();
    try {
      await c.query('begin');
      await c.query('set local role ' + role);
      await c.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify(claims || { role })]);
      let last;
      for (const s of [].concat(statements)) last = await c.query(s);
      return { ok: true, rows: last && last.rows };
    } catch (e) { return { ok: false, code: e.code, message: e.message }; }
    finally { await c.query('rollback').catch(() => {}); c.release(); }
  }
  const ids = arr => (arr || []).map(x => x.id);
  const has = (arr, id) => ids(arr).includes(id);
  const people = async (k, q) => (await as(k, 'people', { p_gym: 'alpha', p_q: q || '' })) || [];
  const sees = async (v, t) => (await people(v)).some(x => x.user_id === U[t].id);
  const feed = async (k, g) => (await as(k, 'feed', { p_gym: g || 'alpha' })) || [];
  const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

  // ================================================================== 1. owner journey
  console.log('\n# owner journey');
  for (const k of ['oA', 'oB', 'oC', 'oX']) await mkUser(k, k.toLowerCase() + '@owners.test', { kind: 'owner', name: 'Owner ' + k });
  check('owner_get_gym is null before he has a gym', (await as('oA', 'owner_get_gym')) === null);
  await rejects('owner_home without a gym -> not_owner', as('oA', 'owner_home'), 'not_owner');
  for (const s of ['ab', '-abc', 'abc-', 'a--b', 'has space', 'x'.repeat(31), 'abc_d', 'ünï', '', 'admin', 'app', 'pay', 'owner', 'api', 'supabase'])
    await rejects(`slug "${s.length > 12 ? s.slice(0, 12) + '...' : s}" -> slug_bad`, as('oA', 'owner_create_gym', { p_name: 'Alpha Gym', p_name_ar: null, p_slug: s }), 'slug_bad');
  await rejects('gym name of 1 char -> bad_input', as('oA', 'owner_create_gym', { p_name: 'A', p_name_ar: null, p_slug: 'alpha' }), 'bad_input');
  check('slug of exactly 30 chars is allowed by the rule', /^[a-z0-9]([a-z0-9-]{1,28})[a-z0-9]$/.test('a'.repeat(30)));
  const gA = await ok('owner A creates gym " Alpha "', as('oA', 'owner_create_gym', { p_name: 'Alpha Gym', p_name_ar: 'ألفا', p_slug: ' Alpha ' }));
  check('slug is trimmed and lower cased', gA && gA.slug === 'alpha', gA);
  check('a new gym starts as draft', gA && gA.status === 'draft');
  check('gym json carries no qr_secret and no owner_id', gA && !('qr_secret' in gA) && !('owner_id' in gA));
  await rejects('second gym for the same owner -> dup', as('oA', 'owner_create_gym', { p_name: 'Alpha Two', p_name_ar: null, p_slug: 'alpha-two' }), 'dup');
  await rejects('taken slug -> slug_taken', as('oB', 'owner_create_gym', { p_name: 'Bravo Gym', p_name_ar: null, p_slug: 'alpha' }), 'slug_taken');
  const gB = await ok('owner B creates gym bravo', as('oB', 'owner_create_gym', { p_name: 'Bravo Gym', p_name_ar: null, p_slug: 'bravo' }));
  await ok('owner C creates gym charlie (stays draft)', as('oC', 'owner_create_gym', { p_name: 'Charlie Gym', p_name_ar: null, p_slug: 'charlie' }));
  check('gym_public of a draft gym is null', (await anon('gym_public', { p_slug: 'alpha' })) === null);
  await rejects('go live without a package -> need_package', as('oA', 'owner_go_live'), 'need_package');

  const d10 = await day(10);
  const up = p => as('oA', 'owner_upsert_package', { p });
  await rejects('before_price without until -> before_needs_until', up({ name: 'X', months: 1, price: 100, before_price: 200 }), 'before_needs_until');
  await rejects('before_price not above price -> bad_input', up({ name: 'X', months: 1, price: 100, before_price: 100, until: d10 }), 'bad_input');
  await rejects('package months 0 -> bad_input', up({ name: 'X', months: 0, price: 100 }), 'bad_input');
  await rejects('package price 0 -> bad_input', up({ name: 'X', months: 1, price: 0 }), 'bad_input');
  await rejects('package months "abc" -> bad_input', up({ name: 'X', months: 'abc', price: 100 }), 'bad_input');
  await rejects('package without name -> bad_input', up({ name: ' ', months: 1, price: 100 }), 'bad_input');
  await rejects('package unknown key -> bad_input', up({ name: 'X', months: 1, price: 100, gym_id: gB && gB.id }), 'bad_input');
  const p1 = await ok('create package 1 month', up({ name: '1 month', name_ar: 'شهر', months: 1, price: 1000, sort: 1 }));
  const p3 = await ok('create package 3 months with offer', up({ name: '3 months', months: 3, price: 2500, before_price: 3000, until: d10, sort: 2 }));
  const p6 = await ok('create package 6 months', up({ name: '6 months', months: 6, price: 4000, sort: 3 }));
  const pOld = await ok('create package whose offer already ended', up({ name: 'Old offer', months: 1, price: 500, before_price: 800, until: await day(-1), sort: 9 }));
  const p1u = await ok('update package price', up({ id: p1.id, price: 1200 }));
  check('update keeps other fields', p1u && p1u.price === 1200 && p1u.name === '1 month' && p1u.months === 1, p1u);
  await rejects('clearing until while before_price stays -> before_needs_until', up({ id: p3.id, until: null }), 'before_needs_until');
  await rejects('go live without a pay method -> need_pay', as('oA', 'owner_go_live'), 'need_pay');
  const ug = p => as('oA', 'owner_update_gym', { p_patch: p });
  await rejects('update gym with key status -> bad_input', ug({ status: 'live' }), 'bad_input');
  await rejects('update gym with key qr_secret -> bad_input', ug({ qr_secret: 'x' }), 'bad_input');
  await rejects('brand colour "red" -> bad_input', ug({ brand: { primary: 'red' } }), 'bad_input');
  await rejects('svg logo -> bad_input', ug({ brand: { logo: 'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=' } }), 'bad_input');
  await rejects('javascript: logo -> bad_input', ug({ brand: { logo: 'javascript:alert(1)' } }), 'bad_input');
  await rejects('settings posts "x" -> bad_input', ug({ settings: { posts: 'x' } }), 'bad_input');
  await rejects('settings unknown key -> bad_input', ug({ settings: { admin: true } }), 'bad_input');
  await rejects('pay wallet as a number -> bad_input', ug({ pay: { wallet: 123 } }), 'bad_input');
  await ok('set pay and brand', ug({ pay: { instapay: 'alpha@instapay', cash: true }, brand: { primary: '#112233' } }));
  const live = await ok('go live', as('oA', 'owner_go_live'));
  check('gym is live', live && live.status === 'live');
  const pubA = await anon('gym_public', { p_slug: 'ALPHA' });
  check('gym_public (anon) lists 4 packages', pubA && pubA.packages.length === 4, pubA);
  const pub3 = pubA && pubA.packages.find(x => x.id === p3.id);
  check('running offer shows price, before_price and until', pub3 && pub3.price === 2500 && pub3.before_price === 3000 && pub3.until === d10, pub3);
  const pubOld = pubA && pubA.packages.find(x => x.id === pOld.id);
  check('ended offer charges before_price and hides the offer', pubOld && pubOld.price === 800 && pubOld.before_price === null && pubOld.until === null, pubOld);
  check('gym_public carries no qr_secret, owner_id, pay or settings', pubA && !/qr_secret|owner_id|"pay"|settings/.test(JSON.stringify(pubA)));
  await ok('delete package old offer', as('oA', 'owner_delete_package', { p_id: pOld.id }));
  await ok('delete package 6 months', as('oA', 'owner_delete_package', { p_id: p6.id }));
  await rejects('delete a deleted package -> not_found', as('oA', 'owner_delete_package', { p_id: p6.id }), 'not_found');
  await rejects('update a deleted package -> not_found', up({ id: p6.id, price: 10 }), 'not_found');
  await ok('deactivate 1 month while 3 months stays active', up({ id: p1.id, active: false }));
  await rejects('deactivating the last active package of a live gym -> need_package', up({ id: p3.id, active: false }), 'need_package');
  await ok('reactivate 1 month', up({ id: p1.id, active: true }));
  await rejects('removing every pay method of a live gym -> need_pay', ug({ pay: { instapay: null, cash: false } }), 'need_pay');
  const gg = await as('oA', 'owner_get_gym');
  check('refused change was rolled back', gg && gg.gym.pay.cash === true && gg.gym.pay.instapay === 'alpha@instapay', gg && gg.gym.pay);
  check('owner_get_gym lists 2 packages and no qr_secret', gg && gg.packages.length === 2 && !JSON.stringify(gg).includes('qr_secret'));

  // gym B
  const pB1 = await as('oB', 'owner_upsert_package', { p: { name: 'Monthly', months: 1, price: 900 } });
  await as('oB', 'owner_update_gym', { p_patch: { pay: { cash: true, wallet: '01299990000' } } });
  await as('oB', 'owner_go_live');

  // ================================================================== 2. import
  console.log('\n# import');
  const [dm20, dm5, d20, d30, dm10, dm3, d5, d1] = await Promise.all([-20, -5, 20, 30, -10, -3, 5, 1].map(day));
  const rows = [
    { phone: '01011110001', name: 'Member One', gender: 'm', package_id: p1.id, starts: dm20, ends: d10 },   // 0
    { phone: '01011110002', name: 'Member Two', gender: 'male', package_id: p3.id, starts: dm5 },          // 1 ends computed
    { phone: '01011110003', name: 'Woman One', gender: 'أنثى', package_id: p1.id, ends: d20 },              // 2
    { phone: '+20 101 111 0004', name: 'Woman Two', gender: 'f', ends: d30 },                              // 3
    { phone: '01011110005', name: 'Kid One', gender: 'm', ends: d30 },                                      // 4
    { phone: '01011110006', name: 'Kid Two', gender: 'm', ends: d30 },                                      // 5
    { phone: '01011110007', name: 'Hidden Man', gender: 'm', ends: d30 },                                   // 6
    { phone: '01011110008', name: 'Expired Man', gender: 'm', ends: dm10 },                                 // 7
    { phone: '01011110009', name: 'Grace Man', gender: 'm', ends: dm3 },                                    // 8
    { phone: '01011110013', name: 'Woman Three', gender: 'f', ends: d30 },                                  // 9
    { phone: '123', name: 'Bad Phone' },                                                                     // 10
    { phone: '01011119999', name: 'X' },                                                                     // 11
    { phone: '01011119998', name: 'Bad Gender', gender: 'alien' },                                           // 12
    { phone: '01011119997', name: 'Bad Pkg', package_id: pB1.id },                                           // 13 other gym's package
    { phone: '01011119996', name: 'Bad Date', ends: '2026-13-45' },                                          // 14
    { phone: '01011119995', name: 'Bad Range', starts: d5, ends: d1 },                                       // 15
    'not an object',                                                                                          // 16
    { phone: '01011119994', name: 'Not A Uuid', package_id: 'zzz' },                                         // 17
    { phone: '01011110030', name: 'Listed Only', gender: 'm', ends: d30 },                                   // 18 never joins
  ];
  const imp = await ok('import 19 rows', as('oA', 'owner_import_members', { p_rows: rows }));
  check('import added 11', imp && imp.added === 11 && imp.updated === 0, imp);
  const want = { 10: 'bad_phone', 11: 'bad_name', 12: 'bad_gender', 13: 'bad_package', 14: 'bad_date', 15: 'bad_date', 16: 'bad_row', 17: 'bad_package' };
  for (const [row, code] of Object.entries(want))
    check(`import row ${row} -> ${code}`, imp && imp.errors.some(e => e.row === Number(row) && e.code === code), imp && imp.errors);
  check('import reports exactly 8 errors', imp && imp.errors.length === 8);
  const imp2 = await ok('re-import an existing phone', as('oA', 'owner_import_members', { p_rows: [rows[0]] }));
  check('re-import counts as updated', imp2 && imp2.added === 0 && imp2.updated === 1, imp2);
  await rejects('import of a non array -> bad_input', as('oA', 'owner_import_members', { p_rows: { a: 1 } }), 'bad_input');
  let mem = await as('oA', 'owner_members', { p_q: '' });
  const byName = n => mem.find(x => x.name === n);
  check('ends computed from starts + package months', byName('Member Two') && byName('Member Two').ends === await addMonths(dm5, 3), byName('Member Two'));
  check('arabic gender word accepted', byName('Woman One') && byName('Woman One').gender === 'f');
  check('phone with spaces and +20 normalised', byName('Woman Two') && byName('Woman Two').phone === '+201011110004');
  const sr = await as('oA', 'owner_members', { p_q: '01011110004' });
  check('owner_members finds a member by local phone', sr.length === 1 && sr[0].name === 'Woman Two', sr);
  check('owner_get_gym counts 11 listed', (await as('oA', 'owner_get_gym')).counts.listed === 11);

  await as('oB', 'owner_import_members', { p_rows: [
    { phone: '01011110020', name: 'Bravo One', gender: 'm', package_id: pB1.id, ends: d30 },
    { phone: '01011110021', name: 'Bravo Two', gender: 'f', ends: d30 },
    { phone: '01011110022', name: 'Bravo Three', gender: 'm', ends: d30 }] });

  // ================================================================== 3. members join
  console.log('\n# member join');
  const ppl = [['m1', '01011110001', 'Member One', 'm', 1995], ['m2', '01011110002', 'Member Two', 'm', 1990],
    ['w1', '01011110003', 'Woman One', 'f', 1996], ['w2', '01011110004', 'Woman Two', 'f', 1994],
    ['k1', '01011110005', 'Kid One', 'm', year - 15], ['k2', '01011110006', 'Kid Two', 'm', year - 16],
    ['n1', '01011110007', 'Hidden Man', 'm', 1993], ['ex', '01011110008', 'Expired Man', 'm', 1991],
    ['gr', '01011110009', 'Grace Man', 'm', 1992], ['w3', '01011110013', 'Woman Three', 'm', 1997],   // w3 types 'm', list says f
    ['g1', '01011110010', 'Guest One', 'm', 1998], ['g2', '01011110011', 'Guest Two', 'm', 1998], ['g3', '01011110014', 'Guest Three', 'm', 1999]];
  for (const [k, local] of ppl) await mkMember(k, local);
  for (const [k, local] of [['b1', '01011110020'], ['b2', '01011110021'], ['b3', '01011110022'], ['bg', '01011110023']]) await mkMember(k, local);
  const join = (k, slug, name, g, y) => as(k, 'member_join', { p_slug: slug, p_name: name, p_gender: g, p_birth_year: y });
  await rejects('join a draft gym -> not_found', join('m1', 'charlie', 'Member One', 'm', 1995), 'not_found');
  await rejects('join an unknown slug -> not_found', join('m1', 'nope', 'Member One', 'm', 1995), 'not_found');
  await rejects('owner account (no phone email) cannot join -> bad_input', join('oA', 'alpha', 'Owner A', 'm', 1980), 'bad_input');
  await rejects('join with birth year making him 5 -> bad_input', join('g2', 'alpha', 'Guest Two', 'm', year - 5), 'bad_input');
  await rejects('join with gender "x" -> bad_input', join('g2', 'alpha', 'Guest Two', 'x', 1998), 'bad_input');
  await rejects('join with 1 char name -> bad_input', join('g2', 'alpha', 'G', 'm', 1998), 'bad_input');
  for (const [k, , name, g, y] of ppl) {
    const r = await ok(`${k} joins alpha`, join(k, 'alpha', name, g, y));
    const guest = /^g[0-9]$/.test(k);
    check(`${k} ${guest ? 'is a guest (not matched)' : 'is matched and active'}`, r && r.matched === !guest && r.membership.status === (guest ? 'guest' : 'active'), r);
  }
  const again = await join('m1', 'alpha', 'Changed Name', 'f', 1980);
  check('joining again is idempotent and does not change name or gender', again.matched === true && (await as('m1', 'me')).profile.name === 'Member One' && (await as('m1', 'me')).profile.gender === 'm');
  for (const [k, n, g] of [['b1', 'Bravo One', 'm'], ['b2', 'Bravo Two', 'f'], ['b3', 'Bravo Three', 'm'], ['bg', 'Bravo Guest', 'm']]) await join(k, 'bravo', n, g, 1990);
  const meW3 = await as('w3', 'me');
  check("gym's gender record wins over the typed one", meW3.profile.gender === 'f', meW3.profile);
  const meM1 = await as('m1', 'me');
  check('me() returns own phone, default vis all for a man', meM1.profile.phone === PH.m1 && meM1.profile.vis === 'all');
  check('me() lists one membership in alpha', meM1.memberships.length === 1 && meM1.memberships[0].gym.slug === 'alpha');
  check('default vis for a woman is gender', (await as('w1', 'me')).profile.vis === 'gender');
  const meO = await as('oA', 'me');
  check('me() of an owner: no profile, is_owner', meO.profile === null && meO.is_owner === true);
  await as('w2', 'update_profile', { p_patch: { vis: 'all' } });
  await as('b2', 'update_profile', { p_patch: { vis: 'all' } });
  await as('n1', 'update_profile', { p_patch: { vis: 'none' } });
  await as('m1', 'update_profile', { p_patch: { times: ['morning', 'evening'], goal: 'Strength' } });
  await as('m2', 'update_profile', { p_patch: { times: ['morning', 'night'] } });

  // guests
  let oh = await as('oA', 'owner_home');
  check('owner_home lists the 3 guests', oh.needs.filter(n => n.k === 'guest').length === 3, oh.needs);
  let mhG = await as('g1', 'member_home', { p_gym: 'alpha' });
  check('guest member_home: status guest, no qr', mhG.membership.status === 'guest' && mhG.qr === null);
  await rejects('guest cannot list people -> not_member', as('g1', 'people', { p_gym: 'alpha', p_q: '' }), 'not_member');
  mem = await as('oA', 'owner_members', { p_q: '' });
  const mid = k => { const n = ppl.find(p => p[0] === k)[2]; const x = byName(n); return x && x.id; };
  const dg1 = await ok('owner accepts guest g1 with 1 month', as('oA', 'owner_decide_guest', { p_membership_id: mid('g1'), p_ok: true, p_package_id: p1.id, p_ends: null }));
  check('accepted guest ends today + 1 month', dg1 && dg1.ends === await addMonths(today, 1), dg1);
  mhG = await as('g1', 'member_home', { p_gym: 'alpha' });
  check('accepted guest is active and gets a QR', mhG.membership.status === 'active' && mhG.qr && mhG.qr.token.startsWith('rf1.'));
  await ok('owner rejects guest g2', as('oA', 'owner_decide_guest', { p_membership_id: mid('g2'), p_ok: false }));
  await rejects('rejected guest has no membership -> not_member', as('g2', 'member_home', { p_gym: 'alpha' }), 'not_member');
  await rejects('decide_guest on an active member -> not_found', as('oA', 'owner_decide_guest', { p_membership_id: mid('m1'), p_ok: false }), 'not_found');
  await rejects('member calling an owner function -> not_owner', as('m1', 'owner_home'), 'not_owner');
  await rejects('member calling owner_members -> not_owner', as('m1', 'owner_members', { p_q: '' }), 'not_owner');
  check('owner without gym: owner_get_gym null', (await as('oX', 'owner_get_gym')) === null);
  await rejects('owner of A is not a member of A -> not_member', as('oA', 'people', { p_gym: 'alpha', p_q: '' }), 'not_member');

  // ================================================================== 4. visibility matrix
  console.log('\n# visibility matrix (people + feed)');
  const postId = {};
  for (const k of ['m1', 'm2', 'w1', 'w2', 'w3', 'k1', 'k2', 'n1', 'gr'])
    postId[k] = (await as(k, 'post_create', { p_gym: 'alpha', p_body: 'post by ' + k, p_img: null })).post.id;
  await rejects('expired member cannot post -> not_member', as('ex', 'post_create', { p_gym: 'alpha', p_body: 'x', p_img: null }), 'not_member');
  await rejects('guest cannot post -> not_member', as('g3', 'post_create', { p_gym: 'alpha', p_body: 'x', p_img: null }), 'not_member');
  const matrix = [
    ['m1', 'm2', true, 'same gender'], ['m2', 'm1', true, 'same gender'],
    ['m1', 'w1', false, 'woman with vis gender'], ['w1', 'm1', false, 'viewer with vis gender'],
    ['m1', 'w2', true, 'both vis all, cross on'], ['w2', 'm1', true, 'both vis all, cross on'],
    ['w1', 'w2', true, 'same gender'], ['w2', 'w1', true, 'same gender, target vis gender'], ['w1', 'w3', true, 'same gender'],
    ['m1', 'n1', false, 'target vis none'], ['n1', 'm1', true, 'viewer vis none still sees'],
    ['m1', 'k1', false, 'adult -> minor'], ['k1', 'm1', false, 'minor -> adult'], ['k1', 'k2', true, 'minor -> minor'], ['w2', 'k1', false, 'adult woman -> minor'],
    ['m1', 'gr', true, 'expired 3 days (grace)'], ['gr', 'm1', true, 'grace viewer'],
    ['m1', 'ex', false, 'expired 10 days'], ['m1', 'g3', false, 'guest'], ['m1', 'b1', false, 'other gym'],
  ];
  for (const [v, t, exp, why] of matrix) {
    check(`people: ${v} ${exp ? 'sees' : 'does not see'} ${t} (${why})`, (await sees(v, t)) === exp);
    if (postId[t]) check(`feed: ${v} ${exp ? 'sees' : 'does not see'} post of ${t} (${why})`, has(await feed(v), postId[t]) === exp);
  }
  check('own post is in own feed even with vis none', has(await feed('n1'), postId.n1));
  await rejects('expired member: people -> not_member', as('ex', 'people', { p_gym: 'alpha', p_q: '' }), 'not_member');
  await rejects('expired member: feed -> not_member', as('ex', 'feed', { p_gym: 'alpha' }), 'not_member');
  await rejects('expired member: requests_list -> not_member', as('ex', 'requests_list', { p_gym: 'alpha' }), 'not_member');
  await rejects('expired member: refkas_list -> not_member', as('ex', 'refkas_list', { p_gym: 'alpha' }), 'not_member');
  const mhEx = await as('ex', 'member_home', { p_gym: 'alpha' });
  check('expired member_home: no qr, negative days_left', mhEx.qr === null && mhEx.membership.days_left === -10, mhEx.membership);
  const pm1 = (await people('m1')).find(x => x.user_id === U.m2.id);
  check('people row has overlap 1 and no phone / birth_year', pm1 && pm1.overlap === 1 && !('phone' in pm1) && !('birth_year' in pm1), pm1);
  const two = await people('m1', 'two');
  check('people search by name (case insensitive)', two.length === 2 && two.every(x => /two/i.test(x.name)), two.map(x => x.name));
  check('people search with % matches nothing', (await people('m1', '%')).length === 0);
  await ok('owner turns cross off', ug({ settings: { cross: false } }));
  check('cross off: m1 does not see w2', !(await sees('m1', 'w2')));
  check('cross off: w2 does not see m1', !(await sees('w2', 'm1')));
  check("cross off: m1's feed drops w2's post", !has(await feed('m1'), postId.w2));
  check('cross off: m1 still sees m2', await sees('m1', 'm2'));
  await ug({ settings: { cross: true } });
  check('cross back on: m1 sees w2', await sees('m1', 'w2'));

  // ================================================================== 5. QR and check-ins
  console.log('\n# QR and check-ins');
  const secretA = (await one(`select qr_secret from gyms where slug = 'alpha'`)).qr_secret;
  const secretB = (await one(`select qr_secret from gyms where slug = 'bravo'`)).qr_secret;
  const tok = (secret, m, b) => `rf1.${m}.${b}.` + crypto.createHmac('sha256', secret).update(m + '.' + b).digest('hex').slice(0, 32);
  const nowEpoch = async () => Number((await one(`select extract(epoch from clock_timestamp()) as e`)).e);
  if ((await nowEpoch()) % 60 > 40) await sleep((62 - (await nowEpoch()) % 60) * 1000);  // keep the sequence inside one minute
  const b = Math.floor((await nowEpoch()) / 60);
  const mh2 = await as('m2', 'member_home', { p_gym: 'alpha' });
  const mid2 = mh2.membership.id;
  check('member_home QR token shape', /^rf1\.[0-9a-f-]{36}\.\d+\.[0-9a-f]{32}$/.test(mh2.qr.token), mh2.qr);
  check('member_home QR is the current bucket, signed with the gym secret', mh2.qr.token === tok(secretA, mid2, b));
  const cnt = async m => Number((await one(`select count(*) as n from checkins where membership_id = $1`, [m])).n);
  const scan = (o, t) => as(o, 'owner_scan', { p_token: t });
  let sc = await ok('scan previous-bucket token', scan('oA', tok(secretA, mid2, b - 1)));
  check('previous bucket is valid and writes a check-in', sc && sc.ok === true && sc.valid === true && sc.already === false && sc.name === 'Member Two', sc);
  check('one check-in row', (await cnt(mid2)) === 1);
  sc = await ok('same token again within 10 s (camera double fire)', scan('oA', tok(secretA, mid2, b - 1)));
  check('double fire answered, nothing new written', sc && sc.already === true && (await cnt(mid2)) === 1);
  await rejects('token two buckets old -> expired', scan('oA', tok(secretA, mid2, b - 2)), 'expired');
  await sql(`update memberships set qr_used_at = now() - interval '20 seconds' where id = $1`, [mid2]);
  await rejects('replay of a used token after 10 s -> expired', scan('oA', tok(secretA, mid2, b - 1)), 'expired');
  sc = await ok('scan current token', scan('oA', mh2.qr.token));
  check('second valid scan within 3 h: ok but no new check-in', sc && sc.ok && sc.already === true && (await cnt(mid2)) === 1, sc);
  await rejects('future bucket -> bad_input', scan('oA', tok(secretA, mid2, b + 1)), 'bad_input');
  await rejects('tampered signature -> bad_input', scan('oA', mh2.qr.token.slice(0, -1) + (mh2.qr.token.endsWith('0') ? '1' : '0')), 'bad_input');
  await rejects('garbage token -> bad_input', scan('oA', 'hello'), 'bad_input');
  await rejects('null token -> bad_input', scan('oA', null), 'bad_input');
  await rejects("owner B scanning A's member -> bad_input", scan('oB', tok(secretA, mid2, b)), 'bad_input');
  await rejects("token signed with B's secret at gym A -> bad_input", scan('oA', tok(secretB, mid2, b)), 'bad_input');
  await rejects('member calling owner_scan -> not_owner', scan('m2', mh2.qr.token), 'not_owner');
  const midEx = mid('ex');
  sc = await ok("scan of an expired member's correctly signed token", scan('oA', tok(secretA, midEx, b)));
  check('expired member: ok false, valid false, nothing written', sc && sc.ok === false && sc.valid === false && (await cnt(midEx)) === 0, sc);
  await sql(`update checkins set at = at - interval '4 hours' where membership_id = $1`, [mid2]);
  await sql(`update memberships set qr_used_bucket = $2 where id = $1`, [mid2, b - 3]);
  sc = await ok('scan after 4 hours', scan('oA', tok(secretA, mid2, b)));
  check('after 3 h a new check-in is written', sc && sc.already === false && (await cnt(mid2)) === 2, sc);
  const dk = await ok('desk check-in within 3 h', as('oA', 'owner_checkin', { p_membership_id: mid2 }));
  check('desk check-in within 3 h is not doubled', dk && dk.already === true && (await cnt(mid2)) === 2);
  const lo = await ok('desk check-in of a listed member who never joined', as('oA', 'owner_checkin', { p_membership_id: byName('Listed Only').id }));
  check('listed member desk check-in written', lo && lo.already === false);
  await rejects('desk check-in of a guest -> not_member', as('oA', 'owner_checkin', { p_membership_id: mid('g3') }), 'not_member');
  await rejects('desk check-in of an expired member -> expired', as('oA', 'owner_checkin', { p_membership_id: midEx }), 'expired');
  oh = await as('oA', 'owner_home');
  check('owner_home stats count today\'s check-ins', oh.stats.checkins_today >= 2, oh.stats);
  check('member_home week_checkins', (await as('m2', 'member_home', { p_gym: 'alpha' })).week_checkins === 2);

  // ================================================================== 6. renew and payments
  console.log('\n# renew');
  let mh = await as('m1', 'member_home', { p_gym: 'alpha' });
  const endsBefore = mh.membership.ends;
  check('member_home: no pending payment yet, ends = imported', mh.pending_payment === false && endsBefore === d10);
  const renew = (k, pk, method, ref) => as(k, 'member_renew', { p_gym: 'alpha', p_package_id: pk, p_method: method, p_ref: ref });
  await rejects('renew with ref "ab" -> bad_input', renew('m1', p1.id, 'instapay', 'ab'), 'bad_input');
  await rejects('renew by a method the gym does not take -> bad_input', renew('m1', p1.id, 'wallet', '12345'), 'bad_input');
  await rejects('renew method bitcoin -> bad_input', renew('m1', p1.id, 'bitcoin', '12345'), 'bad_input');
  await rejects("renew with gym B's package -> not_found", renew('m1', pB1.id, 'cash', null), 'not_found');
  await rejects('renew with a deleted package -> not_found', renew('m1', p6.id, 'cash', null), 'not_found');
  const pay1 = await ok('renew 1 month by instapay', renew('m1', p1.id, 'instapay', 'IP-1234'));
  check('payment pending at the current price', pay1 && pay1.payment.amount === 1200 && pay1.payment.status === 'pending', pay1);
  await rejects('second renew while one is pending -> pending_exists', renew('m1', p3.id, 'cash', null), 'pending_exists');
  check('member_home shows pending_payment', (await as('m1', 'member_home', { p_gym: 'alpha' })).pending_payment === true);
  oh = await as('oA', 'owner_home');
  check('owner_home shows the pay need', oh.needs.some(n => n.k === 'pay' && n.id === pay1.payment.id && n.amount === 1200));
  await rejects('decide payment with null -> bad_input', as('oA', 'owner_decide_payment', { p_id: pay1.payment.id, p_ok: null }), 'bad_input');
  await ok('owner approves', as('oA', 'owner_decide_payment', { p_id: pay1.payment.id, p_ok: true }));
  mh = await as('m1', 'member_home', { p_gym: 'alpha' });
  check('approve extends from the current end (still in the future)', mh.membership.ends === await addMonths(endsBefore, 1) && mh.pending_payment === false, mh.membership);
  await rejects('deciding the same payment twice -> not_found', as('oA', 'owner_decide_payment', { p_id: pay1.payment.id, p_ok: true }), 'not_found');
  const pay2 = await ok('expired member renews 3 months cash', renew('ex', p3.id, 'cash', null));
  check('offer price charged while it runs', pay2 && pay2.payment.amount === 2500);
  await ok('owner approves', as('oA', 'owner_decide_payment', { p_id: pay2.payment.id, p_ok: true }));
  mh = await as('ex', 'member_home', { p_gym: 'alpha' });
  check('approve after expiry extends from today', mh.membership.ends === await addMonths(today, 3), mh.membership);
  check('renewed member gets a QR again', !!(mh.qr && mh.qr.token));
  const m2Ends = (await as('m2', 'member_home', { p_gym: 'alpha' })).membership.ends;
  const pay3 = await renew('m2', p1.id, 'cash', null);
  await ok('owner rejects', as('oA', 'owner_decide_payment', { p_id: pay3.payment.id, p_ok: false }));
  mh = await as('m2', 'member_home', { p_gym: 'alpha' });
  check('reject leaves ends unchanged and no pending', mh.membership.ends === m2Ends && mh.pending_payment === false);
  check('rejected payment row status', (await one(`select status from payments where id = $1`, [pay3.payment.id])).status === 'rejected');
  await ok('after a reject he may renew again', renew('m2', p1.id, 'cash', null));

  // ================================================================== 7. requests, refkas, chat
  console.log('\n# requests, refkas, chat');
  const send = (k, to, kind, slot) => as(k, 'request_send', { p_gym: 'alpha', p_to: U[to].id, p_kind: kind || 'train', p_slot: slot === undefined ? null : slot });
  await rejects('request to woman with vis gender -> hidden', send('m1', 'w1'), 'hidden');
  await rejects('request to vis none -> hidden', send('m1', 'n1'), 'hidden');
  await rejects('request to a minor -> hidden', send('m1', 'k1'), 'hidden');
  await rejects('request from vis none to someone who cannot see him -> hidden', send('n1', 'm1'), 'hidden');
  await rejects('request to a member of another gym -> hidden', send('m1', 'b1'), 'hidden');
  await rejects('request to a guest -> hidden', send('m1', 'g3'), 'hidden');
  await rejects('request to self -> bad_input', send('m1', 'm1'), 'bad_input');
  await rejects('request kind "date" -> bad_input', send('m1', 'm2', 'date'), 'bad_input');
  await rejects('request slot of 41 chars -> bad_input', send('m1', 'm2', 'train', 'x'.repeat(41)), 'bad_input');
  const r1 = await ok('m1 -> m2 request', send('m1', 'm2', 'train', 'Sat 8:00'));
  check('request_send returns the target without a phone', r1 && r1.request.to.name === 'Member Two' && !('phone' in r1.request.to));
  await rejects('duplicate request -> dup', send('m1', 'm2'), 'dup');
  await rejects('reverse duplicate -> dup', send('m2', 'm1'), 'dup');
  let rl = await as('m2', 'requests_list', { p_gym: 'alpha' });
  check('requests_list: incoming shows sender', rl.incoming.some(x => x.id === r1.request.id && x.from.user_id === U.m1.id && x.from.goal === 'Strength'));
  rl = await as('m1', 'requests_list', { p_gym: 'alpha' });
  check('requests_list: outgoing pending', rl.outgoing.some(x => x.id === r1.request.id && x.status === 'pending'));
  check('people relation out', (await people('m1')).find(x => x.user_id === U.m2.id).relation === 'out');
  check('people relation in', (await people('m2')).find(x => x.user_id === U.m1.id).relation === 'in');
  await rejects("cancel someone else's request -> not_found", as('m2', 'request_cancel', { p_id: r1.request.id }), 'not_found');
  await rejects('respond to a request for someone else -> not_found', as('w2', 'request_respond', { p_id: r1.request.id, p_accept: true }), 'not_found');
  await rejects('respond with null -> bad_input', as('m2', 'request_respond', { p_id: r1.request.id, p_accept: null }), 'bad_input');
  const acc = await ok('m2 accepts', as('m2', 'request_respond', { p_id: r1.request.id, p_accept: true }));
  const rM = acc && acc.refka_id;
  check('accept returns refka_id', !!rM);
  check('people relation refka', (await people('m1')).find(x => x.user_id === U.m2.id).relation === 'refka');
  await rejects('request while a refka is open -> dup', send('m1', 'm2'), 'dup');
  await rejects('respond twice -> not_found', as('m2', 'request_respond', { p_id: r1.request.id, p_accept: true }), 'not_found');
  check('refkas_list shows the partner', (await as('m1', 'refkas_list', { p_gym: 'alpha' })).some(x => x.id === rM && x.with.user_id === U.m2.id));
  const s1 = await ok('chat_send inside a refka', as('m1', 'chat_send', { p_refka: rM, p_body: '  hi there  ' }));
  await rejects('outsider chat_send -> not_found', as('w2', 'chat_send', { p_refka: rM, p_body: 'x' }), 'not_found');
  await rejects('outsider chat_list -> not_found', as('w2', 'chat_list', { p_refka: rM }), 'not_found');
  check('unread 1 for the receiver', (await as('m2', 'refkas_list', { p_gym: 'alpha' })).find(x => x.id === rM).unread === 1);
  const cl = await as('m2', 'chat_list', { p_refka: rM });
  check('chat_list: trimmed body, mine false', cl.length === 1 && cl[0].body === 'hi there' && cl[0].mine === false, cl);
  check('unread 0 after reading', (await as('m2', 'refkas_list', { p_gym: 'alpha' })).find(x => x.id === rM).unread === 0);
  check('refkas_list last message mine for sender', (await as('m1', 'refkas_list', { p_gym: 'alpha' })).find(x => x.id === rM).last.mine === true);
  await rejects('empty chat body -> bad_input', as('m1', 'chat_send', { p_refka: rM, p_body: '' }), 'bad_input');
  await rejects('whitespace chat body -> bad_input', as('m1', 'chat_send', { p_refka: rM, p_body: ' \n\t ' }), 'bad_input');
  await rejects('chat body 1001 chars -> bad_input', as('m1', 'chat_send', { p_refka: rM, p_body: 'x'.repeat(1001) }), 'bad_input');
  await ok('chat body 1000 chars', as('m1', 'chat_send', { p_refka: rM, p_body: 'y'.repeat(1000) }));
  const cl2 = await as('m1', 'chat_list', { p_refka: rM, p_after: s1.at });
  check('chat_list p_after returns only newer messages', cl2.length === 1 && cl2[0].body.length === 1000 && cl2[0].mine === true);

  const r2 = await ok('m1 -> w2 request', send('m1', 'w2', 'spot'));
  await ok('w2 declines', as('w2', 'request_respond', { p_id: r2.request.id, p_accept: false }));
  check('declined request shows in outgoing as declined', (await as('m1', 'requests_list', { p_gym: 'alpha' })).outgoing.some(x => x.id === r2.request.id && x.status === 'declined'));
  await rejects('asking again after a decline -> dup', send('m1', 'w2'), 'dup');
  const r3 = await ok('m2 -> w2 request', send('m2', 'w2'));
  await ok('m2 cancels it', as('m2', 'request_cancel', { p_id: r3.request.id }));
  await rejects('cancel twice -> not_found', as('m2', 'request_cancel', { p_id: r3.request.id }), 'not_found');
  check('cancelled request gone from incoming', !has((await as('w2', 'requests_list', { p_gym: 'alpha' })).incoming, r3.request.id));
  let sent = 0;
  for (let i = 0; i < 5; i++) {
    try { const r = await send('k1', 'k2'); sent++; await as('k1', 'request_cancel', { p_id: r.request.id }); } catch (e) { /* counted below */ }
  }
  check('5 requests a day go through (send + cancel)', sent === 5);
  await rejects('6th request in a day -> limit', send('k1', 'k2'), 'limit');
  await sql(`update requests set created_at = created_at - interval '1 day' where from_user = $1`, [U.k1.id]);
  const rK = await ok('next day the limit resets', send('k1', 'k2'));
  check('minor sees request from minor', has((await as('k2', 'requests_list', { p_gym: 'alpha' })).incoming, rK && rK.request.id));
  await sql(`update profiles set birth_year = 1990 where user_id = $1`, [U.k1.id]);
  check('requests_list: incoming from an adult hidden from a minor', !has((await as('k2', 'requests_list', { p_gym: 'alpha' })).incoming, rK && rK.request.id));
  check('people: minor does not see the adult', !(await sees('k2', 'k1')));
  await sql(`update profiles set birth_year = $2 where user_id = $1`, [U.k1.id, year - 15]);

  const r4 = await ok('m2 -> w2 request again (after cancel)', send('m2', 'w2'));
  const acc4 = await ok('w2 accepts', as('w2', 'request_respond', { p_id: r4.request.id, p_accept: true }));
  const rW = acc4 && acc4.refka_id;
  const inList = async (k, r) => has(await as(k, 'refkas_list', { p_gym: 'alpha' }), r);
  check('cross gender refka listed for both', (await inList('m2', rW)) && (await inList('w2', rW)));
  await ug({ settings: { cross: false } });
  check('cross off: refka hidden from refkas_list', !(await inList('m2', rW)) && (await inList('m2', rM)));
  await rejects('cross off: chat_send -> hidden', as('m2', 'chat_send', { p_refka: rW, p_body: 'x' }), 'hidden');
  await ok('cross off: same gender chat still works', as('m2', 'chat_send', { p_refka: rM, p_body: 'still here' }));
  await ug({ settings: { cross: true } });
  check('cross back on: refka back', await inList('m2', rW));
  await as('w2', 'update_profile', { p_patch: { vis: 'gender' } });
  check('w2 vis gender: cross refka hidden for both', !(await inList('m2', rW)) && !(await inList('w2', rW)));
  await rejects('w2 vis gender: chat -> hidden', as('w2', 'chat_send', { p_refka: rW, p_body: 'x' }), 'hidden');
  await as('w2', 'update_profile', { p_patch: { vis: 'all' } });
  await as('m2', 'update_profile', { p_patch: { vis: 'none' } });
  check('m2 vis none: existing refka partner still sees the refka', await inList('w2', rW));
  check('m2 vis none: but people no longer shows him', !(await sees('w2', 'm2')));
  await ok('m2 vis none: chat still works', as('w2', 'chat_send', { p_refka: rW, p_body: 'hello' }));
  await as('m2', 'update_profile', { p_patch: { vis: 'all' } });
  const m2EndsNow = (await one(`select ends::text as e from memberships where id = $1`, [mid2])).e;
  await sql(`update memberships set ends = $2 where id = $1`, [mid2, dm10]);
  check('m2 expired: refka hidden from partner', !(await inList('m1', rM)));
  await rejects('m2 expired: partner chat -> hidden', as('m1', 'chat_send', { p_refka: rM, p_body: 'x' }), 'hidden');
  await rejects('m2 expired: own refkas_list -> not_member', as('m2', 'refkas_list', { p_gym: 'alpha' }), 'not_member');
  await rejects('m2 expired: own chat -> not_member', as('m2', 'chat_list', { p_refka: rM }), 'not_member');
  check('m2 expired: people hides him', !(await sees('m1', 'm2')));
  check("m2 expired: feed hides his post", !has(await feed('m1'), postId.m2));
  await sql(`update memberships set ends = $2 where id = $1`, [mid2, m2EndsNow]);
  check('m2 restored: refka back', await inList('m1', rM));

  const r5 = await ok('w3 -> w2 request', send('w3', 'w2'));
  check('incoming listed', has((await as('w2', 'requests_list', { p_gym: 'alpha' })).incoming, r5 && r5.request.id));
  const w3Mid = mid('w3');
  await sql(`update memberships set ends = $2 where id = $1`, [w3Mid, dm10]);
  check('sender expired: incoming hidden', !has((await as('w2', 'requests_list', { p_gym: 'alpha' })).incoming, r5 && r5.request.id));
  await rejects('expired member cannot accept -> not_found or not_member', as('w3', 'requests_list', { p_gym: 'alpha' }), 'not_member');
  await sql(`update memberships set ends = $2 where id = $1`, [w3Mid, d30]);
  await ok('w2 blocks w3', as('w2', 'block_user', { p_user: U.w3.id }));
  check('block cancels the pending request', (await one(`select status from requests where id = $1`, [r5.request.id])).status === 'cancelled');
  check('blocked: incoming gone', !has((await as('w2', 'requests_list', { p_gym: 'alpha' })).incoming, r5.request.id));
  check('blocker does not see blocked in people', !(await sees('w2', 'w3')));
  check('blocked does not see blocker in people', !(await sees('w3', 'w2')));
  check("blocker's feed drops blocked's post", !has(await feed('w2'), postId.w3));
  check("blocked's feed drops blocker's post", !has(await feed('w3'), postId.w2));
  await rejects('blocked -> blocker request -> hidden', send('w3', 'w2'), 'hidden');
  await rejects('blocker -> blocked request -> hidden', send('w2', 'w3'), 'hidden');
  await rejects('block self -> bad_input', as('w2', 'block_user', { p_user: U.w2.id }), 'bad_input');
  await rejects('block unknown user -> not_found', as('w2', 'block_user', { p_user: crypto.randomUUID() }), 'not_found');

  await ok('m2 blocks w2 inside a refka', as('m2', 'block_user', { p_user: U.w2.id }));
  check('block ends the refka', (await one(`select ended_at from refkas where id = $1`, [rW])).ended_at !== null);
  await rejects('blocked side chat_send -> not_found', as('w2', 'chat_send', { p_refka: rW, p_body: 'x' }), 'not_found');
  await rejects('blocker chat_list -> not_found', as('m2', 'chat_list', { p_refka: rW }), 'not_found');
  check('refka gone from both lists', !(await inList('w2', rW)) && !(await inList('m2', rW)));
  check('block both directions in people', !(await sees('w2', 'm2')) && !(await sees('m2', 'w2')));
  await rejects('blocked -> blocker request -> hidden', send('w2', 'm2'), 'hidden');
  await ok('refka_end', as('m1', 'refka_end', { p_id: rM }));
  await rejects('chat after end -> not_found', as('m2', 'chat_send', { p_refka: rM, p_body: 'x' }), 'not_found');
  check('ended refka gone from refkas_list', !(await inList('m2', rM)));
  await rejects('refka_end twice -> not_found', as('m1', 'refka_end', { p_id: rM }), 'not_found');

  // ================================================================== 8. feed modes, respect, reports, owner view
  console.log('\n# feed');
  const pm = postId.m1;
  const rs = await ok('m2 respects m1 post', as('m2', 'post_respect', { p_id: pm }));
  check('respect on', rs && rs.respected === true);
  let fm = (await feed('m1')).find(x => x.id === pm);
  check('author sees respect count 1', fm && fm.respects === 1 && fm.mine === true, fm);
  fm = (await feed('m2')).find(x => x.id === pm);
  check('others see no count but respected true', fm && fm.respects === null && fm.respected === true, fm);
  check('feed item has no phone and author by without phone', fm && !('phone' in fm.by) && fm.by.user_id === U.m1.id);
  check('respect toggles off', (await as('m2', 'post_respect', { p_id: pm })).respected === false);
  check('author count back to 0', (await feed('m1')).find(x => x.id === pm).respects === 0);
  await rejects('respect a post of someone you cannot see -> not_found', as('w1', 'post_respect', { p_id: pm }), 'not_found');
  await rejects("delete someone else's post -> not_found", as('m2', 'post_delete', { p_id: pm }), 'not_found');
  await ok('owner sets posts approve', ug({ settings: { posts: 'approve' } }));
  const pa = await as('m1', 'post_create', { p_gym: 'alpha', p_body: 'pending post', p_img: null });
  check('approve mode, author vis all -> pending', pa.post.status === 'pending');
  const pw = await as('w1', 'post_create', { p_gym: 'alpha', p_body: 'woman post', p_img: null });
  check('approve mode, author vis gender -> live (owner may not see it)', pw.post.status === 'live');
  oh = await as('oA', 'owner_home');
  check('owner_home has the pending post of a vis all author', oh.needs.some(n => n.k === 'post' && n.id === pa.post.id));
  check('owner_home does not show posts of vis gender authors', !oh.needs.some(n => n.k === 'post' && n.id === pw.post.id) && !JSON.stringify(oh).includes('woman post'));
  check('author sees own pending post', (await feed('m1')).some(x => x.id === pa.post.id && x.status === 'pending'));
  check('others do not see a pending post', !has(await feed('m2'), pa.post.id));
  check('vis gender post visible to same gender', has(await feed('w3'), pw.post.id));
  const pa2 = await as('w2', 'post_create', { p_gym: 'alpha', p_body: 'w2 pending', p_img: null });
  await ok('owner approves the post', as('oA', 'owner_decide_post', { p_id: pa.post.id, p_action: 'approve' }));
  check('approved post visible to others', has(await feed('m2'), pa.post.id));
  await ok('owner hides a post', as('oA', 'owner_decide_post', { p_id: pa2.post.id, p_action: 'hide' }));
  check('hidden post not visible to others', !has(await feed('m1'), pa2.post.id));
  check('author still sees own hidden post', (await feed('w2')).some(x => x.id === pa2.post.id && x.status === 'hidden'));
  await rejects('decide post bad action -> bad_input', as('oA', 'owner_decide_post', { p_id: pa.post.id, p_action: 'delete' }), 'bad_input');
  await rejects('respect a hidden post -> not_found', as('m1', 'post_respect', { p_id: pa2.post.id }), 'not_found');
  const pa3 = await as('g1', 'post_create', { p_gym: 'alpha', p_body: 'g1 pending', p_img: null });
  await as('g1', 'update_profile', { p_patch: { vis: 'gender' } });
  check('leaving vis all publishes pending posts (owner can no longer review them)', (await one(`select status from posts where id = $1`, [pa3.post.id])).status === 'live');
  await as('g1', 'update_profile', { p_patch: { vis: 'all' } });

  await ok('w3 reports a post of w1 (vis gender)', as('w3', 'report', { p_gym: 'alpha', p_post: postId.w1, p_reason: 'spam' }));
  oh = await as('oA', 'owner_home');
  const rep = oh.needs.find(n => n.k === 'report' && n.post && n.post.id === postId.w1);
  check('report reaches the owner with the post attached', rep && rep.post.body === 'post by w1' && rep.about.user_id === U.w1.id, rep);
  await ok('owner resolves the report', as('oA', 'owner_resolve_report', { p_id: rep.id }));
  check('resolved report gone from needs', !(await as('oA', 'owner_home')).needs.some(n => n.k === 'report' && n.id === rep.id));
  await rejects('report without a target -> bad_input', as('w3', 'report', { p_gym: 'alpha', p_reason: 'x' }), 'bad_input');
  await rejects('report with empty reason -> bad_input', as('w3', 'report', { p_gym: 'alpha', p_post: postId.w1, p_reason: ' ' }), 'bad_input');
  await rejects('report reason 501 chars -> bad_input', as('w3', 'report', { p_gym: 'alpha', p_post: postId.w1, p_reason: 'x'.repeat(501) }), 'bad_input');
  await rejects('report a post you cannot see -> not_found', as('m1', 'report', { p_gym: 'alpha', p_post: postId.w1, p_reason: 'x' }), 'not_found');
  await rejects('report yourself -> bad_input', as('m1', 'report', { p_gym: 'alpha', p_user: U.m1.id, p_reason: 'x' }), 'bad_input');
  await rejects('report a post together with a different user -> bad_input', as('w3', 'report', { p_gym: 'alpha', p_post: postId.w1, p_user: U.m1.id, p_reason: 'x' }), 'bad_input');
  await ok('report a user', as('m1', 'report', { p_gym: 'alpha', p_user: U.m2.id, p_reason: 'rude' }));
  check('user report reaches owner', (await as('oA', 'owner_home')).needs.some(n => n.k === 'report' && n.about && n.about.user_id === U.m2.id));
  await ok('owner sets posts off', ug({ settings: { posts: 'off' } }));
  await rejects('posts off: post_create -> posts_off', as('m1', 'post_create', { p_gym: 'alpha', p_body: 'x', p_img: null }), 'posts_off');
  check('posts off: feed is empty', (await feed('m1')).length === 0);
  await ug({ settings: { posts: 'all' } });
  check('posts all again: feed back', (await feed('m1')).length > 0);

  // ================================================================== 9. size caps
  console.log('\n# size caps');
  const pc = (body, img) => as('g1', 'post_create', { p_gym: 'alpha', p_body: body, p_img: img });
  await rejects('post body 501 chars -> bad_input', pc('x'.repeat(501), null), 'bad_input');
  await ok('post body 500 chars', pc('x'.repeat(500), null));
  await rejects('post without body and image -> bad_input', pc('  ', null), 'bad_input');
  await rejects('post svg image -> bad_input', pc('x', 'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4='), 'bad_input');
  await rejects('post image not a data url -> bad_input', pc('x', 'https://evil.test/a.png'), 'bad_input');
  await rejects('post image over 205000 chars -> bad_input', pc('x', 'data:image/png;base64,' + 'A'.repeat(205000)), 'bad_input');
  await ok('post image at the cap', pc('', 'data:image/png;base64,' + 'A'.repeat(205000 - 22)));
  await ok('post small png', pc('pic', PNG));
  const prof = p => as('g1', 'update_profile', { p_patch: p });
  await rejects('avatar svg -> bad_input', prof({ avatar: 'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=' }), 'bad_input');
  await rejects('avatar over 56000 chars -> bad_input', prof({ avatar: 'data:image/png;base64,' + 'A'.repeat(56000) }), 'bad_input');
  await ok('avatar small png', prof({ avatar: PNG }));
  await rejects('bio 301 chars -> bad_input', prof({ bio: 'x'.repeat(301) }), 'bad_input');
  await ok('bio 300 chars', prof({ bio: 'x'.repeat(300) }));
  await rejects('name 1 char -> bad_input', prof({ name: 'A' }), 'bad_input');
  await rejects('goal 41 chars -> bad_input', prof({ goal: 'x'.repeat(41) }), 'bad_input');
  await rejects('13 times -> bad_input', prof({ times: Array.from({ length: 13 }, (_, i) => 't' + i) }), 'bad_input');
  await rejects('vis "public" -> bad_input', prof({ vis: 'public' }), 'bad_input');
  await rejects('update_profile cannot change phone', prof({ phone: '+201099999999' }), 'bad_input');
  await rejects('update_profile cannot change birth_year', prof({ birth_year: 1950 }), 'bad_input');
  await rejects('update_profile cannot change gender', prof({ gender: 'f' }), 'bad_input');
  check('phone unchanged', (await as('g1', 'me')).profile.phone === PH.g1);

  // ================================================================== 10. cross-gym isolation
  console.log('\n# cross-gym isolation');
  const rB = await as('b1', 'request_send', { p_gym: 'bravo', p_to: U.b2.id, p_kind: 'train', p_slot: null });
  const accB = await as('b2', 'request_respond', { p_id: rB.request.id, p_accept: true });
  const rfB = accB.refka_id;
  await as('b1', 'chat_send', { p_refka: rfB, p_body: 'bravo secret chat' });
  const rB2 = await as('b3', 'request_send', { p_gym: 'bravo', p_to: U.b1.id, p_kind: 'spot', p_slot: null });
  const postB = (await as('b1', 'post_create', { p_gym: 'bravo', p_body: 'bravo post', p_img: null })).post.id;
  await as('b2', 'report', { p_gym: 'bravo', p_post: postB, p_reason: 'bravo report' });
  const payB = (await as('b1', 'member_renew', { p_gym: 'bravo', p_package_id: pB1.id, p_method: 'cash', p_ref: null })).payment.id;
  const memB = await as('oB', 'owner_members', { p_q: '' });
  const bMid = memB.find(x => x.name === 'Bravo One').id, bgMid = memB.find(x => x.name === 'Bravo Guest').id;
  const tokB = (await as('b1', 'member_home', { p_gym: 'bravo' })).qr.token;
  const reportB = (await as('oB', 'owner_home')).needs.find(n => n.k === 'report').id;
  check('setup: gym B has a request, refka, post, report, payment, guest', !!(rfB && rB2 && postB && reportB && payB && bgMid));
  for (const gB_ of [gB.id, 'bravo']) {
    const lbl = gB_ === 'bravo' ? 'slug' : 'id';
    await rejects(`A member: member_home(B ${lbl}) -> not_member`, as('m1', 'member_home', { p_gym: gB_ }), 'not_member');
    await rejects(`A member: people(B ${lbl}) -> not_member`, as('m1', 'people', { p_gym: gB_, p_q: '' }), 'not_member');
    await rejects(`A member: feed(B ${lbl}) -> not_member`, as('m1', 'feed', { p_gym: gB_ }), 'not_member');
    await rejects(`A member: requests_list(B ${lbl}) -> not_member`, as('m1', 'requests_list', { p_gym: gB_ }), 'not_member');
    await rejects(`A member: refkas_list(B ${lbl}) -> not_member`, as('m1', 'refkas_list', { p_gym: gB_ }), 'not_member');
  }
  await rejects('A member: post_create in B -> not_member', as('m1', 'post_create', { p_gym: gB.id, p_body: 'x', p_img: null }), 'not_member');
  await rejects('A member: report in B -> not_member', as('m1', 'report', { p_gym: gB.id, p_post: postB, p_reason: 'x' }), 'not_member');
  await rejects('A member: member_renew in B -> not_member', as('m1', 'member_renew', { p_gym: gB.id, p_package_id: pB1.id, p_method: 'cash', p_ref: null }), 'not_member');
  await rejects('A member: request_send in B -> not_member', as('m1', 'request_send', { p_gym: gB.id, p_to: U.b1.id, p_kind: 'train', p_slot: null }), 'not_member');
  await rejects("A member: request_respond(B's request) -> not_found", as('m1', 'request_respond', { p_id: rB2.request.id, p_accept: true }), 'not_found');
  await rejects("A member: request_cancel(B's request) -> not_found", as('m1', 'request_cancel', { p_id: rB2.request.id }), 'not_found');
  await rejects("A member: refka_end(B's refka) -> not_found", as('m1', 'refka_end', { p_id: rfB }), 'not_found');
  await rejects("A member: chat_list(B's refka) -> not_found", as('m1', 'chat_list', { p_refka: rfB }), 'not_found');
  await rejects("A member: chat_send(B's refka) -> not_found", as('m1', 'chat_send', { p_refka: rfB, p_body: 'x' }), 'not_found');
  await rejects("A member: post_respect(B's post) -> not_found", as('m1', 'post_respect', { p_id: postB }), 'not_found');
  await rejects("A member: post_delete(B's post) -> not_found", as('m1', 'post_delete', { p_id: postB }), 'not_found');
  await rejects("A member: report B's post from A -> not_found", as('m1', 'report', { p_gym: 'alpha', p_post: postB, p_reason: 'x' }), 'not_found');
  await rejects("A member: report B's member from A -> not_found", as('m1', 'report', { p_gym: 'alpha', p_user: U.b1.id, p_reason: 'x' }), 'not_found');
  await rejects('A member: renew A with B package -> not_found', as('m1', 'member_renew', { p_gym: 'alpha', p_package_id: pB1.id, p_method: 'cash', p_ref: null }), 'not_found');
  check('A member: me() shows no B membership', !(await as('m1', 'me')).memberships.some(x => x.gym.slug === 'bravo'));
  // owner A against B
  await rejects("owner A: delete B's package -> not_found", as('oA', 'owner_delete_package', { p_id: pB1.id }), 'not_found');
  await rejects("owner A: update B's package -> not_found", as('oA', 'owner_upsert_package', { p: { id: pB1.id, price: 1 } }), 'not_found');
  await rejects("owner A: decide B's payment -> not_found", as('oA', 'owner_decide_payment', { p_id: payB, p_ok: true }), 'not_found');
  await rejects("owner A: decide B's guest -> not_found", as('oA', 'owner_decide_guest', { p_membership_id: bgMid, p_ok: false }), 'not_found');
  await rejects("owner A: accept A's guest with B's package -> not_found", as('oA', 'owner_decide_guest', { p_membership_id: mid('g3'), p_ok: true, p_package_id: pB1.id }), 'not_found');
  await rejects("owner A: decide B's post -> not_found", as('oA', 'owner_decide_post', { p_id: postB, p_action: 'hide' }), 'not_found');
  await rejects("owner A: resolve B's report -> not_found", as('oA', 'owner_resolve_report', { p_id: reportB }), 'not_found');
  await rejects("owner A: scan B's member token -> bad_input", as('oA', 'owner_scan', { p_token: tokB }), 'bad_input');
  await rejects("owner A: desk check-in of B's member -> not_found", as('oA', 'owner_checkin', { p_membership_id: bMid }), 'not_found');
  const memA = JSON.stringify(await as('oA', 'owner_members', { p_q: '' }));
  check("owner A: owner_members has no B members", !memA.includes('Bravo') && !memA.includes('1011110020'));
  check("owner A: searching B's phone finds nothing", (await as('oA', 'owner_members', { p_q: '01011110020' })).length === 0);
  const ohA = JSON.stringify(await as('oA', 'owner_home'));
  check("owner A: owner_home has none of B's ids", ![payB, bgMid, postB, reportB].some(x => ohA.includes(x)));
  check('owner A: owner_get_gym is gym A', (await as('oA', 'owner_get_gym')).gym.id === gA.id);
  const ohB = await as('oB', 'owner_home');
  check("B's payment, guest and report untouched", ohB.needs.some(n => n.id === payB) && ohB.needs.some(n => n.id === bgMid) && ohB.needs.some(n => n.id === reportB));
  check("B's package untouched", (await as('oB', 'owner_get_gym')).packages[0].price === 900);

  // ================================================================== 11. access control
  console.log('\n# access control');
  const AUTH_FNS = ['owner_create_gym', 'owner_get_gym', 'owner_update_gym', 'owner_upsert_package', 'owner_delete_package',
    'owner_import_members', 'owner_go_live', 'owner_home', 'owner_members', 'owner_decide_payment', 'owner_decide_guest',
    'owner_decide_post', 'owner_resolve_report', 'owner_scan', 'owner_checkin', 'me', 'member_join', 'update_profile',
    'member_home', 'member_renew', 'people', 'request_send', 'request_respond', 'request_cancel', 'requests_list',
    'refkas_list', 'refka_end', 'chat_list', 'chat_send', 'block_user', 'report', 'feed', 'post_create', 'post_respect', 'post_delete'];
  const fns = await sql(`select p.proname, p.oid::regprocedure::text as sig, p.prosecdef, p.proconfig, p.provolatile, p.prosrc,
      has_function_privilege('anon', p.oid, 'execute') as anon, has_function_privilege('authenticated', p.oid, 'execute') as auth
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public'`);
  for (const name of ['gym_public', ...AUTH_FNS]) check(`contract RPC ${name} exists once`, fns.filter(f => f.proname === name).length === 1);
  for (const f of fns) {
    const wantAnon = f.proname === 'gym_public', wantAuth = wantAnon || AUTH_FNS.includes(f.proname);
    check(`${f.sig}: anon execute ${wantAnon ? 'granted' : 'denied'}`, f.anon === wantAnon);
    check(`${f.sig}: authenticated execute ${wantAuth ? 'granted' : 'denied'}`, f.auth === wantAuth);
    check(`${f.sig}: security definer with search_path public, extensions, pg_temp`, f.prosecdef && (f.proconfig || []).includes('search_path=public, extensions, pg_temp'), f.proconfig);
    if (f.provolatile !== 'v') check(`${f.sig}: stable/immutable function does not write`, !/\b(insert\s+into|update\s+\w+\s+set|delete\s+from)\b/i.test(f.prosrc));
    check(`${f.sig}: no dynamic SQL`, !/\bexecute\b/i.test(f.prosrc));
  }
  await rejects('anon: me -> permission denied', anon('me'), '42501');
  await rejects('anon: owner_home -> permission denied', anon('owner_home'), '42501');
  await rejects('anon: people -> permission denied', anon('people', { p_gym: 'alpha', p_q: '' }), '42501');
  await rejects('anon: member_join -> permission denied', anon('member_join', { p_slug: 'alpha', p_name: 'Anon', p_gender: 'm', p_birth_year: 1990 }), '42501');
  await rejects('anon: rf_owner_gym -> permission denied', anon('rf_owner_gym'), '42501');
  await rejects('authenticated: can_see -> permission denied', as('m1', 'can_see', { viewer: U.m1.id, target: U.w1.id, gym: gA.id }), '42501');
  await rejects('authenticated: my_phone -> permission denied', as('m1', 'my_phone'), '42501');
  await rejects('authenticated: rf_qr_token -> permission denied', as('m1', 'rf_qr_token', { p_secret: 'x', p_membership: mid2, p_bucket: 1 }), '42501');
  await rejects('authenticated: rf_checkin -> permission denied', as('m1', 'rf_checkin', { p_gym: gA.id, p_membership: mid2, p_via: 'qr' }), '42501');
  const tables = await sql(`select c.relname, c.relrowsecurity,
      (select a.attname from pg_attribute a where a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped order by a.attnum limit 1) as col
    from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind in ('r', 'p', 'v', 'm') order by 1`);
  check('14 public tables', tables.length === 14, tables.map(t => t.relname));
  for (const t of tables) {
    check(`${t.relname}: RLS enabled`, t.relrowsecurity === true);
    for (const role of ['anon', 'authenticated']) {
      const claims = role === 'anon' ? { role: 'anon' } : C.claimsFor(U.m1);
      for (const [op, stmt] of [['SELECT', `select * from public.${t.relname} limit 1`], ['INSERT', `insert into public.${t.relname} default values`],
        ['UPDATE', `update public.${t.relname} set ${t.col} = ${t.col}`], ['DELETE', `delete from public.${t.relname}`]]) {
        const r = await asRole(role, claims, stmt);
        check(`${role} ${op} on ${t.relname} denied`, !r.ok && r.code === '42501', r);
      }
    }
  }
  // temp-table shadowing: security definer functions must not resolve table names through the caller's pg_temp
  const shadow = await asRole('authenticated', C.claimsFor(U.m1), [
    `create temp table gyms (id uuid, slug text, name text, name_ar text, country text, currency text, brand jsonb,
       settings jsonb, pay jsonb, status text, owner_id uuid, qr_secret text, created_at timestamptz)`,
    `insert into pg_temp.gyms (id, slug, name, owner_id, status, qr_secret)
       values (gen_random_uuid(), 'shadow', 'Shadow Gym', '${U.m1.id}', 'live', 'x')`,
    `select public.gym_public('shadow') as r`]);
  check('a caller temp table cannot shadow public tables inside RPCs', shadow.ok && shadow.rows[0].r === null, shadow);

  // ================================================================== 12. leaks over everything seen above
  console.log('\n# leaks');
  const MEMBER_FNS = new Set(['gym_public', 'me', 'member_join', 'update_profile', 'member_home', 'member_renew', 'people', 'request_send',
    'request_respond', 'request_cancel', 'requests_list', 'refkas_list', 'refka_end', 'chat_list', 'chat_send', 'block_user',
    'report', 'feed', 'post_create', 'post_respect', 'post_delete']);
  const memberOut = outputs.filter(o => MEMBER_FNS.has(o.fn));
  let leaks = [];
  for (const o of memberOut) for (const [k, phone] of Object.entries(PH)) {
    if (k !== o.key && o.out.includes(phone.slice(3))) leaks.push(o.fn + ' as ' + o.key + ' shows phone of ' + k);
  }
  check(`no member-facing output (${memberOut.length} calls) contains another user's phone`, leaks.length === 0, leaks.slice(0, 5));
  leaks = outputs.filter(o => o.out.includes(secretA) || o.out.includes(secretB)).map(o => o.fn);
  check(`no output (${outputs.length} calls) contains a gym qr_secret`, leaks.length === 0, leaks);
  leaks = memberOut.filter(o => /"birth_year"/.test(o.out) && !['me', 'update_profile'].includes(o.fn)).map(o => o.fn);
  check('birth_year only in own profile outputs', leaks.length === 0, leaks);
  leaks = memberOut.filter(o => o.out.includes('bravo secret chat') && !['b1', 'b2'].includes(o.key));
  check('B chat never reached anybody outside the refka', leaks.length === 0);

  // ================================================================== 13. deploy.sql
  console.log('\n# deploy.sql');
  const deployPath = path.join(ROOT, 'supabase/deploy.sql');
  const deploy = fs.existsSync(deployPath) ? fs.readFileSync(deployPath, 'utf8') : '';
  const migs = fs.readdirSync(path.join(ROOT, 'supabase/migrations')).filter(f => f.endsWith('.sql')).sort();
  for (const f of migs) check(`deploy.sql contains ${f} verbatim`, deploy.includes(fs.readFileSync(path.join(ROOT, 'supabase/migrations', f), 'utf8')));
  check('deploy.sql does not touch the local prelude objects', !/create table if not exists auth\.|create or replace function auth\./i.test(deploy));
  const before = Number((await one(`select count(*) as n from public.posts`)).n);
  let reapply = null;
  try { await pool.query(deploy); } catch (e) { reapply = e.message; }
  check('deploy.sql re-applies cleanly over a populated database (idempotent)', reapply === null, reapply);
  check('re-apply kept the data', Number((await one(`select count(*) as n from public.posts`)).n) === before);
  check('re-apply kept anon locked out', (await sql(`select has_table_privilege('anon', 'public.profiles', 'select') as x`))[0].x === false);
  check('gym_public still works after re-apply', (await anon('gym_public', { p_slug: 'alpha' })).id === gA.id);

  await pool.end();
  console.log(`\n${total - failed}/${total} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})().catch(e => {
  console.log('FAIL test run aborted: ' + (e && (e.stack || e.message)) + (e && e.body ? ' ' + JSON.stringify(e.body) : ''));
  console.log(`\n${total - failed}/${total} passed, ${failed + 1} failed`);
  process.exit(1);
});
