#!/usr/bin/env node
// Resets the local database and seeds the demo gym "Atlas Gym". Everything goes through the real RPCs,
// so the seed is also a smoke test. Usage: node dev/seed.js
'use strict';
const { execFileSync } = require('child_process');
const path = require('path');
const C = require('./common');

const PIN = '123456';
const img = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

(async () => {
  execFileSync(path.join(__dirname, 'db.sh'), ['reset'], { stdio: ['ignore', 'ignore', 'inherit'] });
  const pool = C.makePool();
  const users = {};
  async function user(key, email, password, meta) {
    const r = await pool.query('insert into auth.users (email, raw_user_meta_data, encrypted_password) values ($1,$2,$3) returning *',
      [email, JSON.stringify(meta), C.hashPassword(password)]);
    users[key] = r.rows[0];
    return r.rows[0];
  }
  const as = (key, fn, args) => C.rpc(pool, C.claimsFor(users[key]), fn, args);
  const memberUser = (key, local) => user(key, 'p2' + local + '@m.refka.app', PIN, { kind: 'member', phone: '+2' + local });

  // ---- owner + gym
  await user('owner', 'owner@atlas.test', 'atlas1234', { kind: 'owner', name: 'Hany Atlas' });
  await as('owner', 'owner_create_gym', { p_name: 'Atlas Gym', p_name_ar: 'أطلس جيم', p_slug: 'atlas' });
  await as('owner', 'owner_update_gym', { p_patch: {
    brand: { primary: '#0E7C66', accent: '#F2B705' },
    pay: { instapay: 'atlasgym@instapay', wallet: '01012345678', cash: true },
    settings: { cross: true, posts: 'all' } } });
  const pk = {};
  for (const [k, p] of Object.entries({
    m1: { name: '1 month', name_ar: 'شهر', months: 1, price: 2500, sort: 1 },
    m3: { name: '3 months', name_ar: '٣ شهور', months: 3, price: 6500, sort: 2 },
    m6: { name: '6 months', name_ar: '٦ شهور', months: 6, price: 11500, before_price: 13000, until: daysFromNow(20), sort: 3 },
    m12: { name: '12 months', name_ar: 'سنة', months: 12, price: 19900, sort: 4 } })) {
    pk[k] = (await as('owner', 'owner_upsert_package', { p })).id;
  }

  // ---- 14 members on the gym's list (phones 0100000 0001..0014)
  const list = [
    ['01000000001', 'Omar Hassan', 'm', 'm3', -40, 50],
    ['01000000002', 'Karim Adel', 'm', 'm1', -25, 5],
    ['01000000003', 'Youssef Nabil', 'm', 'm12', -200, 165],
    ['01000000004', 'Mona Ibrahim', 'f', 'm3', -60, 30],
    ['01000000005', 'Salma Fathy', 'f', 'm6', -30, 150],
    ['01000000006', 'Nour Khaled', 'f', 'm1', -28, 2],
    ['01000000007', 'Ahmed Samir', 'm', 'm1', -33, -3],
    ['01000000008', 'Mahmoud Tarek', 'm', 'm3', -10, 80],
    ['01000000009', 'Hassan Aly', 'm', 'm6', -100, 80],
    ['01000000010', 'Mostafa Ezz', 'm', 'm1', -5, 25],
    ['01000000011', 'Sara Magdy', 'f', 'm3', -70, 20],
    ['01000000012', 'Dina Raouf', 'f', 'm12', -300, 65],
    ['01000000013', 'Hala Mansour', 'f', 'm1', -20, 10],
    ['01000000014', 'Tamer Lotfy', 'm', 'm3', -85, 6],
  ];
  const imp = await as('owner', 'owner_import_members', { p_rows: list.map(r => ({
    phone: r[0], name: r[1], gender: r[2], package_id: pk[r[3]], starts: daysFromNow(r[4]), ends: daysFromNow(r[5]) })) });
  if (imp.errors.length) throw new Error('import errors ' + JSON.stringify(imp.errors));
  await as('owner', 'owner_go_live', {});

  // ---- members who already joined (PIN 123456)
  const joined = [
    ['omar', '01000000001', 'Omar Hassan', 'm', 1996, { goal: 'Build muscle', level: 'Intermediate', times: ['morning', 'evening'], bio: 'Push pull legs, 5 days a week.' }],
    ['karim', '01000000002', 'Karim Adel', 'm', 1999, { goal: 'Lose fat', level: 'Beginner', times: ['evening'], bio: 'New here, looking for a steady partner.' }],
    ['youssef', '01000000003', 'Youssef Nabil', 'm', 1992, { goal: 'Strength', level: 'Advanced', times: ['morning'], bio: 'Powerlifting. Happy to spot.' }],
    ['mona', '01000000004', 'Mona Ibrahim', 'f', 1998, { goal: 'Get fit', level: 'Beginner', times: ['morning'], bio: 'Cardio and light weights.' }],
    ['salma', '01000000005', 'Salma Fathy', 'f', 1995, { goal: 'Build muscle', level: 'Intermediate', times: ['evening'], vis: 'all', bio: 'Leg day is the best day.' }],
    ['nour', '01000000006', 'Nour Khaled', 'f', 2000, { goal: 'Lose fat', level: 'Beginner', times: ['morning', 'afternoon'] }],
    ['ahmed', '01000000007', 'Ahmed Samir', 'm', 1990, { goal: 'Stay active', level: 'Intermediate', times: ['night'] }],
  ];
  for (const [key, phone, name, gender, year, patch] of joined) {
    await memberUser(key, phone);
    await as(key, 'member_join', { p_slug: 'atlas', p_name: name, p_gender: gender, p_birth_year: year });
    await as(key, 'update_profile', { p_patch: patch });
  }
  // a guest: joined, but his phone is not on the gym's list -> owner sees a "guest" need
  await memberUser('guest', '01000000020');
  await as('guest', 'member_join', { p_slug: 'atlas', p_name: 'Ziad Guest', p_gender: 'm', p_birth_year: 2001 });

  // ---- requests, one refka with messages
  const id = k => users[k].id;
  const r1 = await as('omar', 'request_send', { p_gym: 'atlas', p_to: id('youssef'), p_kind: 'train', p_slot: 'Sat 8:00' });
  const acc = await as('youssef', 'request_respond', { p_id: r1.request.id, p_accept: true });
  for (const [who, body] of [['omar', 'Morning Youssef, Saturday 8 still good?'], ['youssef', 'Yes. Legs or back?'],
    ['omar', 'Back. I need a spot on rows.'], ['youssef', 'Deal. See you at the rack.']]) {
    await as(who, 'chat_send', { p_refka: acc.refka_id, p_body: body });
  }
  await as('karim', 'request_send', { p_gym: 'atlas', p_to: id('omar'), p_kind: 'train', p_slot: 'Mon 19:00' });   // Omar: incoming
  await as('omar', 'request_send', { p_gym: 'atlas', p_to: id('salma'), p_kind: 'spot', p_slot: 'Tue 18:30' });    // Omar: outgoing
  await as('mona', 'request_send', { p_gym: 'atlas', p_to: id('nour'), p_kind: 'train', p_slot: 'Sun 9:00' });     // Nour: incoming

  // ---- feed
  const posts = [
    ['youssef', 'New deadlift PR today: 180 kg. Thanks Omar for the push.', null],
    ['salma', 'Leg day done. Who is in for Thursday evening?', img],
    ['omar', 'Looking for someone to train chest with on Mondays.', null],
    ['mona', 'First full month without missing a session.', null],
    ['karim', 'Week 3. Down 2 kg. Slow and steady.', null],
  ];
  const postIds = [];
  for (const [who, body, i] of posts) postIds.push((await as(who, 'post_create', { p_gym: 'atlas', p_body: body, p_img: i })).post.id);
  await as('omar', 'post_respect', { p_id: postIds[0] });
  await as('karim', 'post_respect', { p_id: postIds[0] });
  await as('youssef', 'post_respect', { p_id: postIds[2] });

  // ---- owner needs: a payment to approve and a report; plus check-ins
  await as('karim', 'member_renew', { p_gym: 'atlas', p_package_id: pk.m3, p_method: 'instapay', p_ref: 'IP-448201' });
  await as('nour', 'report', { p_gym: 'atlas', p_post: postIds[3], p_reason: 'Demo report: please check this post.' });
  const mem = await as('owner', 'owner_members', { p_q: '' });
  for (const n of ['Omar Hassan', 'Youssef Nabil', 'Salma Fathy', 'Mahmoud Tarek']) {
    await as('owner', 'owner_checkin', { p_membership_id: mem.find(x => x.name === n).id });
  }

  // ---- spread the demo data over the last days (direct SQL, seed only)
  await pool.query(`update posts set at = at - (interval '7 hours' * (select count(*) from posts p2 where p2.at > posts.at))`);
  await pool.query(`update messages set at = at - interval '2 hours'`);
  await pool.query(`insert into checkins (gym_id, membership_id, at, via)
    select m.gym_id, m.id, now() - (d || ' days')::interval - interval '5 hours', 'qr'
    from memberships m cross join generate_series(1, 6) d
    where m.status = 'active' and (hashtext(m.id::text || d::text) % 3) <> 0`);
  await pool.end();

  console.log('\nSeeded "Atlas Gym"  ->  http://localhost:54321/app/?g=atlas   (owner console: http://localhost:54321/app/owner/)');
  console.log('\nOwner   owner@atlas.test / atlas1234');
  console.log('Members (phone / PIN ' + PIN + '), already joined with profiles:');
  for (const j of joined) console.log('  ' + j[1] + '  ' + j[2].padEnd(15) + j[3] + '  ' + (j[0] === 'ahmed' ? '(membership expired 3 days ago)' : j[0] === 'mona' || j[0] === 'nour' ? '(vis: gender)' : ''));
  console.log('  01000000020  Ziad Guest     m  (guest, waits for the owner)');
  console.log('On the list, not joined yet (sign up with any 6 digit PIN): 01000000008 .. 01000000014');
  console.log('Not on the list (joins as guest): any other phone, e.g. 01000000099');
})().catch(e => { console.error('seed failed:', e.body || e); process.exit(1); });

function daysFromNow(n) { const d = new Date(Date.now() + n * 86400000); return d.toISOString().slice(0, 10); }
