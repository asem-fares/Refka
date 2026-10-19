/* Refka website: page behaviour: menu, background, pricing engine, language, phone demos, owner app, modals, WhatsApp. Classic scripts, loaded with defer in this order:
   boot.js (in <head>) -> i18n/en.js -> app.js -> form.js. No build step. */
// ─── NON-LANG JS (mobile menu, canvas, scroll, fade) ─────────
// MOBILE MENU
var burger = document.getElementById('burger');
var mobMenu = document.getElementById('mobMenu');
// Keyboard and screen readers: aria-expanded on the button, focus moves into the menu, Tab stays
// between the button and the menu links, Escape closes and returns focus to the button.
function openMob() {
  mobMenu.classList.add('open'); burger.setAttribute('aria-expanded', 'true'); document.body.style.overflow = 'hidden';
  var first = mobMenu.querySelector('a'); if (first) setTimeout(function() { first.focus(); }, 30);
}
function closeMob(returnFocus) {
  if (!mobMenu.classList.contains('open')) return;
  mobMenu.classList.remove('open'); burger.setAttribute('aria-expanded', 'false'); document.body.style.overflow = '';
  if (returnFocus === true) burger.focus();
}
burger.addEventListener('click', function() { mobMenu.classList.contains('open') ? closeMob(true) : openMob(); });
document.addEventListener('keydown', function(e) {
  if (!mobMenu.classList.contains('open')) return;
  if (e.key === 'Escape') { closeMob(true); return; }
  if (e.key !== 'Tab') return;
  var f = [burger].concat([].slice.call(mobMenu.querySelectorAll('a')));
  var i = f.indexOf(document.activeElement);
  if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); }
  else if (!e.shiftKey && (i === f.length - 1 || i === -1)) { e.preventDefault(); f[0].focus(); }
});

// CANVAS ANIMATION
var canvas = document.getElementById('canvas');
var ctx = canvas.getContext('2d');
var nodes = [];
var W, H, rafId = 0;

function resize() {
  W = canvas.width = canvas.offsetWidth;
  H = canvas.height = canvas.offsetHeight;
}

function initNodes() {
  nodes = [];
  var n = Math.min(Math.floor(W * H / 15000), 55);
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) n = 0;
  for (var i = 0; i < n; i++) {
    nodes.push({
      x: Math.random() * W,
      y: Math.random() * H,
      vx: (Math.random() - .5) * .28,
      vy: (Math.random() - .5) * .28,
      r: Math.random() * 2 + 1.5
    });
  }
}

