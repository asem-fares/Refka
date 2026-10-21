/* Refka website: click dispatcher, modal focus handling, signup/contact form. Classic scripts, loaded with defer in this order:
   boot.js (in <head>) -> i18n/en.js -> app.js -> form.js. No build step. */
// ═══════════════════════════════════════════════════════════════
// CLICK DISPATCHER
// The Content-Security-Policy forbids inline handlers (onclick="…"),
// so every clickable element declares data-click / data-click-arg instead.
// ═══════════════════════════════════════════════════════════════
var CLICK_ACTIONS = {
  goRegister: function (arg) { goRegister(arg || null); },
  goRefer: function () { shareRefka(); },
  goContact: function () { goContact(); },
  closeMob: function () { closeMob(); },
  closeMobRegister: function () { closeMob(); goRegister(); },
  scrollHow: function () { var h = g('how'); if (h) h.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); },
  openModal: function (arg) { openModal(arg); },
  closeModal: function (arg) { closeModal(arg); },
  setBilling: function (arg) { setBilling(arg); }
};
document.addEventListener('click', function (e) {
  var el = e.target.closest ? e.target.closest('[data-click]') : null;
  if (!el) return;
  var fn = CLICK_ACTIONS[el.getAttribute('data-click')];
  if (!fn) return;
  // Keep normal anchor navigation for the in-page menu links (#how, #features…)
  if (el.getAttribute('data-click') !== 'closeMob') e.preventDefault();
  fn(el.getAttribute('data-click-arg'));
});

