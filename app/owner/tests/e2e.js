// Owner console end to end test. Runs the whole journey in English and in Arabic at 390x844.
//   node app/owner/tests/e2e.js            against the local dev server (http://localhost:54321, see dev/READY)
//   RF_MOCK=1 RF_BASE=http://localhost:8099 node app/owner/tests/e2e.js   no backend: window.rf is replaced by tests/mock-api.js
// CDN libraries are served from tests/vendor (same pinned versions) so the test also runs without internet.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.RF_BASE || 'http://localhost:54321';
const MOCK = !!process.env.RF_MOCK;
const SHOTS = process.env.RF_SHOTS || '';
const ATLAS = { email: 'owner@atlas.test', password: 'atlas1234' };
const V = f => fs.readFileSync(path.join(__dirname, 'vendor', f), 'utf8');
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAFklEQVR4nGNkaGDACpiwC48sCWoAABFtAI8WMZq5AAAAAElFTkSuQmCC', 'base64');
const stamp = Date.now().toString(36);
const iso = n => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);

const TXT = {
  en: { owner: 'Hany Test', gym: 'Iron House', gymAr: 'بيت الحديد', m1: 'Ahmed Ali', m2: 'Mona Samir', m3: 'Tarek Fathy', m4: 'Nour Emad' },
  ar: { owner: 'هاني تجربة', gym: 'Power Zone', gymAr: 'باور زون', m1: 'أحمد علي', m2: 'منى سمير', m3: 'طارق فتحي', m4: 'نور عماد' },
};