function draw() {
  rafId = 0;
  if (!shouldRun()) return;
  ctx.clearRect(0, 0, W, H);
  for (var i = 0; i < nodes.length; i++) {
    for (var j = i + 1; j < nodes.length; j++) {
      var dx = nodes[i].x - nodes[j].x;
      var dy = nodes[i].y - nodes[j].y;
      var d = Math.sqrt(dx * dx + dy * dy);
      if (d < 120) {
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(13,107,110,' + ((1 - d / 120) * .14) + ')';
        ctx.lineWidth = 1;
        ctx.moveTo(nodes[i].x, nodes[i].y);
        ctx.lineTo(nodes[j].x, nodes[j].y);
        ctx.stroke();
      }
    }
  }
  for (var k = 0; k < nodes.length; k++) {
    var n2 = nodes[k];
    ctx.beginPath();
    ctx.arc(n2.x, n2.y, n2.r, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(13,107,110,.22)';
    ctx.fill();
    n2.x += n2.vx;
    n2.y += n2.vy;
    if (n2.x < 0 || n2.x > W) n2.vx *= -1;
    if (n2.y < 0 || n2.y > H) n2.vy *= -1;
  }
  rafId = requestAnimationFrame(draw);
}

// The dots only move while the hero is on screen and the tab is visible: no work, no battery, once
// the visitor has scrolled on. A phone's address bar showing or hiding changes only the height,
// so the dots are rebuilt only when the width changes.
var heroVisible = true, lastW = 0;
function shouldRun() { return heroVisible && !document.hidden && nodes.length > 0; }
function start() { if (!rafId && shouldRun()) rafId = requestAnimationFrame(draw); }
function stop() { if (rafId) { cancelAnimationFrame(rafId); rafId = 0; } }
resize(); lastW = W;
initNodes();
start();
window.addEventListener('resize', function() {
  resize();
  if (W !== lastW) { lastW = W; initNodes(); }
  start();
});
document.addEventListener('visibilitychange', function() { document.hidden ? stop() : start(); });
if ('IntersectionObserver' in window) {
  new IntersectionObserver(function(es) { heroVisible = es[0].isIntersecting; heroVisible ? start() : stop(); }).observe(canvas);
}

// SCROLL REVEAL: starts once the page text is in the visitor's language (see the init below),
// so nobody sees English for a moment before their own language.
function startReveal() {
  if (!('IntersectionObserver' in window)) { document.querySelectorAll('.fade').forEach(function(el) { el.classList.add('in'); }); return; }
  var observer = new IntersectionObserver(function(entries) {
    entries.forEach(function(e) {
      if (e.isIntersecting) { e.target.classList.add('in'); observer.unobserve(e.target); }
    });
  }, { threshold: .1, rootMargin: '0px 0px -40px 0px' });
  document.querySelectorAll('.fade').forEach(function(el) { observer.observe(el); });
}

// ─── LANGUAGE SYSTEM ─────────────────────────────────────────
// Fonts: self-hosted in /assets/css/fonts.css; CJK, Thai and Hindi use system fonts.
function loadFont() {}

function g(id) { return document.getElementById(id); }
var _lang = 'en';

// ═══════════════════════════════════════════════════════════════
// PRICING ENGINE  (source of truth: Refka Pricing Reference v3.0)
// USD base prices per zone. Zone = gym country (IMF Advanced list
// + GCC per v3.0). Display currency = visitor's country.
// ═══════════════════════════════════════════════════════════════
var PRICING = {
  A: { starter:{m:49,  a:39,  y:468,  ai:150},  growth:{m:99, a:79, y:948, ai:500}, pro:{m:249, a:199, y:2388, ai:1500} },
  B: { starter:{m:25,  a:20,  y:240,  ai:150},  growth:{m:55, a:44, y:528, ai:300}, pro:{m:119, a:95,  y:1140, ai:800}  }
};
var ZONE_A = ('US CA GB DE FR AE SA QA KW BH OM JP KR SG AU NZ HK IL CH NL BE AT DK SE NO FI IE ES IT PT PL CZ ' +
              'SI EE SK HU LV LT HR MT CY IS LU GR TW MO SM AD PR').split(' ');
var EURO = 'DE FR NL BE AT FI IE ES IT PT SI EE SK LV LT HR MT CY LU GR BG SM AD MC ME XK'.split(' ');   // Bulgaria: euro since 1 Jan 2026
var CUR = {
  EG:'EGP', SA:'SAR', AE:'AED', QA:'QAR', KW:'KWD', BH:'BHD', OM:'OMR', JO:'JOD', MA:'MAD', TN:'TND', DZ:'DZD',
  IQ:'IQD', LY:'LYD', AL:'ALL', TR:'TRY', GB:'GBP', CH:'CHF', LI:'CHF', SE:'SEK', NO:'NOK', DK:'DKK', PL:'PLN',
  CZ:'CZK', HU:'HUF', RO:'RON', IS:'ISK', RS:'RSD', MK:'MKD', BA:'BAM', UA:'UAH', RU:'RUB', GE:'GEL',
  KZ:'KZT', US:'USD', PR:'USD', CA:'CAD', MX:'MXN', BR:'BRL', AR:'ARS', CO:'COP', CL:'CLP', PE:'PEN',
  AU:'AUD', NZ:'NZD', JP:'JPY', KR:'KRW', CN:'CNY', HK:'HKD', MO:'MOP', TW:'TWD', SG:'SGD', MY:'MYR',
  ID:'IDR', TH:'THB', PH:'PHP', VN:'VND', IN:'INR', PK:'PKR', BD:'BDT', LK:'LKR', NP:'NPR', IL:'ILS',
  ZA:'ZAR', NG:'NGN', KE:'KES', GH:'GHS', TZ:'TZS', UG:'UGX', ET:'ETB', RW:'RWF'
};
EURO.forEach(function(c){ CUR[c] = 'EUR'; });

// FX snapshot: USD -> currency. ECB reference rates 16 Oct 2026 (via EUR/USD 1.1253),
// GCC/JOD official pegs, EGP market rate 14 Oct 2026, ALL Bank of Albania official 16 Oct 2026. A server can
// replace it by defining window.REFKA_FX before this script; the browser never calls an FX provider.
var FX = { USD:1, EUR:0.8887, JPY:158.02, CZK:21.615, DKK:6.6425, GBP:0.74989, HUF:322.65, PLN:3.8834,
  RON:4.7374, SEK:9.904, CHF:0.82396, ISK:121.03, NOK:9.441, TRY:49.527, AUD:1.437, BRL:5.0828,
  CAD:1.4161, CNY:6.6862, HKD:7.8482, IDR:18031, ILS:3.0945, INR:94.965, KRW:1332.1, MXN:18.384,
  MYR:4.0815, NZD:1.7656, PHP:62.968, SGD:1.2792, THB:33.415, ZAR:16.434,
  SAR:3.75, AED:3.6725, QAR:3.64, KWD:0.307, BHD:0.376, OMR:0.3845, JOD:0.709, EGP:52.98, ALL:81.20 };
if (window.REFKA_FX) { for (var k in window.REFKA_FX) FX[k] = window.REFKA_FX[k]; }

// FIXED LOCAL PRICES (zone:currency). A gym billed in one of these currencies always sees and
// pays these exact amounts: they never move with the exchange rate. Review them every quarter.
// m = monthly price, a = per month on yearly billing, y = the yearly charge (a x 12).
// Every other country is billed in US dollars; its local amount is shown as an estimate.
var FIXED = {
  'B:EGP': { starter:{m:799, a:649, y:7788},  growth:{m:1499, a:1249, y:14988}, pro:{m:3299, a:2749, y:32988} },
  'A:SAR': { starter:{m:179, a:145, y:1740},  growth:{m:369,  a:295,  y:3540},  pro:{m:929,  a:745,  y:8940} },
  'A:AED': { starter:{m:179, a:145, y:1740},  growth:{m:359,  a:289,  y:3468},  pro:{m:899,  a:729,  y:8748} },
  'A:EUR': { starter:{m:45,  a:36,  y:432},   growth:{m:89,   a:71,   y:852},   pro:{m:219,  a:175,  y:2100} }
};
function fixedList() { return FIXED[_zone + ':' + _cur] || null; }

// Country detection and the time-zone table live in boot.js (they run before the page is drawn).
var TZ = RFK.TZ;

var _billing = 'm', _country = 'US', _zone = 'A', _cur = 'USD';

function zoneOf(cc) { return ZONE_A.indexOf(cc) > -1 ? 'A' : 'B'; }
function curOf(cc) { var c = CUR[cc] || 'USD'; return FX[c] ? c : 'USD'; }

function detectCountry() { return RFK.country; }

// ═══════════════════════════════════════════════════════════════
// ARABIC PERSONAS: the names in the demos match the visitor's country,
// so a gym owner in Riyadh sees Saudi names and one in Cairo sees Egyptian ones.
// m: two men, w: two women, s: the front-desk staff member.
// In the Gulf and Yemen, women are shown with their initial instead of a photo.
// ═══════════════════════════════════════════════════════════════
var PERSONA = {
  EG: { m: ['أحمد محمود', 'محمد عادل'], w: ['مريم أحمد', 'نورهان سامي'], s: 'مصطفى' },
  SA: { m: ['عبدالعزيز القحطاني', 'محمد الغامدي'], w: ['نورة العتيبي', 'سارة الدوسري'], s: 'فهد' },
  AE: { m: ['سعيد المزروعي', 'خالد الكعبي'], w: ['مريم الشامسي', 'فاطمة النعيمي'], s: 'راشد' },
  KW: { m: ['عبدالله العنزي', 'فهد المطيري'], w: ['دانة العجمي', 'شيخة الرشيدي'], s: 'بدر' },
  QA: { m: ['حمد المري', 'علي الكواري'], w: ['العنود الهاجري', 'مها السليطي'], s: 'جاسم' },
  BH: { m: ['يوسف الذوادي', 'أحمد الدوسري'], w: ['زينب الجودر', 'فاطمة المناعي'], s: 'عيسى' },
  OM: { m: ['سالم البلوشي', 'خالد الحارثي'], w: ['أمل الرواحي', 'شيماء البوسعيدي'], s: 'ناصر' },
  YE: { m: ['عبدالله العولقي', 'محمد الحضرمي'], w: ['أروى العبسي', 'سمر الشرعبي'], s: 'صالح' },
  JO: { m: ['محمد العبادي', 'يزن الخطيب'], w: ['رزان الزعبي', 'لينا الحياري'], s: 'عمر' },
  LB: { m: ['كريم حداد', 'رامي خوري'], w: ['ريم حمدان', 'نادين سلامة'], s: 'جاد' },
  SY: { m: ['محمد الأحمد', 'باسل العلي'], w: ['ريم الحسن', 'لمى الخطيب'], s: 'حسام' },
  PS: { m: ['محمد أبو علي', 'يوسف الشوا'], w: ['ديما عودة', 'ريم ناصر'], s: 'أحمد' },
  IQ: { m: ['علي الجبوري', 'حيدر الربيعي'], w: ['زينب العبيدي', 'نور الدليمي'], s: 'مصطفى' },
  MA: { m: ['يوسف العلوي', 'مهدي بناني'], w: ['سلمى الإدريسي', 'هند التازي'], s: 'حمزة' },
  DZ: { m: ['أمين بن علي', 'رياض بوزيد'], w: ['أمينة بلقاسم', 'ياسمين حداد'], s: 'كريم' },
  TN: { m: ['أيمن الطرابلسي', 'وسيم بن سالم'], w: ['إيناس الهمامي', 'مريم الجبالي'], s: 'سامي' },
  LY: { m: ['محمد الورفلي', 'أحمد المصراتي'], w: ['سارة الترهوني', 'هبة الزوي'], s: 'علي' },
  SD: { m: ['محمد عثمان', 'أحمد الطيب'], w: ['سارة عبدالله', 'آمنة الأمين'], s: 'معتز' },
  _:  { m: ['عمر حسن', 'خالد منصور'], w: ['سارة عادل', 'ليلى سمير'], s: 'يوسف' }
};
var VEIL = ['SA', 'AE', 'KW', 'QA', 'BH', 'OM', 'YE'];
function isVeiled() { return _lang === 'ar' && VEIL.indexOf(_country) > -1; }
function firstName(n) { return String(n).split(' ')[0]; }
function applyPersona(t) {
  var P = PERSONA[_country] || PERSONA._;
  t.ph_n1 = P.m[0]; t.ph_n2 = P.m[1]; t.ph_w1 = P.w[0]; t.ph_w2 = P.w[1]; t.oa_staff = P.s;
  t.ph_post = 'رقم شخصي جديد في الديدلفت اليوم. شكراً على المساعدة يا ' + firstName(P.m[0]) + ' 💪';
  t.ph_post_w = 'رقم شخصي جديد في الديدلفت اليوم. شكراً على المساعدة يا ' + firstName(P.w[0]) + ' 💪';
  t.ph_m_toast = firstName(P.m[1]) + ' قَبِل طلبك. محادثتكما مفتوحة الآن.';
  t.ph_m_toast_w = firstName(P.w[1]) + ' قَبِلت طلبك. محادثتكما مفتوحة الآن.';
}
// Owner app: a woman's photo becomes her initial where the visitor's country expects it.
function veilOwnerApp(root) {
  root.querySelectorAll('img.oa-av').forEach(function (img) {
    if (!/members\/w/.test(img.getAttribute('src') || '')) return;
    var ini = img.nextElementSibling && img.nextElementSibling.classList.contains('oa-veil') ? img.nextElementSibling : null;
    if (isVeiled()) {
      var nm = img.parentNode.querySelector('.oa-nm');
      if (!ini) { ini = document.createElement('span'); ini.className = 'oa-av oa-ini oa-veil'; ini.setAttribute('aria-hidden', 'true'); img.after(ini); }
      ini.textContent = Array.from(nm ? nm.textContent.trim() : '')[0] || '';
      img.style.display = 'none'; ini.style.display = '';
    } else { img.style.display = ''; if (ini) ini.style.display = 'none'; }
  });
}


function numLocale() {
  var map = { 'ar':'ar-EG-u-nu-latn', 'tl':'fil', 'zh-Hans':'zh-CN', 'zh-Hant':'zh-TW' };
  return map[_lang] || _lang;
}

// Clean local prices: about 2 significant steps, never noisy decimals.
function nice(x) {
  if (x < 100) return Math.round(x);
  var step = Math.pow(10, Math.floor(Math.log10(x)) - 1) / 2;
  return Math.round(x / step) * step;
}
function local(usd, exact) {
  if (_cur === 'USD') return usd;
  var v = usd * FX[_cur];
  return exact ? v : nice(v);
}
function fmt(v) {
  try {
    return new Intl.NumberFormat(numLocale(), { style:'currency', currency:_cur, maximumFractionDigits:0, minimumFractionDigits:0 }).format(v);
  } catch(e) { return _cur + ' ' + Math.round(v); }
}
function fmtNum(v) {
  try { return new Intl.NumberFormat(numLocale()).format(v); } catch(e) { return String(v); }
}

function renderPrices() {
  var P = PRICING[_zone];
  var F = fixedList();
  document.querySelectorAll('.pv').forEach(function(el) {
    var p = P[el.dataset.plan], f = F && F[el.dataset.plan];
    el.textContent = fmt(f ? (_billing === 'm' ? f.m : f.a) : local(_billing === 'm' ? p.m : p.a));
  });
  document.querySelectorAll('.yr').forEach(function(el) {
    var p = P[el.dataset.plan], f = F && F[el.dataset.plan];
    el.textContent = fmt(f ? f.y : (_cur === 'USD' ? p.y : local(p.a) * 12));
  });
  document.querySelectorAll('s.was').forEach(function(el) {
    var p = P[el.dataset.plan], f = F && F[el.dataset.plan];
    el.textContent = fmt(f ? f.m : local(p.m));
  });
  document.querySelectorAll('.ai-q').forEach(function(el) { el.textContent = fmtNum(P[el.dataset.plan].ai); });
  document.querySelectorAll('[data-usd]').forEach(function(el) { el.textContent = fmt(local(+el.dataset.usd)); });
  var t = T[_lang] || T.en, n = g('locNote');
  // Payment methods follow the visitor's country: Egypt shows InstaPay and Vodafone Cash.
  var eg = _country === 'EG';
  document.documentElement.classList.toggle('cc-eg', eg);
  var PM = eg ? { '1': 'pay_insta', '2': 'pay_voda' } : { '1': 'ow_card', '2': 'ow_bank' };
  document.querySelectorAll('[data-pm]').forEach(function(el) { var k = PM[el.getAttribute('data-pm')]; el.textContent = t[k] || T.en[k]; });
  if (typeof setWhatsApp === 'function') setWhatsApp();
  if (typeof renderOwnerApp === 'function') renderOwnerApp();
  fitText();
  if (n) n.textContent = (F ? (t.loc_fixed || T.en.loc_fixed) : (_cur === 'USD' ? t.loc_usd : t.loc_conv)) + ' ' + t.loc_final;
}

function buildCountrySelect() {
  var sel = g('countrySel'); if (!sel) return;
  var seen = {}, list = [];
  Object.keys(CUR).concat(ZONE_A, Object.keys(TZ).map(function(k){ return TZ[k]; })).forEach(function(c) {
    if (!seen[c]) { seen[c] = 1; list.push(c); }
  });
  if (!seen[_country]) list.push(_country);
  var dn = null;
  try { dn = new Intl.DisplayNames([numLocale(), 'en'], { type:'region' }); } catch(e) {}
  var rows = list.map(function(c) {
    var name = c; try { name = dn ? dn.of(c) : c; } catch(e) {}
    return { c:c, name:name };
  });
  try {
    var coll = new Intl.Collator(numLocale());
    rows.sort(function(a,b){ return coll.compare(a.name, b.name); });
  } catch(e) { rows.sort(function(a,b){ return a.name < b.name ? -1 : 1; }); }
  sel.innerHTML = '';
  rows.forEach(function(r) {
    var o = document.createElement('option');
    o.value = r.c; o.textContent = r.name + ' (' + curOf(r.c) + ')';
    if (r.c === _country) o.selected = true;
    sel.appendChild(o);
  });
}

function setCountry(cc, remember) {
  _country = cc; _zone = zoneOf(cc); _cur = curOf(cc);
  if (remember) { try { localStorage.setItem('rfk_cc', cc); } catch(e) {} }
  var sel = g('countrySel'); if (sel && sel.value !== cc) sel.value = cc;
  if (_lang === 'ar') { applyLang('ar'); if (window.rfkSetPair) window.rfkSetPair(); return; }
  renderPrices();
}

function setBilling(b) {
  _billing = b;
  var bM = g('biMonthly'), bA = g('biAnnual');
  if (bM) { bM.classList.toggle('active', b === 'm'); bM.setAttribute('aria-pressed', b === 'm' ? 'true' : 'false'); }
  if (bA) { bA.classList.toggle('active', b === 'a'); bA.setAttribute('aria-pressed', b === 'a' ? 'true' : 'false'); }
  document.querySelectorAll('.billing-mo').forEach(function(el){ el.style.display = b === 'm' ? '' : 'none'; });
  document.querySelectorAll('.billing-an').forEach(function(el){ el.style.display = b === 'a' ? '' : 'none'; });
  renderPrices();
}

// Live FX: the production server injects window.REFKA_FX (daily rates, USD base) before this script.
// No third-party call from the browser (GDPR: no visitor IP sent to an FX provider without consent).

// goRegister, goContact and openOut are defined in form.js (loaded after this file):
// until the app exists they open the sign-up form; APP_URL there switches them to the app.
function goRegister(plan) {}
function goContact() {}
function openOut(u) {}

// ═══════════════════════════════════════════════════════════════
// LANGUAGE
// ═══════════════════════════════════════════════════════════════
function applyLang(code) {
  var t = T[code];
  if (!t) return;
  _lang = code;
  if (code === 'ar') applyPersona(t);
  try { localStorage.setItem('rfk_l', code); } catch(e) {}
  loadFont(code);

  document.documentElement.dir  = t.dir;
  document.documentElement.lang = code;

  var lcEl = g('lc'); if (lcEl) lcEl.textContent = t.label;
  document.querySelectorAll('.lang-opt').forEach(function(o) { o.classList.toggle('on', o.dataset.l === code); });

  document.querySelectorAll('[data-i18n]').forEach(function(el) {
    var v = t[el.dataset.i18n];
    if (v === undefined) v = T.en[el.dataset.i18n];
    if (v !== undefined) el.textContent = v;
  });
  document.querySelectorAll('[data-i18n-html]').forEach(function(el) {
    var v = t[el.dataset.i18nHtml];
    if (v === undefined) v = T.en[el.dataset.i18nHtml];
    if (v !== undefined) el.innerHTML = v;
  });

  // Avatar initials follow the localized names
  document.querySelectorAll('[data-av]').forEach(function(el) {
    var n = t[el.dataset.av] || ''; el.textContent = Array.from(n)[0] || '';
  });

  // Next Saturday for the community event, in the visitor's language
  try {
    var d = new Date(); d.setDate(d.getDate() + ((6 - d.getDay() + 7) % 7));
    g('evDay').textContent = new Intl.NumberFormat(numLocale()).format(d.getDate());
    g('evMon').textContent = new Intl.DateTimeFormat(numLocale(), { month:'short' }).format(d).replace('.', '').toUpperCase();
  } catch(e) {}


  // Legal documents are English-only: say so in the visitor's language
  document.querySelectorAll('.modal-legal-note').forEach(function(el) {
    el.textContent = code === 'en' ? '' : t.legal_en;
    el.style.display = code === 'en' ? 'none' : '';
  });

  if (t.pageTitle) document.title = t.pageTitle;
  try {
    var u = new URL(window.location);
    if (code === 'en') u.searchParams.delete('lang'); else u.searchParams.set('lang', code);
    window.history.replaceState({}, '', u);
  } catch(e) {}
  var can = document.querySelector('link[rel=canonical]');
  if (can) can.href = 'https://refka.tech/' + (code === 'en' ? '' : '?lang=' + code);
  var ogt = document.querySelector('meta[property="og:title"]'); if (ogt && t.pageTitle) ogt.content = t.pageTitle;
  var md = document.querySelector('meta[name=description]'); if (md && t.metaDesc) md.content = t.metaDesc;

  buildCountrySelect();
  renderPrices();
  if (window.gtag) gtag('event', 'language_change', { language: code });
}

(function() {
  var overlay = g('langOverlay'), panel = g('langPanel'), trigBtn = g('langBtn'), closeBtn = g('langClose');
  if (!overlay || !trigBtn) return;
  // Same keyboard behaviour as the modals: focus moves to the current language, Tab stays inside,
  // Escape or a choice closes the picker and returns focus to the button.
  function isOpen() { return overlay.classList.contains('open'); }
  function openLang() {
    overlay.classList.add('open'); trigBtn.setAttribute('aria-expanded', 'true');
    var cur = overlay.querySelector('.lang-opt.on') || overlay.querySelector('.lang-opt');
    if (cur) setTimeout(function() { cur.focus(); }, 30);
  }
  function closeLang() {
    if (!isOpen()) return;
    overlay.classList.remove('open'); trigBtn.setAttribute('aria-expanded', 'false'); trigBtn.focus();
  }
  trigBtn.addEventListener('click', function(e) { e.stopPropagation(); isOpen() ? closeLang() : openLang(); });
  if (closeBtn) closeBtn.addEventListener('click', closeLang);
  overlay.addEventListener('click', function(e) { if (e.target === overlay) closeLang(); });
  if (panel) panel.addEventListener('click', function(e) { e.stopPropagation(); });
  document.addEventListener('keydown', function(e) {
    if (!isOpen()) return;
    if (e.key === 'Escape') { closeLang(); return; }
    if (e.key !== 'Tab') return;
    var f = [].slice.call(overlay.querySelectorAll('button')).filter(function(x) { return x.offsetParent !== null; });
    var i = f.indexOf(document.activeElement);
    if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); }
    else if (!e.shiftKey && (i === f.length - 1 || i === -1)) { e.preventDefault(); f[0].focus(); }
  });
  document.querySelectorAll('.lang-opt').forEach(function(btn) {
    btn.addEventListener('click', function() { setLang(btn.dataset.l); closeLang(); });
  });
})();

