/* Refka website: page behaviour: menu, background, pricing engine, language, demo, modals, cookies. Classic scripts, loaded with defer in this order:
   i18n.js -> app.js -> form.js. No build step. */
// ─── NON-LANG JS (mobile menu, canvas, scroll, fade) ─────────
// MOBILE MENU
var burger = document.getElementById('burger');
var mobMenu = document.getElementById('mobMenu');
function closeMob() { mobMenu.classList.remove('open'); document.body.style.overflow = ''; }
burger.addEventListener('click', function() {
  var o = mobMenu.classList.toggle('open');
  document.body.style.overflow = o ? 'hidden' : '';
});

// CANVAS ANIMATION
var canvas = document.getElementById('canvas');
var ctx = canvas.getContext('2d');
var nodes = [];
var W, H, running = true;

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
  if (!running) return;
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
  requestAnimationFrame(draw);
}

resize();
initNodes();
draw();
window.addEventListener('resize', function() { resize(); initNodes(); });
document.addEventListener('visibilitychange', function() {
  running = !document.hidden;
  if (running) draw();
});

// SCROLL REVEAL
var observer = new IntersectionObserver(function(entries) {
  entries.forEach(function(e) {
    if (e.isIntersecting) {
      e.target.classList.add('in');
      observer.unobserve(e.target);
    }
  });
}, { threshold: .1, rootMargin: '0px 0px -40px 0px' });
document.querySelectorAll('.fade').forEach(function(el) { observer.observe(el); });

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
var EURO = 'DE FR NL BE AT FI IE ES IT PT SI EE SK LV LT HR MT CY LU GR SM AD MC ME XK'.split(' ');
var CUR = {
  EG:'EGP', SA:'SAR', AE:'AED', QA:'QAR', KW:'KWD', BH:'BHD', OM:'OMR', JO:'JOD', MA:'MAD', TN:'TND', DZ:'DZD',
  IQ:'IQD', LY:'LYD', AL:'ALL', TR:'TRY', GB:'GBP', CH:'CHF', LI:'CHF', SE:'SEK', NO:'NOK', DK:'DKK', PL:'PLN',
  CZ:'CZK', HU:'HUF', RO:'RON', BG:'BGN', IS:'ISK', RS:'RSD', MK:'MKD', BA:'BAM', UA:'UAH', RU:'RUB', GE:'GEL',
  KZ:'KZT', US:'USD', PR:'USD', CA:'CAD', MX:'MXN', BR:'BRL', AR:'ARS', CO:'COP', CL:'CLP', PE:'PEN',
  AU:'AUD', NZ:'NZD', JP:'JPY', KR:'KRW', CN:'CNY', HK:'HKD', MO:'MOP', TW:'TWD', SG:'SGD', MY:'MYR',
  ID:'IDR', TH:'THB', PH:'PHP', VN:'VND', IN:'INR', PK:'PKR', BD:'BDT', LK:'LKR', NP:'NPR', IL:'ILS',
  ZA:'ZAR', NG:'NGN', KE:'KES', GH:'GHS', TZ:'TZS', UG:'UGX', ET:'ETB', RW:'RWF'
};
EURO.forEach(function(c){ CUR[c] = 'EUR'; });

// FX snapshot: USD -> currency. ECB reference rates 16 Oct 2026 (via EUR/USD 1.1253),
// GCC/JOD official pegs, EGP market rate 14 Oct 2026, ALL Bank of Albania official 16 Oct 2026. Replaced at runtime by a live
// feed when reachable (window.REFKA_FX from the server, or open.er-api.com).
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

