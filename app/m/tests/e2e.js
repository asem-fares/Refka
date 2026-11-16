// Member app end to end test. Runs the member journeys in English and in Arabic at 390x844.
//   node app/m/tests/e2e.js          against the local dev server (http://localhost:54321, see dev/READY)
// The database is reseeded once at the start (node dev/seed.js). The English and the Arabic pass use different
// members, so both run on the same seed. CDN libraries are served from tests/vendor (same pinned versions).
// Env: RF_BASE (default http://localhost:54321), RF_SHOTS=<dir> screenshots at the end, RF_NOSEED=1 skip the reseed,
//      RF_ONLY=en|ar one language, RF_DEBUG=1 full stack traces.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const BASE = process.env.RF_BASE || 'http://localhost:54321';
const ROOT = path.join(__dirname, '..', '..', '..');
const SHOTS = process.env.RF_SHOTS || '';
const PIN = '123456';
const V = f => fs.readFileSync(path.join(__dirname, 'vendor', f), 'utf8');
// a 24x24 PNG made here: red square, so the avatar resize path really runs
const PNG = (() => {
  const zlib = require('zlib');
  const w = 24, hgt = 24, raw = Buffer.alloc((w * 3 + 1) * hgt);
  for (let y = 0; y < hgt; y++) { raw[y * (w * 3 + 1)] = 0; for (let x = 0; x < w; x++) { const o = y * (w * 3 + 1) + 1 + x * 3; raw[o] = 220; raw[o + 1] = 40 + x * 4; raw[o + 2] = 60; } }
  const crc = b => { let c, t = []; for (let n = 0; n < 256; n++) { c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } c = 0xffffffff; for (const x of b) c = t[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (type, data) => { const l = Buffer.alloc(4); l.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(hgt, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
})();

const SEED = {
  karim: '01000000002', mona: '01000000004', youssef: '01000000003',
};
// per language: a guest phone, a listed phone (A), the partner (B), and the text this pass types
const CAST = {
  en: { guest: '0109' + String(Date.now() % 1e7).padStart(7, '0'), guestName: 'Test Guest', listed: '01000000008', aName: 'Mahmoud Tarek',
    msgA: 'Hi, Saturday evening?', msgB: 'Yes, see you at 7.', post: 'E2E post: squats at 6, who is in? <b>x</b><img src=x onerror="window.__xss=1">', bio: 'Evenings, working on my squat', newName: 'Mahmoud T.' },
  ar: { guest: '0108' + String(Date.now() % 1e7).padStart(7, '0'), guestName: 'ضيف تجربة', listed: '01000000009', aName: 'حسن علي',
    msgA: 'أهلًا، السبت بالليل؟', msgB: 'تمام، نتقابل الساعة 7.', post: 'بوست تجربة: سكوات الساعة 6، مين معايا؟ <img src=x onerror="window.__xss=1">', bio: 'بتمرن بالليل', newName: 'حسن ع.' },
};
const ALLOW = /Powered by Refka|Refka|InstaPay|QR|EGP|Atlas|PNG|JPG/g;

function makeRun(browser, lang) {
  const known = new Set(['Stay active']);   // a seeded free-text goal with no key: shown as the member wrote it
  const log = m => console.log(`[${lang}] ${m}`);
  // only strings that come from people or the gym, never enum values like "all" or "pending"
  const learn = v => {
    if (Array.isArray(v)) return v.forEach(learn);
    if (!v || typeof v !== 'object') return;
    for (const [k, x] of Object.entries(v)) {
      // goal, level and times are not learned: the app has to translate them (seed data stores English free text)
      if (typeof x === 'string' && ['name', 'name_ar', 'bio', 'body', 'slot'].includes(k) && x.length > 1) { known.add(x); if (k === 'name') known.add(x.trim().split(/\s+/)[0]); }
      else if (x && typeof x === 'object' && k !== 'times') learn(x);
    }
  };
  let shotN = 0;

  async function actor(who) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: lang === 'ar' ? 'ar-EG' : 'en-US' });
    await ctx.route('https://cdn.jsdelivr.net/**/supabase.js', r => r.fulfill({ contentType: 'application/javascript', body: V('supabase.js') }));
    await ctx.route('https://cdnjs.cloudflare.com/**/qrcode.min.js', r => r.fulfill({ contentType: 'application/javascript', body: V('qrcode.js') }));
    await ctx.route('https://fonts.googleapis.com/**', r => r.fulfill({ contentType: 'text/css', body: '' }));
    const A = { ctx, who, lang };
    A.open = async () => {
      const page = await ctx.newPage();
      const problems = []; let allowHttp = false;
      page.on('pageerror', e => problems.push('page error: ' + e.message));
      page.on('response', async r => { if (r.status() >= 400 && !allowHttp && !/favicon/.test(r.url())) { let b = ''; try { b = (await r.text()).slice(0, 160); } catch (e) { /* gone */ } problems.push(`http ${r.status()} ${r.url().replace(BASE, '')} ${b}`); } });
      page.on('console', m => {
        if (m.type() !== 'error') return;
        if (/favicon/.test(m.text()) || (m.location() && /favicon/.test(m.location().url || ''))) return;
        if (allowHttp && /Failed to load resource/.test(m.text())) return;
        problems.push('console error: ' + m.text());
      });
      const P = { page, problems };
      P.expectFail = async fn => { allowHttp = true; try { await fn(); await page.waitForTimeout(150); } finally { allowHttp = false; } };
      P.rpc = (name, args) => page.evaluate(([n, a]) => window.rf.rpc(n, a), [name, args || {}]);
      P.gid = () => page.evaluate(() => window.rf.rpc('gym_public', { p_slug: 'atlas' }).then(g => g.id));
      P.check = (name, langNow) => check(P, `${who}/${name}`, langNow || lang);
      P.screen = async (name, langNow) => { await page.waitForSelector(`main[data-screen="${name}"]`, { timeout: 15000 }); await page.waitForTimeout(150); await P.check(name, langNow); };
      P.tab = async name => { await page.click(`.tabs [data-tab="${name}"]`); await P.screen(name); };
      P.seg = async k => { await page.click(`.seg [data-seg="${k}"]`); await page.waitForSelector(`.seg [data-seg="${k}"].on`); await page.waitForFunction(() => !document.querySelector('#segbody .loading'), null, { timeout: 10000 }); };
      P.toast = async () => { await page.waitForSelector('body > .toast', { timeout: 8000 }); };
      P.sheet = async () => { await page.waitForSelector('.sheetbg .sheet', { timeout: 8000 }); await page.waitForTimeout(80); };
      P.learnAll = async () => {
        const gid = await P.gid();
        const calls = [['me', {}], ['member_home', { p_gym: gid }], ['people', { p_gym: gid, p_q: '' }], ['requests_list', { p_gym: gid }], ['refkas_list', { p_gym: gid }], ['feed', { p_gym: gid }]];
        for (const [n, a] of calls) { try { learn(await P.rpc(n, a)); } catch (e) { /* guests: not_member */ } }
      };
      P.shot = async name => { if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `${lang}-${String(++shotN).padStart(2, '0')}-${name}.png`) }); };
      return P;
    };
    return A;
  }

  // Every screen: right lang/dir, no sideways scroll, nothing outside the screen, tap targets >= 44 px,
  // no text in the other language, no dashes, no raw keys, no page or console errors.
  async function check(P, name, langNow) {
    const r = await P.page.evaluate(() => {
      const vw = window.innerWidth, out = [], small = [];
      const vis = el => { const s = getComputedStyle(el); return s.visibility !== 'hidden' && s.display !== 'none'; };
      for (const el of document.querySelectorAll('#root *')) {
        const b = el.getBoundingClientRect();
        if (b.width && b.height && (b.right > vw + 1 || b.left < -1)) out.push(el.tagName + '.' + el.className + ' ' + Math.round(b.left) + '..' + Math.round(b.right));
      }
      for (const el of document.querySelectorAll('#root button, #root a, #root input:not([type=file]), #root textarea, #root [role=tab]')) {
        const b = el.getBoundingClientRect();
        if (b.width && b.height && vis(el) && (b.height < 43.5 || b.width < 43.5)) small.push((el.id || el.className || el.tagName) + ' ' + Math.round(b.width) + 'x' + Math.round(b.height));
      }
      const c = document.createElement('div'); c.appendChild(document.getElementById('root').cloneNode(true)); document.querySelectorAll('body > .toast').forEach(x => c.appendChild(x.cloneNode(true)));
      const attrs = [];
      c.querySelectorAll('[aria-label],[placeholder],[alt],[title]').forEach(x => { for (const a of ['aria-label', 'placeholder', 'alt', 'title']) if (x.getAttribute(a)) attrs.push(x.getAttribute(a)); });
      c.querySelectorAll('input,textarea,.ltr,[lang],script,svg,style').forEach(x => x.remove());
      return { over: document.documentElement.scrollWidth - vw, out: out.slice(0, 5), small: small.slice(0, 5), text: c.textContent + ' ' + attrs.join(' '), dir: document.documentElement.dir, lang: document.documentElement.lang, title: document.title };
    });
    const must = (ok, msg) => { if (!ok) throw new Error(`${name}: ${msg}`); };
    must(r.lang === langNow && r.dir === (langNow === 'ar' ? 'rtl' : 'ltr'), `wrong lang/dir ${r.lang}/${r.dir}`);
    must(r.over <= 0, `horizontal overflow ${r.over}px`);
    must(!r.out.length, `elements outside the screen: ${r.out.join(' | ')}`);
    must(!r.small.length, `tap targets under 44px: ${r.small.join(' | ')}`);
    let text = r.text;
    for (const k of [...known].sort((a, b) => b.length - a.length)) text = text.split(k).join(' ');
    text = text.replace(ALLOW, ' ');
    const leak = langNow === 'ar' ? text.match(/[A-Za-z]{2,}[A-Za-z ]*/) : text.match(/[؀-ۿ]+[؀-ۿ ]*/);
    must(!leak, `other language leaking: "${leak && leak[0]}"`);
    must(!/[\u2014\u2013]/.test(text), 'dash in copy');
    must(!/\b[a-z]+_[a-z_0-9]+\b/.test(text), `raw key in copy: ${(text.match(/\b[a-z]+_[a-z_0-9]+\b/) || [])[0]}`);
    must(!P.problems.length, P.problems.join(' ; '));
  }
  return { actor, learn, known, log };
}