async function runLang(browser, lang) {
  const L = TXT[lang], log = m => console.log(`[${lang}] ${m}`);
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: lang === 'ar' ? 'ar-EG' : 'en-US', permissions: ['clipboard-read', 'clipboard-write'] });
  await ctx.route('https://cdn.jsdelivr.net/**/supabase.js', r => r.fulfill({ contentType: 'application/javascript', body: V('supabase.js') }));
  await ctx.route('https://cdnjs.cloudflare.com/**/qrcode.min.js', r => r.fulfill({ contentType: 'application/javascript', body: V('qrcode.js') }));
  await ctx.route('https://fonts.googleapis.com/**', r => r.fulfill({ contentType: 'text/css', body: '' }));
  if (MOCK) await ctx.route('**/app/lib/api.js', r => r.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(path.join(__dirname, 'mock-api.js'), 'utf8') }));
  const page = await ctx.newPage();
  const problems = []; let allowHttp = false; const known = new Set(Object.values(L));
  page.on('pageerror', e => problems.push('page error: ' + e.message));
  page.on('console', m => {
    if (m.type() !== 'error') return;
    // A refused request (wrong password, taken link...) is logged by the browser itself; allowed only where the test expects one.
    if (allowHttp && /Failed to load resource/.test(m.text())) return;
    problems.push('console error: ' + m.text());
  });
  const expectFail = async fn => { allowHttp = true; try { await fn(); await page.waitForTimeout(150); } finally { allowHttp = false; } };
  const must = (ok, msg) => { if (!ok) throw new Error(msg); };
  const screen = async name => { await page.waitForSelector(`main[data-screen="${name}"]`, { timeout: 15000 }); await page.waitForTimeout(120); await check(name); };
  const rpc = (name, args) => page.evaluate(([n, a]) => window.rf.rpc(n, a), [name, args || {}]);
  const learn = v => { if (typeof v === 'string') { if (v.length > 1) known.add(v); } else if (v && typeof v === 'object') Object.values(v).forEach(learn); };
  let shot = 0;

  // Every screen: no sideways scroll, nothing sticking out, and no text in the other language.
  async function check(name) {
    const r = await page.evaluate(() => {
      const vw = window.innerWidth, out = [];
      for (const el of document.querySelectorAll('#app *, #layer *')) {
        if (el.closest('.chips.scroll')) continue;
        const b = el.getBoundingClientRect();
        if (b.width && b.height && (b.right > vw + 1 || b.left < -1)) out.push(el.tagName + '.' + el.className + ' ' + Math.round(b.left) + '..' + Math.round(b.right));
      }
      const small = [];
      for (const el of document.querySelectorAll('#app button, #app a, #layer button')) {
        const b = el.getBoundingClientRect(), hit = el.classList.contains('toggle') ? b.height + 12 : b.height;
        if (b.width && hit < 40 && !el.closest('.pwbox')) small.push(el.className + ' ' + Math.round(b.height));
      }
      const c = document.createElement('div');
      for (const id of ['app', 'layer']) c.appendChild(document.getElementById(id).cloneNode(true));
      c.querySelectorAll('input,textarea,code,.ltr,.plink,.pw,[lang],script').forEach(x => x.remove());
      return { over: document.documentElement.scrollWidth - vw, out: out.slice(0, 5), small: small.slice(0, 5), text: c.textContent, dir: document.documentElement.dir, lang: document.documentElement.lang };
    });
    must(r.lang === lang && r.dir === (lang === 'ar' ? 'rtl' : 'ltr'), `${name}: wrong lang/dir ${r.lang}/${r.dir}`);
    must(r.over <= 0, `${name}: horizontal overflow ${r.over}px`);
    must(!r.out.length, `${name}: elements outside the screen: ${r.out.join(' | ')}`);
    must(!r.small.length, `${name}: tap targets under 40px: ${r.small.join(' | ')}`);
    let text = r.text;
    for (const k of [...known].sort((a, b) => b.length - a.length)) text = text.split(k).join(' ');
    text = text.replace(/[\w.+-]+@[\w.-]+|Powered by Refka|Refka|PNG|JPG|QR/g, ' ');
    const leak = lang === 'ar' ? text.match(/[A-Za-z]{2,}[A-Za-z ]*/) : text.match(/[؀-ۿ]+[؀-ۿ ]*/);
    must(!leak, `${name}: other language leaking: "${leak && leak[0]}"`);
    must(!/[—–]/.test(text), `${name}: dash in copy`);
    must(!/\b[a-z]+_[a-z_0-9]+\b/.test(text), `${name}: raw key in copy: ${(text.match(/\b[a-z]+_[a-z_0-9]+\b/) || [])[0]}`);
    must(!problems.length, `${name}: ${problems.join(' ; ')}`);
    if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `${lang}-${String(++shot).padStart(2, '0')}-${name}.png`), fullPage: true });
  }
  const next = () => page.click('[data-act="next"]');
  const errShown = async sel => { await page.waitForFunction(s => [...document.querySelectorAll(s)].some(e => e.textContent.trim()), sel, { timeout: 8000 }); };
  const toast = async () => { await page.waitForSelector('#layer .toast', { timeout: 8000 }); };
  const tab = async name => { await page.click(`.tabs [data-tab="${name}"]`); await screen(name); };
  const signOut = async () => {
    await tab('settings'); await page.click('[data-act="signout"]'); await page.click('#layer .sheet .btn.danger'); await screen('signin');
  };

  // ---------- 1. sign up
  await page.goto(BASE + '/app/owner/');
  await screen('signup');                                   // the language comes from the browser language
  await page.click('[data-act="auth"]'); await errShown('.field .err'); await check('signup-errors');
  const email = `e2e-${lang}-${stamp}@owner.test`;
  await page.fill('input[name="name"]', L.owner); await page.fill('input[name="email"]', email); await page.fill('input[name="password"]', 'secret-pass-1');
  await page.click('[data-act="auth"]');
  log('signed up ' + email);

  // ---------- 2. wizard
  await screen('setup-1');
  const slug = `e2e-${lang}-${stamp}`; known.add(slug);
  await page.fill('main .input.ltr', L.gym); await page.fill('main input[lang="ar"]', L.gymAr);
  must((await page.inputValue('.slugbox input')).length >= 3, 'link name was not suggested from the gym name');
  await page.fill('.slugbox input', 'a'); await errShown('.slugbox ~ .err'); await check('setup-1-slug-bad');
  await page.fill('.slugbox input', 'atlas');                // a live gym: found as taken while typing
  await page.waitForSelector('.slugbox.bad', { timeout: 8000 }); await page.waitForSelector('.field .chips .chip'); await check('setup-1-slug-taken');
  await expectFail(async () => { await next(); await errShown('main > .list > .err'); });   // and refused by the server too
  await page.fill('.slugbox input', slug); await page.waitForSelector('.slugbox.good', { timeout: 8000 });
  await next();

  await screen('setup-2');
  await page.click('.swatches >> nth=0 >> .sw >> nth=2'); await page.click('.swatches >> nth=1 >> .sw >> nth=3');
  await page.setInputFiles('main input[type="file"]', { name: 'logo.png', mimeType: 'image/png', buffer: PNG });
  await page.waitForSelector('.lz img'); await check('setup-2-logo');
  await next();

  await screen('setup-3');
  must(await page.locator('.pkg').count() === 4, 'expected 4 suggested packages');
  await next(); await errShown('main > .list > .err'); await check('setup-3-empty');           // no price yet
  await page.fill('.pkg[data-months="1"] [data-k="price"]', '500');
  await page.fill('.pkg[data-months="3"] [data-k="price"]', '1300');
  await page.click('.pkg[data-months="3"] .row .btn.link >> nth=0');                            // add an offer
  await page.fill('.pkg[data-months="3"] [data-k="before"]', '1500');
  await next(); await errShown('.pkg[data-months="3"] .field .err'); await check('setup-3-offer-needs-date');
  await page.fill('.pkg[data-months="3"] [data-k="until"]', iso(20));
  await page.click('.pkg[data-months="12"] .iconbtn');                                         // remove a suggestion
  await page.click('main .list > .btn.ghost.full');                                            // add a package
  await page.fill('.pkg >> nth=3 >> [data-k="months"]', '2'); await page.fill('.pkg >> nth=3 >> [data-k="price"]', '950');
  await next();

  await screen('setup-4');
  await next(); await errShown('main > .list > .err'); await check('setup-4-empty');           // need_pay, said in plain words
  await page.fill('main .field >> nth=0 >> input', 'e2e@instapay'); await page.fill('main .field >> nth=1 >> input', '010 1234 5678');
  await page.click('main .toggle');
  await next();

  await screen('setup-5');
  const ph = n => '0100' + String(Date.now() % 1e6).padStart(6, '0').slice(0, 5) + (lang === 'ar' ? 5 : 1) + n;
  const pk3 = lang === 'ar' ? '3 شهور' : '3 months';
  await page.fill('main textarea', [`${L.m1}\t${ph(1)}\t${pk3}\t31/12/2027`, `${L.m2}\t${ph(2).slice(1)}\t${lang === 'ar' ? 'ست' : 'f'}`, `${L.m3}\t12345`].join('\n'));
  await page.click('[data-act="imp-read"]');
  await page.waitForSelector('.irow.bad'); must(await page.locator('.irow').count() === 3, 'expected 3 rows in the preview');
  must(await page.locator('.irow.bad').count() === 1, 'expected exactly one row with an error'); await check('setup-5-preview');
  await page.click('.irow.bad .btn'); await page.waitForSelector('#layer .sheet'); await check('setup-5-fix-sheet');
  await page.fill('#layer .sheet input.ltr', ph(3)); await page.click('[data-act="row-ok"]');
  await page.click('[data-act="imp-hand"]'); await page.fill('#layer .sheet input >> nth=0', L.m4); await page.fill('#layer .sheet input.ltr', ph(4)); await page.click('[data-act="row-ok"]');
  must(await page.locator('.irow.bad').count() === 0, 'rows should be clean after the fix');
  await page.click('[data-act="imp-send"]'); await page.waitForSelector('#imp-result:not([hidden])');
  must(await page.locator('.irow').count() === 0, 'imported rows should leave the preview'); await check('setup-5-done');
  await next();

  await screen('setup-6');
  must(await page.locator('.navrow .pill.bad').count() === 0, 'review shows a missing required step');
  await page.click('[data-act="golive"]');

  // ---------- 3. live: link + QR + poster
  await screen('live');
  const link = await page.textContent('#member-link');
  must(link === `${new URL(BASE).origin}/app/?g=${slug}`, 'wrong member link: ' + link);
  must(await page.locator('#qr svg path').count() === 1, 'QR code missing');
  await page.click('[data-act="copy"]'); await toast();
  must(await page.evaluate(() => navigator.clipboard.readText()) === link, 'copy did not put the link on the clipboard');
  const pub = await rpc('gym_public', { p_slug: slug }); must(pub && pub.status === 'live', 'gym_public does not show the gym as live');
  await page.click('[data-act="poster"]'); await screen('poster');
  must(await page.locator('main .poster .qr svg').count() === 1, 'poster has no QR');
  await page.goBack(); await screen('live');
  await page.click('[data-act="to-home"]');
  log('wizard done, live at ' + link);

  // ---------- new gym: home, members, scan, settings
  await screen('home'); await page.waitForSelector('#needs-empty');
  must((await page.textContent('[data-stat="st_members"] b')).trim() === '4', 'home should count 4 members'); await check('home-empty');
  await page.reload(); await screen('home');                 // the session survives a reload
  await tab('members'); await page.waitForSelector('[data-member]');
  must(await page.locator('[data-member]').count() === 4, 'expected 4 imported members'); await check('members-new');
  await tab('scan');
  await expectFail(async () => { await page.fill('main input', 'not-a-code'); await page.click('[data-act="scan-send"]'); await page.waitForSelector('[data-result="bad"]'); });
  await check('scan-bad');
  await tab('settings');
  await page.click('[data-posts="approve"]'); await errShown('main .okmsg');
  await page.click('[data-act="cross"]'); await page.waitForTimeout(400);
  const st = (await rpc('owner_get_gym')).gym.settings; must(st.posts === 'approve' && st.cross === false, 'settings were not saved: ' + JSON.stringify(st));
  await page.click('[data-go="settings/packages"]'); await screen('settings-packages');
  must(await page.locator('.pkg').count() === 3, 'expected 3 saved packages');
  await page.fill('.pkg >> nth=0 >> [data-k="price"]', '550'); await page.click('[data-act="save"]'); await toast();
  must((await rpc('owner_get_gym')).packages.some(p => p.price === 550), 'package edit was not saved');
  await page.click('.bar .back'); await screen('settings');
  for (const s of ['gym', 'brand', 'pay']) { await page.click(`[data-go="settings/${s}"]`); await screen('settings-' + s); await page.click('[data-act="save"]'); await toast(); await page.click('.bar .back'); await screen('settings'); }
  await page.click('[data-go="link"]'); await screen('live'); await page.click('.bar .back'); await screen('settings');
  // language toggle is remembered
  const other = lang === 'ar' ? 'en' : 'ar';
  await page.click(`[data-lang="${other}"]`); await page.waitForFunction(o => document.documentElement.lang === o, other);
  await page.reload(); await page.waitForSelector('main[data-screen="settings"]');
  must(await page.evaluate(() => document.documentElement.lang) === other, 'language choice was not remembered');
  await page.click(`[data-lang="${lang}"]`); await screen('settings');
  await signOut();

  // ---------- 4. the seeded Atlas owner
  await expectFail(async () => { await page.fill('input[name="email"]', ATLAS.email); await page.fill('input[name="password"]', 'wrong-password'); await page.click('[data-act="auth"]'); await errShown('form > .err'); });
  await check('signin-wrong');
  await page.fill('input[name="password"]', ATLAS.password); await page.click('[data-act="auth"]');
  await page.waitForSelector('main[data-screen="home"]'); await page.waitForSelector('#needs .card, #needs-empty');
  learn(await rpc('owner_get_gym')); learn(await rpc('owner_home')); learn(await rpc('owner_members', { p_q: '' }));
  await check('home');
  const needs = async k => (await rpc('owner_home')).needs.filter(n => n.k === k);
  const before = { pay: await needs('pay'), guest: await needs('guest'), post: await needs('post') };
  for (const k of ['pay', 'guest', 'post']) must(before[k].length > 0, `Atlas has no "${k}" item waiting; the test needs one`);

  // approve a payment
  const pay = before.pay[0];
  await page.click(`.card[data-need="pay"][data-id="${pay.id}"] [data-act="approve"]`); await toast();
  await page.waitForSelector(`.card[data-id="${pay.id}"]`, { state: 'detached' });
  must(!(await needs('pay')).some(n => n.id === pay.id), 'payment is still waiting after approve');
  // approve a guest with a package and an end date
  const guest = before.guest[0];
  await page.click(`.card[data-need="guest"][data-id="${guest.id}"] [data-act="approve"]`);
  await page.waitForSelector('#layer .sheet select'); await check('guest-sheet');
  await page.selectOption('#layer .sheet select', { index: 0 }); await page.fill('#layer .sheet input[type="date"]', iso(45));
  await page.click('[data-act="guest-confirm"]'); await page.waitForSelector(`.card[data-id="${guest.id}"]`, { state: 'detached' });
  const gm = (await rpc('owner_members', { p_q: '' })).find(m => m.id === guest.id);
  must(gm && gm.status === 'active' && gm.ends === iso(45) && gm.package, 'guest was not accepted with package and end date: ' + JSON.stringify(gm));
  // hide a waiting post
  const post = before.post[0];
  await page.click(`.card[data-need="post"][data-id="${post.id}"] [data-act="hide"]`); await toast();
  await page.waitForSelector(`.card[data-id="${post.id}"]`, { state: 'detached' });
  must(!(await needs('post')).some(n => n.id === post.id), 'post is still waiting after hide');
  // a report, when there is one: mark done
  const rep = (await needs('report'))[0];
  if (rep) { await page.click(`.card[data-need="report"][data-id="${rep.id}"] [data-act="done"]`); await page.waitForSelector(`.card[data-id="${rep.id}"]`, { state: 'detached' }); must(!(await needs('report')).some(n => n.id === rep.id), 'report still open'); }
  await page.waitForTimeout(300); await check('home-after');
  log(`approved payment, accepted guest, hid post${rep ? ', closed report' : ''}`);

  // members: search + manual check-in
  await tab('members'); await page.waitForSelector('[data-member]');
  const all = await rpc('owner_members', { p_q: '' });
  const total = await page.locator('[data-member]').count(); must(total === Math.min(all.length, 300), 'member list does not match the server');
  const pick = all.find(m => m.id === guest.id);
  await page.fill('main input[type="search"]', pick.name);
  await page.waitForFunction(n => { const c = document.querySelectorAll('[data-member]'); return c.length >= 1 && c.length < n; }, total);
  must(await page.locator(`[data-member="${pick.id}"]`).count() === 1, 'search did not find the member'); await check('members-search');
  await page.fill('main input[type="search"]', 'zzzz-nobody'); await page.waitForSelector('main .empty'); await check('members-none');
  await page.fill('main input[type="search"]', pick.phone.replace(/^\+20/, '0'));
  await page.waitForSelector(`[data-member="${pick.id}"]`);
  const inToday = (await rpc('owner_home')).stats.checkins_today;
  await page.click(`[data-member="${pick.id}"] [data-act="checkin"]`); await errShown(`[data-member="${pick.id}"] .okmsg`);
  must((await rpc('owner_home')).stats.checkins_today === inToday + 1, 'manual check-in was not counted'); await check('members-checkin');
  await page.fill('main input[type="search"]', ''); await page.click('[data-f="soon"]'); await page.waitForTimeout(150); await check('members-chip');
  await page.click('[data-act="add-members"]'); await screen('members-add'); await page.click('.bar .back'); await screen('members');
  await tab('scan'); await tab('home');
  await signOut();
  must(!problems.length, problems.join(' ; '));
  await ctx.close();
  log('PASS');
}

(async () => {
  const browser = await chromium.launch();
  let failed = false;
  for (const lang of ['en', 'ar']) {
    try { await runLang(browser, lang); } catch (e) { failed = true; console.error(`[${lang}] FAIL: ${e.message.split('\n')[0]}`); if (process.env.RF_DEBUG) console.error(e.stack); }
  }
  await browser.close();
  console.log(failed ? 'E2E FAILED' : `E2E PASSED (en + ar, 390x844, ${MOCK ? 'in-page mock' : BASE})`);
  process.exit(failed ? 1 : 0);
})();