var TZ = {
  'Africa/Cairo':'EG','Asia/Riyadh':'SA','Asia/Dubai':'AE','Asia/Qatar':'QA','Asia/Kuwait':'KW','Asia/Bahrain':'BH',
  'Asia/Muscat':'OM','Asia/Amman':'JO','Asia/Beirut':'LB','Asia/Baghdad':'IQ','Asia/Damascus':'SY','Asia/Aden':'YE',
  'Asia/Gaza':'PS','Asia/Hebron':'PS','Africa/Casablanca':'MA','Africa/El_Aaiun':'MA','Africa/Tunis':'TN',
  'Africa/Algiers':'DZ','Africa/Tripoli':'LY','Africa/Khartoum':'SD','Africa/Nouakchott':'MR',
  'Europe/Tirane':'AL','Europe/Berlin':'DE','Europe/Busingen':'DE','Europe/Vienna':'AT','Europe/Zurich':'CH',
  'Europe/Vaduz':'LI','Europe/Paris':'FR','Europe/Monaco':'MC','Europe/London':'GB','Europe/Dublin':'IE',
  'Europe/Madrid':'ES','Atlantic/Canary':'ES','Europe/Lisbon':'PT','Atlantic/Madeira':'PT','Europe/Rome':'IT',
  'Europe/Amsterdam':'NL','Europe/Brussels':'BE','Europe/Luxembourg':'LU','Europe/Copenhagen':'DK',
  'Europe/Stockholm':'SE','Europe/Oslo':'NO','Europe/Helsinki':'FI','Europe/Warsaw':'PL','Europe/Prague':'CZ',
  'Europe/Bratislava':'SK','Europe/Budapest':'HU','Europe/Bucharest':'RO','Europe/Sofia':'BG','Europe/Athens':'GR',
  'Europe/Istanbul':'TR','Asia/Istanbul':'TR','Europe/Belgrade':'RS','Europe/Skopje':'MK','Europe/Zagreb':'HR',
  'Europe/Ljubljana':'SI','Europe/Sarajevo':'BA','Europe/Podgorica':'ME','Europe/Kiev':'UA','Europe/Kyiv':'UA',
  'Europe/Moscow':'RU','Europe/Minsk':'BY','Europe/Riga':'LV','Europe/Vilnius':'LT','Europe/Tallinn':'EE',
  'Europe/Malta':'MT','Asia/Nicosia':'CY','Europe/Nicosia':'CY','Europe/Chisinau':'MD','Atlantic/Reykjavik':'IS',
  'Asia/Jerusalem':'IL','Asia/Tel_Aviv':'IL','Asia/Tehran':'IR','Asia/Karachi':'PK','Asia/Kolkata':'IN',
  'Asia/Calcutta':'IN','Asia/Dhaka':'BD','Asia/Colombo':'LK','Asia/Kathmandu':'NP','Asia/Jakarta':'ID',
  'Asia/Makassar':'ID','Asia/Jayapura':'ID','Asia/Pontianak':'ID','Asia/Kuala_Lumpur':'MY','Asia/Kuching':'MY',
  'Asia/Singapore':'SG','Asia/Manila':'PH','Asia/Bangkok':'TH','Asia/Ho_Chi_Minh':'VN','Asia/Saigon':'VN',
  'Asia/Seoul':'KR','Asia/Tokyo':'JP','Asia/Shanghai':'CN','Asia/Urumqi':'CN','Asia/Hong_Kong':'HK',
  'Asia/Taipei':'TW','Asia/Macau':'MO','Asia/Almaty':'KZ','Asia/Tbilisi':'GE','Asia/Yerevan':'AM','Asia/Baku':'AZ',
  'Asia/Tashkent':'UZ','Africa/Lagos':'NG','Africa/Nairobi':'KE','Africa/Accra':'GH','Africa/Johannesburg':'ZA',
  'Africa/Dar_es_Salaam':'TZ','Africa/Kampala':'UG','Africa/Addis_Ababa':'ET','Africa/Kigali':'RW',
  'Africa/Dakar':'SN','Africa/Abidjan':'CI','Australia/Sydney':'AU','Australia/Melbourne':'AU',
  'Australia/Brisbane':'AU','Australia/Perth':'AU','Australia/Adelaide':'AU','Australia/Hobart':'AU',
  'Pacific/Auckland':'NZ','America/Sao_Paulo':'BR','America/Mexico_City':'MX','America/Argentina/Buenos_Aires':'AR',
  'America/Buenos_Aires':'AR','America/Bogota':'CO','America/Santiago':'CL','America/Lima':'PE',
  'America/Toronto':'CA','America/Vancouver':'CA','America/Edmonton':'CA','America/Winnipeg':'CA',
  'America/Halifax':'CA','America/St_Johns':'CA','America/New_York':'US','America/Chicago':'US',
  'America/Denver':'US','America/Los_Angeles':'US','America/Phoenix':'US','America/Anchorage':'US',
  'America/Detroit':'US','Pacific/Honolulu':'US','America/Puerto_Rico':'PR'
};

var _billing = 'm', _country = 'US', _zone = 'A', _cur = 'USD';

function zoneOf(cc) { return ZONE_A.indexOf(cc) > -1 ? 'A' : 'B'; }
function curOf(cc) { var c = CUR[cc] || 'USD'; return FX[c] ? c : 'USD'; }