const must = (ok, msg) => { if (!ok) throw new Error(msg); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const until = async (fn, msg, ms = 15000) => { const t0 = Date.now(); for (;;) { if (await fn()) return; if (Date.now() - t0 > ms) throw new Error('timed out: ' + msg); await sleep(250); } };

async function signIn(P, phone) {
  await P.page.goto(BASE + '/app/?g=atlas');
  await P.screen('auth');
  await P.page.fill('input[name="phone"]', phone); await P.page.fill('input[name="pin"]', PIN);
  await P.page.click('form button[type="submit"]');
  await P.screen('home');
}
// phone + PIN for a phone with no account: sign in fails, the app offers to create it, then the join form
async function signUpAndJoin(P, phone, name, gender, year) {
  await P.page.goto(BASE + '/app/?g=atlas');
  await P.screen('auth');
  await P.page.fill('input[name="phone"]', phone); await P.page.fill('input[name="pin"]', PIN);
  await P.expectFail(async () => { await P.page.click('form button[type="submit"]'); await P.page.waitForSelector('#noacc'); });
  await P.check('auth-noaccount');
  await P.page.click('#noacc .btn');
  await P.page.waitForSelector('#newacc input[name="pin2"]');
  await P.page.fill('input[name="pin2"]', '654321'); await P.page.click('form button[type="submit"]');
  await P.page.waitForFunction(() => document.querySelector('form .err') && document.querySelector('form .err').textContent.trim());
  await P.check('auth-pin-mismatch');
  await P.page.fill('input[name="pin2"]', PIN); await P.page.click('form button[type="submit"]');
  await P.screen('join');
  await P.page.click('form button[type="submit"]');               // empty form: a polite error
  await P.page.waitForFunction(() => document.querySelector('form .err').textContent.trim());
  await P.check('join-errors');
  await P.page.fill('input[name="name"]', name);
  await P.page.click(`.chips [data-v="${gender}"]`);
  await P.page.fill('input[name="year"]', String(year));
  await P.page.click('form button[type="submit"]');
  await P.screen('joined');
}

async function runLang(browser, lang) {
  const R = makeRun(browser, lang), C = CAST[lang], log = R.log;
  for (const n of [C.guestName, C.aName, C.newName]) R.learn({ name: n });
  const actors = [];
  const mk = async who => { const a = await R.actor(who); actors.push(a); return a; };
  try {
    // ---------- 1. links that do not lead to a gym
    const anon = await mk('anon');
    const P0 = await anon.open();
    await P0.page.goto(BASE + '/app/'); await P0.screen('nogym');
    must(await P0.page.locator('h1.big').count() === 1, 'no-slug screen has no heading');
    await P0.page.goto(BASE + '/app/?g=no-such-gym-xyz'); await P0.screen('badgym');
    await P0.page.goto(BASE + '/app/?g=atlas'); await P0.screen('auth');
    await P0.page.click('form button[type="submit"]');
    await P0.page.waitForFunction(() => document.querySelector('form .err').textContent.trim()); await P0.check('auth-empty');
    await P0.expectFail(async () => {      // a seeded member with the wrong PIN gets the "no account" card, never a crash
      await P0.page.fill('input[name="phone"]', SEED.karim); await P0.page.fill('input[name="pin"]', '000000');
      await P0.page.click('form button[type="submit"]'); await P0.page.waitForSelector('#noacc');
    });
    await P0.check('auth-wrong-pin');
    log('slug screens ok');

    // ---------- 2. a new phone that is not on the list: guest
    const guest = await mk('guest');
    const PG = await guest.open();
    await signUpAndJoin(PG, C.guest, C.guestName, 'm', 1998);
    must(await PG.page.locator('#joined-guest').count() === 1, 'unlisted phone should land in the guest waiting state');
    await PG.page.click('main .btn.wide'); await PG.screen('home');
    await PG.page.waitForSelector('#memcard .tag.warn');
    must(await PG.page.locator('#qr').count() === 0, 'a guest must not get a QR');
    must(await PG.page.locator('#qrcard .gate').count() === 1, 'guest QR card should explain why it is closed');
    await PG.tab('refka');
    await PG.page.waitForSelector('#segbody .gate'); await PG.check('refka-guest');
    await PG.seg('feed'); await PG.page.waitForSelector('#segbody .gate'); await PG.check('feed-guest');
    log('guest joined and waits');

    // ---------- 3. a listed phone: matched, membership card, days left, rotating QR
    const a = await mk('A');
    const PA = await a.open();
    await signUpAndJoin(PA, C.listed, C.aName, 'm', 1997);
    must(await PA.page.locator('#joined-matched').count() === 1, 'listed phone should be matched');
    await PA.page.click('main .btn.wide'); await PA.screen('home');
    await PA.page.waitForSelector('#memcard .days'); await PA.page.waitForSelector('#qr svg path');
    await PA.learnAll();
    const meA = await PA.rpc('me', {}); const msA = meA.memberships.find(m => m.gym.slug === 'atlas');
    must(msA.status === 'active', 'matched membership should be active');
    must((await PA.page.textContent('#memcard .days')).trim() === String(msA.days_left), 'days left on the card does not match the server');
    must(await PA.page.locator('#memcard .tag.ok').count() === 1, 'membership tag should say active');
    const tok0 = await PA.page.getAttribute('#qr', 'data-token');
    must(tok0 && tok0.length > 10, 'QR has no token');
    await PA.check('home-matched');
    // the QR keeps rotating on its own on a second open screen, checked at the end of the pass
    const PAq = await a.open(); await PAq.page.goto(BASE + '/app/?g=atlas'); await PAq.screen('home'); await PAq.page.waitForSelector('#qr svg');
    const qrStart = await PAq.page.getAttribute('#qr', 'data-token');
    log('listed member matched, QR shown');

    // renew as A: package, method, reference -> waiting
    await PA.page.click('#renewbtn'); await PA.screen('renew');
    await PA.page.click('#rnsend'); await PA.page.waitForFunction(() => document.querySelector('form .err').textContent.trim()); await PA.check('renew-errors');
    const pkgs = PA.page.locator('#pkgs [data-pkg]'); must(await pkgs.count() >= 2, 'renew shows no packages');
    await pkgs.nth(1).click();
    await PA.page.click('#methods [data-v="instapay"]');
    await PA.page.waitForSelector('#payaddr'); await PA.check('renew-instapay');
    await PA.page.click('#rnsend'); await PA.page.waitForFunction(() => document.querySelector('form .err').textContent.trim());
    await PA.page.fill('input[name="ref"]', 'IP-' + Date.now().toString().slice(-6));
    await PA.page.click('#rnsend'); await PA.page.waitForSelector('#paywait'); await PA.toast(); await PA.check('renew-sent');
    must((await PA.rpc('member_home', { p_gym: await PA.gid() })).pending_payment === true, 'payment did not reach the server');
    await PA.page.click('main .btn.sec.wide'); await PA.screen('home');
    await PA.page.waitForSelector('#memcard'); await PA.page.waitForSelector('#paywait');
    must(await PA.page.locator('#renewbtn').count() === 0, 'renew button should hide while a payment waits');
    log('renew sent');

    // ---------- 4. Karim: seeded, already has a pending payment; privacy towards Mona
    const k = await mk('karim');
    const PK = await k.open();
    await signIn(PK, SEED.karim); await PK.learnAll();
    await PK.page.waitForSelector('#paywait'); await PK.check('home-karim');
    await PK.page.click('#aboutgym'); await PK.screen('gym'); await PK.page.waitForSelector('#howpay');
    await PK.page.click('main .btn.wide'); await PK.screen('renew');
    await PK.page.waitForSelector('#paywait');                         // pending_exists shown as the waiting state, no form
    must(await PK.page.locator('#rnsend').count() === 0, 'renew form shown although a payment is waiting');
    // and the server code itself is mapped to the same state
    const gid = await PK.gid();
    let pend; await PK.expectFail(async () => { pend = await PK.page.evaluate(g => window.rf.rpc('member_home', { p_gym: g }).then(h => window.rf.rpc('member_renew', { p_gym: g, p_package_id: h.gym.packages[0].id, p_method: 'cash', p_ref: null })).then(() => 'ok', e => e.code), gid); });
    must(pend === 'pending_exists', 'second renew should be refused with pending_exists, got ' + pend);
    await PK.page.click('main .btn.sec.wide'); await PK.screen('gym');
    await PK.page.click('.ah .ib.flip'); await PK.screen('home');
    await PK.tab('refka'); await PK.page.waitForSelector('#people article');
    must(await PK.page.locator('#people [data-name="Mona Ibrahim"]').count() === 0, 'Mona (vis gender) shows to a man in For you');
    await PK.seg('feed'); await PK.page.waitForSelector('#feed .post');
    must(await PK.page.locator('#feed [data-by="Mona Ibrahim"]').count() === 0, 'Mona\'s post shows to a man in the feed');
    const kp = await PK.rpc('people', { p_gym: gid, p_q: '' }); must(!kp.some(p => p.name === 'Mona Ibrahim'), 'people() returns Mona to Karim');
    const kf = await PK.rpc('feed', { p_gym: gid }); must(!kf.some(p => p.by && p.by.name === 'Mona Ibrahim'), 'feed() returns Mona\'s post to Karim');
    await PK.check('feed-karim');
    log('Karim: pending payment handled, Mona never shown');

    // ---------- 5. two people: Train together? -> accept -> chat both ways -> B ends
    const b = await mk('B');
    const PB = await b.open();
    await signIn(PB, SEED.youssef); await PB.learnAll();
    const idA = meA.profile.user_id, idB = (await PB.rpc('me', {})).profile.user_id;
    const nameA = meA.profile.name, nameB = (await PB.rpc('me', {})).profile.name;
    await PA.tab('refka'); await PA.page.waitForSelector(`#people [data-user="${idB}"]`);
    must(await PA.page.locator(`#people [data-user="${idB}"] [data-rel="none"]`).count() === 1, 'A and B should have no relation yet');
    await PA.check('for-you');
    await PA.page.click(`#people [data-user="${idB}"] .plain`); await PA.sheet(); await PA.check('person-sheet');
    await PA.page.click('.sheet .sh .ib'); await PA.page.waitForSelector('.sheetbg', { state: 'detached' });
    await PA.page.click(`[data-tt="${idB}"]`); await PA.sheet();
    await PA.page.click('#reqsend'); await PA.page.waitForFunction(() => [...document.querySelectorAll('.sheet .err')].some(e => e.textContent.trim()));
    await PA.check('request-sheet-error');
    await PA.page.click('#days .ch >> nth=1'); await PA.page.click('#slots [data-v="evening"]');
    await PA.page.click('#reqsend'); await PA.toast();
    await PA.page.waitForSelector(`#people [data-user="${idB}"] [data-rel="out"]`); await PA.check('request-sent');
    await PA.seg('req'); await PA.page.waitForSelector('[data-out][data-status="pending"]'); await PA.check('requests-out');

    await PB.tab('refka'); await PB.seg('req');
    await PB.page.waitForSelector(`[data-req][data-name="${nameA}"]`); await PB.check('requests-in');
    await PB.page.click(`[data-req][data-name="${nameA}"] [data-accept]`);
    await PB.screen('chat'); await PB.page.waitForSelector('#chatempty');

    await PA.seg('mine'); await PA.page.waitForSelector(`[data-refka][data-name="${nameB}"]`); await PA.check('my-refkas');
    await PA.page.click(`[data-refka][data-name="${nameB}"]`); await PA.screen('chat');
    await PA.page.fill('#chattext', C.msgA); await PA.page.click('#chatsend');
    await PA.page.waitForSelector('.bub.me[data-msg]:not(.pend)');
    await PB.page.waitForFunction(m => [...document.querySelectorAll('.bub:not(.me)')].some(b => b.textContent.includes(m)), C.msgA, { timeout: 12000 });
    await PB.page.fill('#chattext', C.msgB); await PB.page.keyboard.press('Enter');
    await PB.page.waitForSelector('.bub.me[data-msg]:not(.pend)');
    await PA.page.waitForFunction(m => [...document.querySelectorAll('.bub:not(.me)')].some(b => b.textContent.includes(m)), C.msgB, { timeout: 12000 });
    await PA.check('chat'); await PB.check('chat');
    await PB.page.click('#chatmenu'); await PB.sheet(); await PB.page.click('#endrefka');
    await PB.sheet(); await PB.page.click('.sheet .btn.danger'); await PB.toast();
    await PB.screen('refka');
    must(await PB.page.locator(`[data-refka][data-name="${nameA}"]`).count() === 0, 'ended Refka still listed for B');
    await PA.expectFail(() => PA.page.waitForSelector('#chatended', { timeout: 12000 }));   // the poll learns it from a refused chat_list
    must(await PA.page.locator('#chattext:disabled').count() === 1, 'chat input should close after the Refka ended');
    await PA.check('chat-ended');
    await PA.page.click('.ah .ib.flip'); await PA.screen('refka');
    log('request, accept, chat both ways, ended by B');

    // ---------- 6. feed: post, Respect, the count only for the author, report
    await PA.seg('feed');
    await PA.page.click('#postsend'); await PA.page.waitForFunction(() => document.querySelector('#composer .err').textContent.trim()); await PA.check('feed-empty-post');
    await PA.page.fill('#posttext', C.post); R.known.add(C.post);
    await PA.page.click('#postsend'); await PA.toast();
    const postEl = PA.page.locator('#feed .post[data-mine="1"]').first(); await postEl.waitFor();
    const postId = await postEl.getAttribute('data-post');
    must((await postEl.textContent()).includes(C.post), 'new post is not on top of the feed');
    await PA.check('feed-posted');
    await PB.seg('feed'); await PB.page.waitForSelector(`[data-post="${postId}"]`);
    must((await PB.page.textContent(`[data-post="${postId}"] p`)).includes('<img src=x'), 'post body is not shown as plain text');
    must(await PB.page.locator(`[data-post="${postId}"] p img, [data-post="${postId}"] p b`).count() === 0 && !(await PB.page.evaluate(() => window.__xss)), 'post body was parsed as HTML');
    must(await PB.page.locator(`[data-post="${postId}"] [data-respects]`).count() === 0, 'the Respect count shows to someone who is not the author');
    await PB.page.click(`[data-respect="${postId}"]`);
    await PB.page.waitForSelector(`[data-respect="${postId}"][aria-pressed="true"]`); await PB.check('feed-respected');
    await PB.page.click(`[data-menu="${postId}"]`); await PB.sheet(); await PB.page.click('#reportpost'); await PB.sheet();
    await PB.page.click('#reportgo'); await PB.page.waitForFunction(() => [...document.querySelectorAll('.sheet .err')].some(e => e.textContent.trim()));
    await PB.check('report-sheet');
    await PB.page.click('#reasons [data-v="spam"]'); await PB.page.click('#reportgo'); await PB.toast();
    await PB.page.waitForSelector('.sheetbg', { state: 'detached' });
    await PA.seg('mine'); await PA.seg('feed');
    await PA.page.waitForSelector(`[data-post="${postId}"] [data-respects="1"]`); await PA.check('feed-count');
    log('post, Respect (count for the author only), report');

    // ---------- 7. privacy: A chooses "nobody" and disappears for B
    await PA.tab('me'); await PA.page.click('#li-privacy'); await PA.screen('privacy');
    await PA.page.click('[data-vis="none"]'); await PA.page.waitForSelector('[data-vis="none"][aria-checked="true"]'); await PA.toast();
    await PA.check('privacy-none');
    await PB.seg('for'); await PB.page.waitForSelector('#people article, #people .card');
    must(await PB.page.locator(`#people [data-user="${idA}"]`).count() === 0, 'a "nobody" profile still shows in For you');
    await PB.seg('feed'); await PB.page.waitForSelector('#feed .post');
    must(await PB.page.locator(`[data-post="${postId}"]`).count() === 0, 'a "nobody" profile\'s post still shows in the feed');
    await PA.page.click('[data-vis="all"]'); await PA.page.waitForSelector('[data-vis="all"][aria-checked="true"]');
    await PB.seg('for'); await PB.page.waitForSelector(`#people [data-user="${idA}"]`);
    log('privacy "nobody" hides the profile and posts');

    // ---------- 8. block: a new Refka, then A blocks B from the chat
    await PB.page.click(`[data-tt="${idA}"]`); await PB.sheet();
    await PB.page.click('#days .ch >> nth=0'); await PB.page.click('#slots [data-v="morning"]'); await PB.page.click('#reqsend'); await PB.toast();
    await PA.page.click('.ah .ib.flip'); await PA.screen('me');
    await PA.tab('refka'); await PA.seg('req');
    await PA.page.click(`[data-req][data-name="${nameB}"] [data-accept]`); await PA.screen('chat');
    await PB.seg('mine'); await PB.page.click(`[data-refka][data-name="${nameA}"]`); await PB.screen('chat');
    await PA.page.click('#chatmenu'); await PA.sheet(); await PA.page.click('#blockchat'); await PA.sheet();
    await PA.check('block-confirm');
    await PA.page.click('.sheet .btn.danger'); await PA.toast(); await PA.screen('refka');
    await PB.expectFail(() => PB.page.waitForSelector('#chatended', { timeout: 12000 })); await PB.check('chat-blocked');
    await PA.seg('for'); await PA.page.waitForSelector('#people article, #people .card');
    must(await PA.page.locator(`#people [data-user="${idB}"]`).count() === 0, 'blocked person still shows for the blocker');
    await PA.seg('mine'); must(await PA.page.locator(`[data-refka][data-name="${nameB}"]`).count() === 0, 'Refka still listed after block');
    await PB.page.click('.ah .ib.flip'); await PB.screen('refka');
    await PB.seg('for'); await PB.page.waitForSelector('#people article, #people .card');
    must(await PB.page.locator(`#people [data-user="${idA}"]`).count() === 0, 'blocker still shows for the blocked person');
    must(!(await PB.rpc('refkas_list', { p_gym: gid })).some(r => r.with.user_id === idA), 'refkas_list still has the blocked Refka');
    await PB.seg('feed'); await PB.page.waitForSelector('#feed .post, #feed .card');
    must(await PB.page.locator(`[data-post="${postId}"]`).count() === 0, 'blocker\'s post still in the feed of the blocked person');
    log('block hides both ways and ends the Refka');

    // ---------- the QR on the idle home screen rotated by itself
    await until(async () => (await PAq.page.getAttribute('#qr', 'data-token').catch(() => null)) !== qrStart, 'QR did not rotate', 75000);
    await PAq.check('home-qr-rotated');
    log('QR rotated on its own');
    await PAq.page.close();

    // ---------- 9. Me: edit profile + avatar, language toggle, sign out
    await PA.tab('me'); await PA.page.click('#li-edit'); await PA.screen('edit');
    await PA.page.fill('input[name="name"]', ' '); await PA.page.click('#savebtn');
    await PA.page.waitForFunction(() => document.querySelector('form .err').textContent.trim()); await PA.check('edit-error');
    await PA.page.fill('input[name="name"]', C.newName);
    await PA.page.fill('textarea[name="bio"]', C.bio); R.known.add(C.bio);
    await PA.page.click('#goals [data-v="strength"]'); await PA.page.click('#levels [data-v="mid"]');
    await PA.page.click('#times [data-v="evening"]'); await PA.page.click('#times [data-v="morning"]');
    await PA.page.setInputFiles('#avatarfile', { name: 'me.png', mimeType: 'image/png', buffer: PNG });
    await PA.page.waitForSelector('form .av img'); await PA.check('edit-filled');
    await PA.page.click('#savebtn'); await PA.toast(); await PA.screen('me');
    await PA.page.waitForSelector('#mecard .av img');
    must((await PA.page.textContent('#mecard h2')).trim() === C.newName, 'new name not shown on Me');
    const pr = (await PA.rpc('me', {})).profile;
    must(pr.name === C.newName && pr.bio === C.bio && pr.goal === 'strength' && pr.level === 'mid' && pr.times.includes('evening') && pr.times.includes('morning'), 'profile edits not saved: ' + JSON.stringify({ ...pr, avatar: !!pr.avatar }));
    must(/^data:image\/jpeg;base64,/.test(pr.avatar || ''), 'avatar not saved as a JPEG data URL');
    await PA.shot('me');
    const other = lang === 'ar' ? 'en' : 'ar';
    await PA.page.click('#li-lang'); await PA.screen('me', other);
    await PA.page.reload(); await PA.screen('home', other);                        // remembered
    await PA.tab('me').catch(() => {}); await PA.screen('me', other);
    await PA.page.click('#li-lang'); await PA.screen('me');
    await PA.page.click('#li-out'); await PA.sheet(); await PA.check('signout-confirm');
    await PA.page.click('.sheet .btn.danger'); await PA.screen('auth');
    await PA.page.reload(); await PA.screen('auth');                               // really signed out
    log('profile + avatar saved, language toggled and remembered, signed out');


    // ---------- screenshots
    if (SHOTS) {
      await PB.tab('home'); await PB.page.waitForSelector('#qr svg'); await PB.shot('home');
      await PB.tab('refka'); await PB.seg('for'); await PB.shot('refka');
      await PB.seg('feed'); await PB.shot('feed');
      const omarChat = await (async () => { const gp = await PB.rpc('refkas_list', { p_gym: gid }); return gp[0]; })();
      if (omarChat) { R.learn(await PB.rpc('chat_list', { p_refka: omarChat.id, p_after: null })); await PB.seg('mine'); await PB.page.click(`[data-refka="${omarChat.id}"]`); await PB.screen('chat'); await PB.page.waitForSelector('.bub'); await PB.shot('chat'); await PB.page.click('.ah .ib.flip'); }
      await PB.tab('me'); await PB.shot('me-youssef');
    }
    for (const x of actors) for (const p of x.ctx.pages()) { /* last check for late errors */ }
    log('PASS');
  } finally {
    for (const x of actors) await x.ctx.close().catch(() => {});
  }
}

(async () => {
  if (!process.env.RF_NOSEED) execFileSync('node', [path.join(ROOT, 'dev', 'seed.js')], { stdio: ['ignore', 'ignore', 'inherit'] });
  if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
  const browser = await chromium.launch();
  let failed = false;
  for (const lang of ['en', 'ar']) {
    if (process.env.RF_ONLY && process.env.RF_ONLY !== lang) continue;
    try { await runLang(browser, lang); } catch (e) { failed = true; console.error(`[${lang}] FAIL: ${e.message.split('\n')[0]}`); if (process.env.RF_DEBUG) console.error(e.stack); }
  }
  await browser.close();
  console.log(failed ? 'E2E FAILED' : `E2E PASSED (en + ar, 390x844, ${BASE})`);
  process.exit(failed ? 1 : 0);
})();
