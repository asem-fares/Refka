/* Refka website: boot. The one script that runs before the page is drawn (no defer), so it stays small.
   1. Picks the visitor's country and language.
   2. Sets lang and dir at once, so an Arabic page is drawn right-to-left from the first frame.
   3. Starts downloading that language's text file in parallel with the stylesheets.
   4. Marks the page with the class "js": sections then start hidden and fade in. Without JavaScript,
      or if the scripts fail to arrive within 6 seconds, the class is removed and everything shows. */
(function () {
  var LANGS = ['en', 'ar', 'de', 'sq', 'fr', 'es', 'pt', 'it', 'pl', 'tr', 'ru', 'hi', 'id', 'ms', 'tl', 'vi', 'th', 'ko', 'ja', 'zh-Hans', 'zh-Hant', 'sw'];
  var html = document.documentElement;

  // Time zone -> country: a good guess without asking the visitor or calling a server.
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

  function detectCountry() {
    try {
      var q = new URLSearchParams(location.search).get('country');
      if (q && /^[A-Za-z]{2}$/.test(q)) return q.toUpperCase();
    } catch (e) {}
    try { var s = localStorage.getItem('rfk_cc'); if (s && /^[A-Z]{2}$/.test(s)) return s; } catch (e) {}
    if (window.REFKA_GEO && window.REFKA_GEO.country) return String(window.REFKA_GEO.country).toUpperCase();
    try { var tz = Intl.DateTimeFormat().resolvedOptions().timeZone; if (TZ[tz]) return TZ[tz]; } catch (e) {}
    var langs = navigator.languages || [navigator.language || ''];
    for (var i = 0; i < langs.length; i++) { var m = /[-_]([A-Za-z]{2})$/.exec(langs[i] || ''); if (m) return m[1].toUpperCase(); }
    return 'US';
  }

  // Language: English is the front door for everyone. A link can ask for a language (?lang=ar), the Arabic
  // page at /ar/ is Arabic, and a visitor who picked one from the menu gets it again next time.
  function pickLang() {
    try { var q = new URLSearchParams(location.search).get('lang'); if (q && LANGS.indexOf(q) > -1) return q; } catch (e) {}
    if (/^\/ar(\/|$)/.test(location.pathname)) return 'ar';   // the Arabic page lives at /ar/
    try { var st = localStorage.getItem('rfk_lang'); if (st && LANGS.indexOf(st) > -1) return st; } catch (e) {}
    return 'en';
  }

  // Language files: one per language, loaded once. whenLang(code, done) calls done(code) when the
  // text is there, or done('en') if the file cannot be loaded.
  var waiting = {}, me = (document.currentScript && document.currentScript.src) || '', base = me.replace(/boot\.js.*$/, ''), ver = (me.match(/\?v=([0-9a-f]+)/) || [])[1];
  function whenLang(code, done) {
    if (window.T && window.T[code]) return done(code);
    if (waiting[code]) { waiting[code].push(done); return; }
    waiting[code] = [done];
    var s = document.createElement('script');
    s.src = base + 'i18n/' + code + '.js' + (ver ? '?v=' + ver : '');   // same version as this page's scripts
    s.async = true;
    s.onload = function () { var q = waiting[code]; waiting[code] = null; q.forEach(function (f) { f(window.T && window.T[code] ? code : 'en'); }); };
    s.onerror = function () { var q = waiting[code]; waiting[code] = null; q.forEach(function (f) { f('en'); }); };
    document.head.appendChild(s);
  }

  var country = detectCountry(), lang = pickLang();
  html.lang = lang;
  html.dir = lang === 'ar' ? 'rtl' : 'ltr';
  html.className += (html.className ? ' ' : '') + 'js';
  if (lang !== 'en') whenLang(lang, function () {});   // start the download now, in parallel with the CSS
  if (lang === 'ar') ['400', '700'].forEach(function (w) {   // the Arabic text faces, before the CSS asks for them
    var l = document.createElement('link'); l.rel = 'preload'; l.as = 'font'; l.type = 'font/woff2'; l.crossOrigin = 'anonymous';
    l.href = base.replace(/js\/$/, '') + 'fonts/ibm-plex-sans-arabic-arabic-' + w + '-normal.woff2';
    document.head.appendChild(l);
  });
  // Safety net: if the page has not finished starting after 6 s (blocked or failed script), show everything.
  setTimeout(function () { if (!/\bready\b/.test(html.className)) html.className = html.className.replace(/\bjs\b/, '').trim(); }, 6000);

  window.RFK = { TZ: TZ, country: country, lang: lang, langs: LANGS, whenLang: whenLang };
})();