function detectCountry() {
  try {
    var q = new URLSearchParams(window.location.search).get('country');
    if (q && /^[A-Za-z]{2}$/.test(q)) return q.toUpperCase();
  } catch(e) {}
  try { var s = localStorage.getItem('rfk_cc'); if (s) return s; } catch(e) {}
  if (window.REFKA_GEO && window.REFKA_GEO.country) return String(window.REFKA_GEO.country).toUpperCase();
  try {
    var tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (TZ[tz]) return TZ[tz];
  } catch(e) {}
  var langs = navigator.languages || [navigator.language || ''];
  for (var i = 0; i < langs.length; i++) {
    var m = /[-_]([A-Za-z]{2})$/.exec(langs[i] || '');
    if (m) return m[1].toUpperCase();
  }
  return 'US';
}

function numLocale() {
  var map = { 'ar':'ar-EG', 'tl':'fil', 'zh-Hans':'zh-CN', 'zh-Hant':'zh-TW' };
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
  document.querySelectorAll('.ai-q').forEach(function(el) { el.textContent = fmtNum(P[el.dataset.plan].ai); });
  document.querySelectorAll('[data-usd]').forEach(function(el) { el.textContent = fmt(local(+el.dataset.usd)); });
  var t = T[_lang] || T.en, n = g('locNote');
  // Payment methods follow the visitor's country: Egypt shows InstaPay and Vodafone Cash.
  var eg = _country === 'EG';
  document.documentElement.classList.toggle('cc-eg', eg);
  var PM = eg ? { '1': 'pay_insta', '2': 'pay_voda' } : { '1': 'ow_card', '2': 'ow_bank' };
  document.querySelectorAll('[data-pm]').forEach(function(el) { var k = PM[el.getAttribute('data-pm')]; el.textContent = t[k] || T.en[k]; });
  if (typeof setWhatsApp === 'function') setWhatsApp();
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
  renderPrices();
}

function setBilling(b) {
  _billing = b;
  var bM = g('biMonthly'), bA = g('biAnnual');
  if (bM) bM.classList.toggle('active', b === 'm');
  if (bA) bA.classList.toggle('active', b === 'a');
  document.querySelectorAll('.billing-mo').forEach(function(el){ el.style.display = b === 'm' ? '' : 'none'; });
  document.querySelectorAll('.billing-an').forEach(function(el){ el.style.display = b === 'a' ? '' : 'none'; });
  renderPrices();
}

// Live FX: the production server injects window.REFKA_FX (daily rates, USD base) before this script.
// No third-party call from the browser (GDPR: no visitor IP sent to an FX provider without consent).

// Registration hand-off: the app receives plan, country and language.
function goRegister(plan) {
  var u = 'https://app.refka.io/register?lang=' + encodeURIComponent(_lang) +
          '&country=' + encodeURIComponent(_country) + (plan ? '&plan=' + plan : '');
  openOut(u);
}
function goContact() { openOut('https://app.refka.io/contact?lang=' + encodeURIComponent(_lang)); }
// On refka.io: same tab. Anywhere else (previews, embeds): new tab, never navigate the frame itself,
// because sandboxed previews block in-frame navigation to other sites ("This content is blocked").
function openOut(u) {
  if (/(^|\.)refka\.io$/.test(location.hostname)) { window.location.href = u; return; }
  var w = null;
  try { w = window.open(u, '_blank', 'noopener'); } catch(e) {}
  if (!w) {
    var a = document.createElement('a'); a.href = u; a.target = '_blank'; a.rel = 'noopener';
    document.body.appendChild(a); a.click(); a.remove();
  }
}