// ═══════════════════════════════════════════════════════════════
// MODAL FOCUS MANAGEMENT (keyboard + screen-reader users)
// ═══════════════════════════════════════════════════════════════
var _lastFocus = null;
var FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([tabindex="-1"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
openModal = function (id) {
  var m = g(id); if (!m) return;
  _lastFocus = document.activeElement;
  m.classList.add('open');
  document.body.style.overflow = 'hidden';
  var first = id === 'signupModal' ? (m.querySelector('#chatFields input') || m.querySelector('.chat-x')) : m.querySelector('.modal-close');
  if (first) setTimeout(function () { first.focus(); }, 30);
};
closeModal = function (id) {
  var m = g(id); if (!m) return;
  m.classList.remove('open');
  if (!document.querySelector('.modal-overlay.open')) document.body.style.overflow = '';
  if (_lastFocus && _lastFocus.focus) { try { _lastFocus.focus(); } catch (e) {} }
};
document.addEventListener('keydown', function (e) {
  if (e.key !== 'Tab') return;
  var m = document.querySelector('.modal-overlay.open');
  if (!m) return;
  var f = Array.prototype.filter.call(m.querySelectorAll(FOCUSABLE), function (x) { return x.offsetParent !== null; });
  if (!f.length) return;
  var first = f[0], last = f[f.length - 1];
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
});

// ═══════════════════════════════════════════════════════════════
// SIGNUP / CONTACT FORM
// Until the gym-owner app exists, "Start Free Trial" opens this form and
// the request is emailed to the team. When app.refka.tech goes live, set
// APP_URL and every button sends gym owners straight to registration,
// with their language, country and chosen plan.
// ═══════════════════════════════════════════════════════════════
var APP_URL = '';                                   // e.g. 'https://app.refka.tech'
var LEADS_INBOX = 'community@refka.tech';
var LEADS_ENDPOINT = 'https://formsubmit.co/ajax/' + LEADS_INBOX;
var LIVE_HOST = /(^|\.)refka\.tech$/;               // only the real site sends emails

goRegister = function (plan) {
  if (APP_URL) {
    return openOut(APP_URL + '/register?lang=' + encodeURIComponent(_lang) +
      '&country=' + encodeURIComponent(_country) + (plan ? '&plan=' + encodeURIComponent(plan) : ''));
  }
  openSignup('trial', plan);
};
goContact = function () {
  if (APP_URL) return openOut(APP_URL + '/contact?lang=' + encodeURIComponent(_lang));
  openSignup('contact', 'enterprise');
};
// Same tab on refka.tech; new tab anywhere else (sandboxed previews block in-frame navigation).
openOut = function (u) {
  if (LIVE_HOST.test(location.hostname)) { window.location.href = u; return; }
  var w = null;
  try { w = window.open(u, '_blank', 'noopener'); } catch (e) {}
  if (!w) {
    var a = document.createElement('a'); a.href = u; a.target = '_blank'; a.rel = 'noopener';
    document.body.appendChild(a); a.click(); a.remove();
  }
};

// ─── PRE-LAUNCH: every button opens one short conversation ───────────
// Six questions, one at a time, like a WhatsApp chat. When the number is in, the answers are
// emailed to the team (so no lead is lost even if WhatsApp never opens) and the visitor gets a
// ready-written WhatsApp message to send us. The same answers, two channels.
var WA_NUMBER = '201149421081';
var PLAN_NAMES = { starter: 'Starter', growth: 'Growth', pro: 'Pro', enterprise: 'Enterprise' };
var DIAL = { EG:'20', SA:'966', AE:'971', KW:'965', QA:'974', BH:'973', OM:'968', JO:'962', LB:'961', IQ:'964', MA:'212', TN:'216',
  DZ:'213', LY:'218', SD:'249', YE:'967', PS:'970', SY:'963', AL:'355', DE:'49', AT:'43', CH:'41', GB:'44', IE:'353', US:'1', CA:'1',
  FR:'33', IT:'39', ES:'34', PT:'351', NL:'31', BE:'32', PL:'48', GR:'30', SE:'46', TR:'90', RU:'7', UA:'380', IN:'91', PK:'92',
  ID:'62', MY:'60', SG:'65', PH:'63', NG:'234', KE:'254', ZA:'27', AU:'61', NZ:'64', BR:'55', MX:'52', XK:'383', MK:'389', RS:'381' };

var _ch = { mode: 'trial', plan: null, step: 0, a: {}, sent: false, last: 0 };
var STEPS = [
  { k: 'name', q: 'ch_q_name', kind: 'text', ph: 'ch_ph_name', ac: 'name', max: 80 },
  { k: 'gym', q: 'ch_q_gym', kind: 'text', ph: 'ch_ph_gym', ac: 'organization', max: 100 },
  { k: 'city', q: 'ch_q_city', kind: 'text', ph: 'ch_ph_city', ac: 'address-level2', max: 80 },
  { k: 'members', q: 'ch_q_members', kind: 'chips', opts: [['<150', '\u2066< 150\u2069'], ['150-500', '\u2066150 – 500\u2069'], ['500-2000', '\u2066500 – 2,000\u2069'], ['2000+', '\u20662,000+\u2069']] },
  { k: 'need', q: 'ch_q_need', kind: 'chips', opts: [['retention', 'ch_n1'], ['desk', 'ch_n2'], ['community', 'ch_n3'], ['income', 'ch_n4']], i18n: true },
  { k: 'phone', q: 'ch_q_phone', kind: 'phone' }
];

function tr(k) { var t = T[_lang] || T.en; return t[k] !== undefined ? t[k] : T.en[k]; }
function fill(s) { return String(s).replace(/\{(\w+)\}/g, function (m, k) { return _ch.a[k] !== undefined ? _ch.a[k] : (k === 'plan' && _ch.plan ? PLAN_NAMES[_ch.plan] : m); }); }
function esc(s) { var d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
function reduced() { return matchMedia('(prefers-reduced-motion: reduce)').matches; }

// Arabic keyboards type ٠١٢… (and Persian/Urdu ۰۱۲…): read them as 0-9 so the number arrives in a form WhatsApp understands.
function latinDigits(s) {
  return String(s).replace(/[٠-٩]/g, function (d) { return d.charCodeAt(0) - 0x0660; })
                  .replace(/[۰-۹]/g, function (d) { return d.charCodeAt(0) - 0x06F0; });
}

function bubble(html, who, cls) {
  var log = g('chatLog'), b = document.createElement('div');
  b.className = 'cb ' + (who || 'bot') + (cls ? ' ' + cls : '');
  b.innerHTML = html; log.appendChild(b);
  requestAnimationFrame(function () { b.classList.add('in'); log.scrollTop = log.scrollHeight; });
  return b;
}
// Refka "types" for a moment before each question: the pause makes it read like a person, not a form.
function say(html, then, cls) {
  if (reduced()) { bubble(html, 'bot', cls); if (then) then(); return; }
  var t = bubble('<i></i><i></i><i></i>', 'bot', 'typing');
  setTimeout(function () { t.remove(); bubble(html, 'bot', cls); if (then) setTimeout(then, 120); }, 650);
}

function askStep() {
  var st = STEPS[_ch.step], box = g('chatFields'); box.innerHTML = ''; g('chatErr').textContent = '';
  say(esc(fill(tr(st.q))), function () {
    if (st.kind === 'chips') {
      var row = document.createElement('div'); row.className = 'chat-chips';
      st.opts.forEach(function (o) {
        var c = document.createElement('button'); c.type = 'button'; c.className = 'chat-chip';
        c.textContent = st.i18n ? tr(o[1]) : o[1];
        c.addEventListener('click', function () { answer(o[0], c.textContent); });
        row.appendChild(c);
      });
      box.appendChild(row);
      var first = row.querySelector('button'); if (first) first.focus();
      return;
    }
    var line = document.createElement('div'); line.className = 'chat-line';
    var inp = document.createElement('input');
    inp.id = 'chatField'; inp.maxLength = st.max || 24;
    if (st.kind === 'phone') {
      inp.type = 'tel'; inp.inputMode = 'tel'; inp.autocomplete = 'tel'; inp.dir = 'ltr';
      inp.value = DIAL[_country] ? '+' + DIAL[_country] + ' ' : '+';
      inp.setAttribute('aria-label', tr('fm_phone'));
    } else {
      inp.type = 'text'; inp.autocomplete = st.ac; inp.placeholder = tr(st.ph); inp.setAttribute('aria-label', tr(st.ph));
    }
    var btn = document.createElement('button'); btn.type = 'submit'; btn.className = 'chat-send'; btn.setAttribute('aria-label', tr('ch_next'));
    btn.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="currentColor" d="M3.4 20.4 21 12 3.4 3.6 3.4 10l12.6 2-12.6 2z"/></svg>';
    line.appendChild(inp); line.appendChild(btn); box.appendChild(line);
    if (st.kind === 'phone') {
      var ref = document.createElement('input'); ref.type = 'text'; ref.id = 'chatRef'; ref.className = 'chat-ref'; ref.maxLength = 100;
      ref.placeholder = tr('ch_ref_ph'); ref.setAttribute('aria-label', tr('ch_ref_ph')); ref.autocomplete = 'off';
      box.appendChild(ref);
    }
    setTimeout(function () { inp.focus(); var n = inp.value.length; try { inp.setSelectionRange(n, n); } catch (e) {} }, 30);
  });
}

function answer(value, shown) {
  var st = STEPS[_ch.step];
  _ch.a[st.k] = value; if (st.kind === 'chips') _ch.a[st.k + '_t'] = shown;
  g('chatFields').innerHTML = ''; g('chatErr').textContent = '';
  bubble(st.kind === 'phone' ? '<span dir="ltr">' + esc(shown) + '</span>' : esc(shown), 'me');
  _ch.step++;
  if (_ch.step < STEPS.length) askStep(); else finish();
}

function onSubmit(e) {
  e.preventDefault();
  var st = STEPS[_ch.step], inp = g('chatField'); if (!st || !inp) return;
  var v = latinDigits(inp.value.trim()), err = '';
  if (st.kind === 'phone') {
    var d = v.replace(/\D/g, '');
    if (!/^\+?[\d\s\-().]+$/.test(v) || d.length < 7 || d.length > 15) err = tr('fm_bad_phone');
    var r = g('chatRef'); _ch.a.ref = r ? r.value.trim() : '';
  } else if (!v) err = tr('fm_req');
  if (err) { g('chatErr').textContent = err; inp.setAttribute('aria-invalid', 'true'); inp.focus(); return; }
  answer(v, v);
}

function waText() {
  var a = _ch.a, lines = [fill(tr('ch_wa_1')), fill(tr('ch_wa_2'))];
  lines.push(tr('ch_wa_members') + ' ' + a.members_t);
  lines.push(tr('ch_wa_need') + ' ' + a.need_t);
  if (_ch.plan) lines.push(tr('ch_wa_plan') + ' ' + PLAN_NAMES[_ch.plan]);
  if (a.ref) lines.push(tr('ch_wa_ref') + ' ' + a.ref);
  return lines.join('\n');
}

function finish() {
  saveLead();
  say(esc(fill(tr('ch_done'))), function () {
    var txt = waText();
    var p = bubble(esc(txt).replace(/\u2066([^\u2069]*)\u2069/g, '<bdi dir="ltr">$1</bdi>').replace(/\n/g, '<br>'), 'bot', 'wa-preview');
    p.setAttribute('dir', 'auto');
    var box = g('chatFields'); box.innerHTML = '';
    var a = document.createElement('a'); a.className = 'btn-teal chat-wa'; a.target = '_blank'; a.rel = 'noopener';
    a.href = 'https://wa.me/' + WA_NUMBER + '?text=' + encodeURIComponent(txt);
    a.innerHTML = '<svg viewBox="0 0 32 32" width="20" height="20" aria-hidden="true"><path fill="currentColor" d="M16 3C9 3 3.3 8.7 3.3 15.7c0 2.2.6 4.4 1.7 6.3L3.2 28.8l7-1.8a12.8 12.8 0 0 0 5.8 1.4c7 0 12.8-5.7 12.8-12.7S23 3 16 3zm5.9 15.4c-.3-.2-1.9-.9-2.2-1-.3-.1-.5-.2-.7.2-.2.3-.8 1-1 1.2-.2.2-.4.2-.7.1-.3-.2-1.3-.5-2.6-1.6-1-.8-1.6-1.9-1.8-2.2-.2-.3 0-.5.1-.6l.5-.6c.2-.2.2-.3.3-.5.1-.2 0-.4 0-.6l-1-2.3c-.3-.6-.5-.5-.7-.5h-.6c-.2 0-.6.1-.8.4-.3.3-1.1 1.1-1.1 2.6s1.1 3 1.3 3.3c.2.2 2.2 3.4 5.4 4.7 2.6 1 3.2.8 3.8.8.6-.1 1.9-.8 2.1-1.5.3-.7.3-1.4.2-1.5-.1-.1-.3-.2-.6-.4z"/></svg><span>' + esc(tr('ch_send')) + '</span>';
    a.addEventListener('click', function () { if (window.gtag) gtag('event', 'whatsapp_lead', { plan: _ch.plan || 'none' }); });
    box.appendChild(a);
    setTimeout(function () { a.focus(); }, 30);
  });
}

// Email the answers to the team. Previews never email; refka.tech does.
function saveLead() {
  if (g('suWebsite') && g('suWebsite').value) return;               // bot filled the hidden field
  if (_ch.sent || Date.now() - _ch.last < 10000) return;
  _ch.sent = true; _ch.last = Date.now();
  var a = _ch.a, cName = _country;
  try { cName = new Intl.DisplayNames(['en'], { type: 'region' }).of(_country); } catch (e) {}
  var payload = {
    _subject: 'Refka lead: ' + a.gym + ', ' + a.city + ' (' + _country + ')',
    _template: 'table', _captcha: 'false',
    'Type': _ch.mode === 'contact' ? 'Enterprise / contact' : 'Founding gym',
    'Plan': _ch.plan ? PLAN_NAMES[_ch.plan] : 'Not chosen',
    'Name': a.name, 'Gym': a.gym, 'City': a.city, 'Country (detected)': cName + ' (' + _country + ')',
    'Active members': a.members, 'First thing to fix': a.need_t + ' (' + a.need + ')',
    'WhatsApp': a.phone, 'Referred by': a.ref || '-',
    'Language': _lang, 'Prices shown in': _cur + ', ' + (_billing === 'm' ? 'monthly' : 'annual'),
    'Submitted (UTC)': new Date().toISOString().replace('T', ' ').slice(0, 16)
  };
  if (window.gtag) gtag('event', 'generate_lead', { plan: _ch.plan || 'none', type: _ch.mode, country: _country, language: _lang });
  var ok = function () { say(esc(tr('ch_saved')), null, 'note'); };
  if (!LIVE_HOST.test(location.hostname)) { if (window.console) console.info('[Refka lead] preview mode, not sent:', payload); setTimeout(ok, 1600); return; }
  fetch(LEADS_ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' }, body: JSON.stringify(payload) })
    .then(function (r) { return r.json(); })
    .then(function (res) { if (res && (res.success === true || res.success === 'true')) setTimeout(ok, 900); else _ch.sent = false; })
    .catch(function () { _ch.sent = false; });
}

function openSignup(mode, plan) {
  _ch.mode = mode; _ch.plan = plan || null; _ch.step = 0; _ch.a = {}; _ch.sent = false;
  g('chatLog').innerHTML = ''; g('chatFields').innerHTML = ''; g('chatErr').textContent = '';
  openModal('signupModal');
  var hi = mode === 'contact' ? tr('ch_hi_contact') : (_ch.plan ? fill(tr('ch_hi_plan')) : tr('ch_hi'));
  say(esc(hi), askStep);
}

// Refer a gym, before launch: share Refka on WhatsApp (or the phone's share sheet).
function shareRefka() {
  var url = 'https://refka.tech/', text = tr('ch_share');
  if (navigator.share) { navigator.share({ title: 'Refka', text: text, url: url }).catch(function () {}); return; }
  openOut('https://wa.me/?text=' + encodeURIComponent(text + ' ' + url));
}

(function initChat() {
  var f = g('chatForm'); if (f) f.addEventListener('submit', onSubmit);
  var _orig = applyLang;
  applyLang = function (code) {
    _orig(code);
    document.querySelectorAll('[data-i18n-aria]').forEach(function (el) { el.setAttribute('aria-label', tr(el.getAttribute('data-i18n-aria'))); });
    var lx = g('langClose'); if (lx) lx.setAttribute('aria-label', tr('fm_close'));
  };
})();