// Init: country first (prices), then language (renders everything)
(function() {
  var cc = detectCountry();
  _country = cc; _zone = zoneOf(cc); _cur = curOf(cc);
  var sel = g('countrySel');
  if (sel) sel.addEventListener('change', function() {
    setCountry(sel.value, true);
    if (window.gtag) gtag('event', 'country_change', { country: sel.value });
  });

  // boot.js already chose the language and started loading its file; apply it as soon as it is here.
  RFK.whenLang(RFK.lang, function(code) {
    applyLang(code);
    document.documentElement.classList.add('ready');
    startReveal();
  });
})();

// Switching language later: load that language's file first (once), then apply it.
function setLang(code) { RFK.whenLang(code, function(c) { applyLang(c); }); }

// ═══════════════════════════════════════════════════════════════
// PHONE DEMOS: the owner phone and the member phone, 4 scenes each,
// 8s per scene. One shared clock keeps both phones in step.
// ═══════════════════════════════════════════════════════════════
(function() {
  var HOLD = 8000;
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  // which bottom tab is active for each scene
  var TABS = { member: ['0', '1', '2', '0'], owner: ['0', '1', '2', '3'] };
  var demos = [];
  document.querySelectorAll('[data-demo]').forEach(function(root) {
    var d = {
      root: root, kind: root.getAttribute('data-demo'), cur: 0,
      scenes: root.querySelectorAll('.ph-scene'),
      dots: root.querySelectorAll('.ph-dots button'),
      tabs: root.querySelectorAll('.ph-tab')
    };
    if (d.scenes.length) demos.push(d);
  });
  if (!demos.length) return;
  var timer = null, playing = false, visible = {};

  function show(d, i) {
    d.scenes.forEach(function(s, n) {
      s.classList.remove('live', 'out');
      if (n === i) { void s.offsetWidth; s.classList.add('live'); }
      else if (n < i || (i === 0 && n === d.scenes.length - 1)) { s.classList.add('out'); }
    });
    d.dots.forEach(function(b, n) { b.classList.toggle('on', n === i); });
    var map = TABS[d.kind] || TABS.member;
    d.tabs.forEach(function(t) { t.classList.toggle('on', t.dataset.go === map[i]); });
    d.cur = i;
  }
  function tick() {
    var member = demos.filter(function(d) { return d.kind === 'member'; })[0];
    if (member && (member.cur + 1) % member.scenes.length === 0 && typeof swapPair === 'function') swapPair();   // new loop: the other pair
    demos.forEach(function(d) { show(d, (d.cur + 1) % d.scenes.length); });
  }
  function play() { if (playing || reduced) return; playing = true; timer = setInterval(tick, HOLD); }
  function pause() { playing = false; clearInterval(timer); }
  function anyVisible() { for (var k in visible) if (visible[k]) return true; return false; }

  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function(entries) {
      entries.forEach(function(e) { visible[e.target.getAttribute('data-demo')] = e.isIntersecting; });
      anyVisible() ? play() : pause();
    }, { threshold: 0.35 });
    demos.forEach(function(d) { io.observe(d.root); });
  } else { play(); }

  demos.forEach(function(d) {
    function jump(i, method) {
      if (i < 0) i = 3;
      pause(); show(d, i); setTimeout(play, 1500);
      if (window.gtag) gtag('event', 'demo_scene', { phone: d.kind, scene: i, method: method });
    }
    d.dots.forEach(function(b) { b.addEventListener('click', function() { jump(parseInt(b.dataset.go, 10), 'dot'); }); });
    d.tabs.forEach(function(t) { t.addEventListener('click', function() { jump(parseInt(t.dataset.go, 10), 'tab'); }); });
    d.root.addEventListener('mouseenter', pause);
    d.root.addEventListener('mouseleave', play);
  });
  document.addEventListener('visibilitychange', function() { document.hidden ? pause() : (anyVisible() && play()); });
})();