// ═══════════════════════════════════════════════════════════════
// LANGUAGE
// ═══════════════════════════════════════════════════════════════
function applyLang(code) {
  var t = T[code];
  if (!t) return;
  _lang = code;
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

  // Cookie banner
  var ck = g('cookieText'); if (ck) ck.innerHTML = t.ck_txt || T.en.ck_txt;
  var ce = g('cookieEss'); if (ce) ce.textContent = t.ck_ess || T.en.ck_ess;
  var ca = g('cookieAll'); if (ca) ca.textContent = t.ck_all || T.en.ck_all;

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
  trigBtn.addEventListener('click', function(e) { e.stopPropagation(); overlay.classList.toggle('open'); });
  if (closeBtn) closeBtn.addEventListener('click', function() { overlay.classList.remove('open'); });
  overlay.addEventListener('click', function(e) { if (e.target === overlay) overlay.classList.remove('open'); });
  if (panel) panel.addEventListener('click', function(e) { e.stopPropagation(); });
  document.addEventListener('keydown', function(e) { if (e.key === 'Escape') overlay.classList.remove('open'); });
  document.querySelectorAll('.lang-opt').forEach(function(btn) {
    btn.addEventListener('click', function() { applyLang(btn.dataset.l); overlay.classList.remove('open'); });
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

  var code = null;
  try {
    var q = new URLSearchParams(window.location.search).get('lang');
    if (q && T[q]) code = q;
  } catch(e) {}
  if (!code) { try { var st = localStorage.getItem('rfk_l'); if (st && T[st]) code = st; } catch(e) {} }
  if (!code) {
    var nav = (navigator.language || 'en').toLowerCase();
    if (nav.indexOf('zh-tw') === 0 || nav.indexOf('zh-hk') === 0 || nav.indexOf('zh-hant') === 0) code = 'zh-Hant';
    else if (nav.indexOf('zh') === 0) code = 'zh-Hans';
    else if (nav.indexOf('fil') === 0) code = 'tl';
    else if (T[nav.substring(0, 2)]) code = nav.substring(0, 2);
    else code = 'en';
  }
  applyLang(code);
})();

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

// ─── COOKIE ──────────────────────────────────────────────────
function setCookieChoice(c) {
  try { localStorage.setItem('rfk_cookie', c); } catch(e) {}
  var b = g('cookieBanner'); if (b) b.classList.remove('show');
}
(function() {
  var s; try { s = localStorage.getItem('rfk_cookie'); } catch(e) {}
  if (!s) setTimeout(function() { var b = g('cookieBanner'); if (b) b.classList.add('show'); }, 1200);
})();

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
}
function swapPair() { setPair(_pair === 'm' ? 'w' : 'm'); }
(function () {
  var cc = _country || 'US';
  setPair((cc.charCodeAt(0) + cc.charCodeAt(1)) % 2 ? 'm' : 'w');
  ['m', 'w'].forEach(function (p) { PAIRS[p].img.forEach(function (src) { var i = new Image(); i.src = src; }); });
})();

// ═══════════════════════════════════════════════════════════════
// WHATSAPP: chat with the Refka team. The message is pre-written in the
// visitor's language with their country. A small bubble invites the chat
// once per visit and moves up while the cookie banner is open.
// ═══════════════════════════════════════════════════════════════
var WA_NUMBER = '201149421081';
function setWhatsApp() {
  var t = T[_lang] || T.en, msg = t.wa_msg || T.en.wa_msg, cname = _country;
  try { cname = new Intl.DisplayNames([numLocale(), 'en'], { type: 'region' }).of(_country); } catch (e) {}
  var href = 'https://wa.me/' + WA_NUMBER + '?text=' + encodeURIComponent(msg.replace('{c}', cname));
  ['waBtn', 'waBubbleLink'].forEach(function(id) { var a = g(id); if (a) a.href = href; });
}
(function() {
  var fab = g('waBtn'), bub = g('waBubble'), ck = g('cookieBanner');
  if (!fab) return;
  function place() {
    var h = ck && ck.classList.contains('show') ? ck.offsetHeight : 0;
    fab.style.bottom = (20 + h) + 'px';
    if (bub) bub.style.bottom = (90 + h) + 'px';
  }
  place();
  window.addEventListener('resize', place);
  if (ck && 'MutationObserver' in window) new MutationObserver(place).observe(ck, { attributes: true, attributeFilter: ['class'] });
  function hideBub() { if (bub) bub.hidden = true; try { sessionStorage.setItem('rfk_wa', '1'); } catch (e) {} }
  var seen = false; try { seen = sessionStorage.getItem('rfk_wa') === '1'; } catch (e) {}
  if (bub && !seen) setTimeout(function() {
    if (document.querySelector('.modal-overlay.open')) return;
    bub.hidden = false; place();
    setTimeout(function() { bub.hidden = true; }, 12000);   // a hint, not a nag
  }, 9000);
  var x = g('waClose'); if (x) x.addEventListener('click', hideBub);
  var bl = g('waBubbleLink'); if (bl) bl.addEventListener('click', hideBub);
  fab.addEventListener('click', function() { hideBub(); if (window.gtag) gtag('event', 'whatsapp_click', { language: _lang, country: _country }); });
  setWhatsApp();
})();
