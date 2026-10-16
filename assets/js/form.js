/* Refka website: click dispatcher, modal focus handling, signup/contact form. Classic scripts, loaded with defer in this order:
   i18n.js -> app.js -> form.js. No build step. */
// ═══════════════════════════════════════════════════════════════
// CLICK DISPATCHER
// The Content-Security-Policy forbids inline handlers (onclick="…"),
// so every clickable element declares data-click / data-click-arg instead.
// ═══════════════════════════════════════════════════════════════
var CLICK_ACTIONS = {
  goRegister: function (arg) { goRegister(arg || null); },
  goContact: function () { goContact(); },
  closeMob: function () { closeMob(); },
  closeMobRegister: function () { closeMob(); goRegister(); },
  scrollHow: function () { var h = g('how'); if (h) h.scrollIntoView({ behavior: 'smooth' }); },
  openModal: function (arg) { openModal(arg); },
  closeModal: function (arg) { closeModal(arg); },
  setBilling: function (arg) { setBilling(arg); },
  setCookieChoice: function (arg) { setCookieChoice(arg); }
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
  var first = id === 'signupModal' && !g('suFormWrap').hidden ? g('suName') : m.querySelector('.modal-close');
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

var _suMode = 'trial', _suPlan = null, _suLast = 0;
var PLAN_NAMES = { starter: 'Starter', growth: 'Growth', pro: 'Pro', enterprise: 'Enterprise' };

function tr(k) { var t = T[_lang] || T.en; return t[k] !== undefined ? t[k] : T.en[k]; }

function setI18n(el, key) { if (!el) return; el.setAttribute('data-i18n', key); el.textContent = tr(key); }

function openSignup(mode, plan) {
  _suMode = mode; _suPlan = plan || null;
  setI18n(g('suTitle'), mode === 'contact' ? 'fm_ctitle' : 'fm_title');
  setI18n(g('suSub'), mode === 'contact' ? 'fm_csub' : 'fm_sub');
  setI18n(g('suSend'), mode === 'contact' ? 'fm_csend' : 'fm_send');
  var p = g('suPlan');
  if (_suPlan && PLAN_NAMES[_suPlan]) { g('suPlanName').textContent = PLAN_NAMES[_suPlan]; p.hidden = false; }
  else p.hidden = true;
  syncFormCountries();
  g('suFormWrap').hidden = false; g('suDone').hidden = true;
  clearStatus();
  openModal('signupModal');
}

function syncFormCountries() {
  var src = g('countrySel'), dst = g('suCountry');
  if (!src || !dst) return;
  var keep = dst.value || _country;
  dst.innerHTML = '';
  Array.prototype.forEach.call(src.options, function (o) {
    var n = document.createElement('option');
    n.value = o.value; n.textContent = o.textContent.replace(/\s*\([A-Z]{3}\)$/, '');
    dst.appendChild(n);
  });
  dst.value = keep;
}

// Re-translate the form's dynamic bits whenever the language changes
function afterLang() {
  document.querySelectorAll('[data-i18n-aria]').forEach(function (el) { el.setAttribute('aria-label', tr(el.getAttribute('data-i18n-aria'))); });
  var lx = g('langClose'); if (lx) lx.setAttribute('aria-label', tr('fm_close'));
  syncFormCountries();
  document.querySelectorAll('#suForm .su-err.on').forEach(function (e) { var f = e.parentNode.querySelector('input,select,textarea'); if (f) checkField(f); });
}
var _origApplyLang = applyLang;
applyLang = function (code) { _origApplyLang(code); afterLang(); };

function checkField(f) {
  var v = (f.value || '').trim(), rules = (f.getAttribute('data-check') || '').split(','), msg = '';
  for (var i = 0; i < rules.length && !msg; i++) {
    var r = rules[i];
    if (r === 'req' && !v) msg = tr('fm_req');
    if (r === 'phone' && v) {
      var digits = v.replace(/\D/g, '');
      if (!/^\+?[\d\s\-().]+$/.test(v) || digits.length < 7 || digits.length > 15) msg = tr('fm_bad_phone');
    }
    if (r === 'email' && v && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) msg = tr('fm_bad_email');
  }
  var err = f.parentNode.querySelector('.su-err');
  f.classList.toggle('bad', !!msg);
  if (msg) f.setAttribute('aria-invalid', 'true'); else f.removeAttribute('aria-invalid');
  if (err) { err.textContent = msg; err.classList.toggle('on', !!msg); }
  return !msg;
}

function setStatus(type, text) { var s = g('suStatus'); s.className = 'su-status ' + type; s.textContent = text; }
function clearStatus() { var s = g('suStatus'); if (s) { s.className = 'su-status'; s.textContent = ''; } }

function showDone() {
  g('suFormWrap').hidden = true; g('suDone').hidden = false;
  var h = g('suDoneTitle'); if (h) setTimeout(function () { h.focus(); }, 30);
  g('suForm').reset();
}

(function initForm() {
  var form = g('suForm'); if (!form) return;
  form.querySelectorAll('[data-check]').forEach(function (f) {
    f.addEventListener('blur', function () { if (f.value) checkField(f); });
    f.addEventListener('input', function () { if (f.classList.contains('bad')) checkField(f); });
  });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    clearStatus();

    if (g('suWebsite').value) { showDone(); return; }          // bot filled the hidden field
    if (Date.now() - _suLast < 10000) { setStatus('err', tr('fm_wait')); return; }

    var ok = true, firstBad = null;
    form.querySelectorAll('[data-check]').forEach(function (f) {
      if (!checkField(f)) { ok = false; if (!firstBad) firstBad = f; }
    });
    if (!ok) { firstBad.focus(); return; }

    var val = function (id) { return (g(id).value || '').trim(); };
    var cCode = val('suCountry'), cName = cCode;
    try { cName = new Intl.DisplayNames(['en'], { type: 'region' }).of(cCode); } catch (e) {}   // inbox reads English
    var payload = {
      _subject: (_suMode === 'contact' ? 'Refka contact request: ' : 'Refka free trial request: ') + val('suGym') + ' (' + val('suCountry') + ')',
      _template: 'table',
      _captcha: 'false',
      'Request type': _suMode === 'contact' ? 'Enterprise / contact' : 'Free trial',
      'Plan': _suPlan ? PLAN_NAMES[_suPlan] : 'Not chosen',
      'Name': val('suName'),
      'Gym': val('suGym'),
      'WhatsApp': val('suPhone'),
      'Email': val('suEmail') || 'Not provided',
      'Country': cName + ' (' + val('suCountry') + ')',
      'City': val('suCity') || 'Not provided',
      'Active members': val('suMembers') || 'Not provided',
      'Message': val('suMsg') || '-',
      'Language': _lang,
      'Prices shown in': _cur + ', zone ' + _zone + ', ' + (_billing === 'm' ? 'monthly' : 'annual'),
      'Submitted (UTC)': new Date().toISOString().replace('T', ' ').slice(0, 16)
    };
    if (val('suEmail')) payload._replyto = val('suEmail');

    var btn = g('suSend'), label = btn.textContent;
    btn.disabled = true; btn.textContent = tr('fm_sending');
    var done = function () { btn.disabled = false; btn.textContent = label; };

    // Previews and local tests never email the team.
    if (!LIVE_HOST.test(location.hostname)) {
      if (window.console) console.info('[Refka form] preview mode, not sent:', payload);
      setTimeout(function () { done(); _suLast = Date.now(); showDone(); }, 500);
      return;
    }

    var ctl = window.AbortController ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctl) ctl.abort(); }, 12000);
    fetch(LEADS_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(payload),
      signal: ctl ? ctl.signal : undefined
    }).then(function (r) { return r.json(); }).then(function (res) {
      clearTimeout(timer); done();
      // FormSubmit answers success:"true". Before the inbox is activated it answers with an
      // activation notice and does NOT forward the request, so the visitor sees the email fallback.
      if (res && (res.success === true || res.success === 'true')) {
        _suLast = Date.now();
        if (window.gtag) gtag('event', 'generate_lead', { plan: _suPlan || 'unspecified', type: _suMode, country: val('suCountry'), language: _lang });
        showDone();
      } else {
        setStatus('err', tr('fm_err'));
      }
    }).catch(function () {
      clearTimeout(timer); done();
      setStatus('err', tr('fm_err'));
    });
  });

  afterLang();
})();