// ═══════════════════════════════════════════════════════════════
// OWNER APP (features section): five owner pains, each one drives one
// screen of the owner phone. Money follows the visitor's currency, dates
// and times follow their language. Every amount comes from one monthly
// fee, so the sums on the screens always add up.
// ═══════════════════════════════════════════════════════════════
// (renderPrices runs before this part of the file, so no top-level vars here: only function declarations)
function oaMoney() {
  var fee = local(17.9), short = local(3.8);   // one month at the demo gym: EGP 950 at the base rate
  return {
    fee: fee, week: fee * 9, today: local(159.5), day: local(2.83),
    cashExp: fee * 4, cashCnt: fee * 4 - short, short: short, pm1: fee * 3, pm2: fee * 2
  };
}

function renderOwnerApp() {
  var root = g('ownerApp'); if (!root) return;
  var t = T[_lang] || T.en, loc = numLocale();
  function tr(k) { return t[k] !== undefined ? t[k] : (T.en[k] !== undefined ? T.en[k] : ''); }
  var M = oaMoney();
  var PM = _country === 'EG' ? ['pay_insta', 'pay_voda'] : ['ow_card', 'ow_bank'];
  function day(off, months) {
    var d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + off);
    if (months) d.setMonth(d.getMonth() + months);
    return d;
  }
  function fd(d, o) { try { return new Intl.DateTimeFormat(loc, o).format(d); } catch (e) { return d.toDateString(); } }
  function hm(h, m) { var d = new Date(2026, 0, 5, h, m || 0); return fd(d, m === undefined ? { hour: 'numeric' } : { hour: 'numeric', minute: '2-digit' }); }
  var ended = day(-2), DM = { day: 'numeric', month: 'short' };
  var V = {
    a: tr('ph_n1'), b: tr('ph_n2'), w: tr('ph_w1'), wf: String(tr('ph_w1')).split(/\s+/)[0], s: tr('oa_staff'),
    fee: fmt(M.fee), short: fmt(M.short), m1: tr(PM[0]), m2: tr(PM[1]),
    end: fd(ended, DM), new: fd(day(-2, 1), DM), h: hm(19)
  };
  function fill(str) { return String(str).replace(/\{(\w+)\}/g, function (x, k) { return V[k] !== undefined ? V[k] : x; }); }
  root.querySelectorAll('[data-oa-t]').forEach(function (el) { el.textContent = fill(tr(el.getAttribute('data-oa-t'))); });
  root.querySelectorAll('[data-oa-h]').forEach(function (el) {
    var esc = {}; for (var k in V) esc[k] = String(V[k]).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; });
    el.innerHTML = String(tr(el.getAttribute('data-oa-h'))).replace(/\{(\w+)\}/g, function (x, k) { return esc[k] !== undefined ? esc[k] : x; });
  });
  root.querySelectorAll('[data-oa-m]').forEach(function (el) { var v = M[el.getAttribute('data-oa-m')]; el.setAttribute('data-v', v); el.textContent = fmt(v); });
  root.querySelectorAll('[data-oa-n]').forEach(function (el) { var v = +el.getAttribute('data-oa-n'); el.setAttribute('data-v', v); el.textContent = fmtNum(v); });
  root.querySelectorAll('[data-oa-date]').forEach(function (el) { el.textContent = fd(day(0), { weekday: 'short', day: 'numeric', month: 'short' }); });
  root.querySelectorAll('[data-oa-hour]').forEach(function (el) { el.textContent = hm(+el.getAttribute('data-oa-hour')); });
  root.querySelectorAll('[data-oa-time]').forEach(function (el) { var p = el.getAttribute('data-oa-time').split(':'); el.textContent = hm(+p[0], +p[1]); });
  root.querySelectorAll('[data-oa-ini]').forEach(function (el) { el.textContent = Array.from(tr(el.getAttribute('data-oa-ini')))[0] || ''; });
  veilOwnerApp(root);
  oaFit(root);
}
// Long amounts (JP¥, Rp, ₫) shrink to fit their box instead of being cut off.
function oaFit(root) {
  root.querySelectorAll('.oa-tri .oa-num').forEach(function (el) {
    el.style.fontSize = '';
    var size = parseFloat(getComputedStyle(el).fontSize) || 15;
    while (el.scrollWidth > el.clientWidth + 1 && size > 9) { size -= 0.5; el.style.fontSize = size + 'px'; }
  });
}
if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { var r = g('ownerApp'); if (r) oaFit(r); });
(function () {
  var root = g('ownerApp'); if (!root) return;
  var pains = [].slice.call(root.querySelectorAll('.oa-pain'));
  var scrs = [].slice.call(root.querySelectorAll('.oa-scr'));
  var tabs = [].slice.call(root.querySelectorAll('.oa-tab'));
  var phone = root.querySelector('.oa-phone'), stage = root.querySelector('.oa-stage');
  var DUR = [7000, 8000, 7000, 7000, 7500];
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var cur = 0, timer = null, left = DUR[0], started = 0, hover = false, inView = false;
  if (reduced) root.classList.add('still');

  function countUp(scr) {
    if (reduced) return;
    scr.querySelectorAll('[data-oa-c]').forEach(function (el) {
      var to = +el.getAttribute('data-v'), money = el.getAttribute('data-oa-c') === 'm';
      var host = el.closest('.oa-in, .oa-pop'), delay = host ? (parseFloat(host.style.getPropertyValue('--d')) || 0) * 1000 : 0;
      var shown = function (v) { return money ? fmt(v) : fmtNum(v); };
      el.textContent = shown(0);
      setTimeout(function () {
        var t0 = null;
        requestAnimationFrame(function f(now) {
          if (t0 === null) t0 = now;
          var p = Math.min(1, (now - t0) / 1100);
          el.textContent = shown(p < 1 ? Math.round(to * (1 - Math.pow(1 - p, 3))) : to);
          if (p < 1) requestAnimationFrame(f);
        });
      }, delay + 150);
    });
  }
  function show(i) {
    cur = i;
    pains.forEach(function (p, k) {
      var on = k === i;
      p.classList.toggle('on', on); p.setAttribute('aria-pressed', on ? 'true' : 'false');
      p.style.setProperty('--dur', DUR[k] + 'ms');
    });
    var bar = pains[i].querySelector('.oa-bar'); bar.style.display = 'none'; void bar.offsetWidth; bar.style.display = '';
    scrs.forEach(function (s) { s.classList.remove('on'); });
    void scrs[i].offsetWidth;
    scrs[i].classList.add('on');
    tabs.forEach(function (tb, k) { tb.classList.toggle('on', k === i); });
    countUp(scrs[i]);
    left = DUR[i]; schedule();
  }
  function running() { return !reduced && inView && !hover && !document.hidden; }
  function schedule() {
    clearTimeout(timer);
    root.classList.toggle('paused', !running());
    if (!running()) return;
    started = Date.now();
    timer = setTimeout(function () { show((cur + 1) % scrs.length); }, left);
  }
  function hold() { if (timer && running()) left = Math.max(400, left - (Date.now() - started)); clearTimeout(timer); timer = null; }
  function setState(fn) { hold(); fn(); schedule(); }

  pains.forEach(function (p, k) {
    p.addEventListener('click', function () {
      show(k);
      if (window.matchMedia('(max-width: 900px)').matches) {
        var r = phone.getBoundingClientRect();
        if (r.top > window.innerHeight - 160 || r.bottom < 80) phone.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' });
      }
      if (window.gtag) gtag('event', 'owner_app_screen', { screen: k });
    });
  });
  stage.addEventListener('mouseenter', function () { setState(function () { hover = true; }); });
  stage.addEventListener('mouseleave', function () { setState(function () { hover = false; }); });
  document.addEventListener('visibilitychange', function () { setState(function () {}); });
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        var was = inView;
        setState(function () { inView = e.isIntersecting; });
        if (e.isIntersecting && !was) show(cur);   // replay the screen when it scrolls into view
      });
    }, { threshold: 0.3 }).observe(phone);
  } else { inView = true; }
  show(0);
})();

// Long words ("Индивидуально", "Indywidualnie") shrink to fit the price box instead of spilling out.
function fitText() {
  document.querySelectorAll('.p-price').forEach(function (el) {
    el.style.fontSize = '';
    var size = parseFloat(getComputedStyle(el).fontSize) || 40;
    while (el.scrollWidth > el.clientWidth + 1 && size > 18) { size -= 1; el.style.fontSize = size + 'px'; }
  });
}
(function () {
  var t = null;
  window.addEventListener('resize', function () { clearTimeout(t); t = setTimeout(fitText, 150); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitText);
})();

// On phones the WhatsApp button would sit on top of the hero text and buttons: it waits until they scroll away.
(function () {
  var fab = g('waBtn'), ctas = document.querySelector('#hero .hero-text');   // the headline, text and buttons
  if (!fab) return;
  if (!ctas || !('IntersectionObserver' in window)) { fab.classList.remove('away'); return; }   // starts hidden in the HTML so it never flashes over the hero
  var phone = window.matchMedia('(max-width: 900px)');
  var r = ctas.getBoundingClientRect();   // decide before the first animation frame, so it never flashes over the buttons
  if (phone.matches && r.top < window.innerHeight && r.bottom > 0) fab.classList.add('away');
  new IntersectionObserver(function (es) {
    es.forEach(function (e) { fab.classList.toggle('away', e.isIntersecting && phone.matches); });
  }).observe(ctas);
})();

// ─── CONVERSION TRACKING ─────────────────────────────────────
function trackCTA(location, plan) {
  if (!window.gtag) return;
  gtag('event', 'begin_trial', {
    cta_location: location, plan: plan || 'unspecified', zone: _zone, country: _country,
    currency: _cur, billing: _billing === 'm' ? 'monthly' : 'annual', language: _lang
  });
}
(function() {
  [['navCta','navbar',null], ['mobCta','mobile_menu',null], ['ctaMain','hero',null],
   ['p1btn','pricing','starter'], ['p2btn','pricing','growth'], ['p3btn','pricing','pro'],
   ['entBtn','pricing','enterprise'], ['refBtn','referral',null]
  ].forEach(function(m) { var el = g(m[0]); if (el) el.addEventListener('click', function(){ trackCTA(m[1], m[2]); }); });
  var hit = {};
  window.addEventListener('scroll', function() {
    var pct = Math.round(window.scrollY / (document.body.scrollHeight - window.innerHeight) * 100);
    [25,50,75,100].forEach(function(mark) {
      if (pct >= mark && !hit[mark]) { hit[mark] = 1; if (window.gtag) gtag('event','scroll_depth',{percent:mark}); }
    });
  }, { passive: true });
})();

// ─── MODALS ──────────────────────────────────────────────────
function openModal(id) { var m = g(id); if (!m) return; m.classList.add('open'); document.body.style.overflow = 'hidden'; }
function closeModal(id) { var m = g(id); if (!m) return; m.classList.remove('open'); document.body.style.overflow = ''; }
document.querySelectorAll('.modal-overlay').forEach(function(ov) {
  ov.addEventListener('click', function(e) { if (e.target === ov) closeModal(ov.id); });
});
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') document.querySelectorAll('.modal-overlay.open').forEach(function(m){ closeModal(m.id); });
});

// ═══════════════════════════════════════════════════════════════
// MATCHING DEMO PHOTOS: a men's pair and a women's pair of real members.
// The visitor's country picks which pair shows first; every loop of the
// demo switches to the other pair, so everyone sees both.
// ═══════════════════════════════════════════════════════════════
var PAIRS = {
  m: { img: ['assets/images/members/m1.webp', 'assets/images/members/m2.webp'],
       key: { '1': 'ph_n1', '2': 'ph_n2', toast: 'ph_m_toast', post: 'ph_post' } },
  w: { img: ['assets/images/members/w1.webp', 'assets/images/members/w2.webp'],
       key: { '1': 'ph_w1', '2': 'ph_w2', toast: 'ph_m_toast_w', post: 'ph_post_w' } }
};
var _pair = 'm';
function setPair(p) {
  var P = PAIRS[p]; if (!P) return;
  _pair = p;
  document.querySelectorAll('[data-pair-img]').forEach(function (im) {
    im.src = P.img[im.getAttribute('data-pair-img') === 'a' ? 0 : 1];
  });
  var t = T[_lang] || T.en;
  document.querySelectorAll('[data-pair-key]').forEach(function (el) {
    var k = P.key[el.getAttribute('data-pair-key')];
    el.setAttribute('data-i18n', k);
    el.textContent = t[k] !== undefined ? t[k] : T.en[k];
  });
  var veil = p === 'w' && isVeiled();
  document.querySelectorAll('[data-pair-img]').forEach(function (im) {
    var box = im.parentNode, k = P.key[im.getAttribute('data-pair-img') === 'a' ? '1' : '2'];
    box.classList.toggle('veil', veil);
    box.setAttribute('data-ini', Array.from(String(t[k] || T.en[k] || ''))[0] || '');
  });
}
window.rfkSetPair = function () { setPair(_pair); };
function swapPair() { setPair(_pair === 'm' ? 'w' : 'm'); }
(function () {
  var cc = _country || 'US';
  setPair((cc.charCodeAt(0) + cc.charCodeAt(1)) % 2 ? 'm' : 'w');
  ['m', 'w'].forEach(function (p) { PAIRS[p].img.forEach(function (src) { var i = new Image(); i.src = src; }); });
})();

// ═══════════════════════════════════════════════════════════════
// WHATSAPP: chat with the Refka team. The message is pre-written in the
// visitor's language with their country. A small bubble invites the chat
// once per visit, on desktop only (site.css hides it on phones).
// ═══════════════════════════════════════════════════════════════
var WA_NUMBER = '201149421081';
function setWhatsApp() {
  var t = T[_lang] || T.en, msg = t.wa_msg || T.en.wa_msg, cname = _country;
  try { cname = new Intl.DisplayNames([numLocale(), 'en'], { type: 'region' }).of(_country); } catch (e) {}
  var href = 'https://wa.me/' + WA_NUMBER + '?text=' + encodeURIComponent(msg.replace('{c}', cname));
  document.querySelectorAll('#waBtn, #waBubbleLink, .wa-link').forEach(function(a) { a.href = href; });
}
(function() {
  var fab = g('waBtn'), bub = g('waBubble');
  if (!fab) return;
  function hideBub() { if (bub) bub.hidden = true; try { sessionStorage.setItem('rfk_wa', '1'); } catch (e) {} }
  var seen = false; try { seen = sessionStorage.getItem('rfk_wa') === '1'; } catch (e) {}
  if (bub && !seen) setTimeout(function() {
    if (document.querySelector('.modal-overlay.open')) return;
    bub.hidden = false;
    setTimeout(function() { bub.hidden = true; }, 12000);   // a hint, not a nag
  }, 9000);
  var x = g('waClose'); if (x) x.addEventListener('click', hideBub);
  var bl = g('waBubbleLink'); if (bl) bl.addEventListener('click', hideBub);
  fab.addEventListener('click', function() { hideBub(); if (window.gtag) gtag('event', 'whatsapp_click', { language: _lang, country: _country }); });
  setWhatsApp();
})();

// ═══════════════════════════════════════════════════════════════
// VISIT STATISTICS: Cloudflare Web Analytics. No cookies, no IP stored,
// no cross-site tracking, so no consent banner is needed. Off until the
// token from the Cloudflare dashboard is pasted here, and only on refka.tech.
// ═══════════════════════════════════════════════════════════════
var CF_ANALYTICS_TOKEN = '';
(function() {
  if (!CF_ANALYTICS_TOKEN || !/(^|\.)refka\.tech$/.test(location.hostname)) return;
  var sc = document.createElement('script');
  sc.defer = true; sc.src = 'https://static.cloudflareinsights.com/beacon.min.js';
  sc.setAttribute('data-cf-beacon', JSON.stringify({ token: CF_ANALYTICS_TOKEN }));
  document.head.appendChild(sc);
})();
