/* Refka website: motion layer. Loaded last (defer). Everything here is decoration on top of a page that
   already works: with reduced motion, no IntersectionObserver or any error, the page shows its final state.
   1. Big numbers count up when they come into view (35%, the payback "1").
   2. The three steps draw one line across them, as one journey.
   3. Switching monthly / annual rolls each price to its new value and draws the strike-through. */
(function () {
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var ease = function (p) { return p === 1 ? 1 : 1 - Math.pow(2, -10 * p); };   // ease-out expo
  var NUM = /(\d[\d,]*(?:\.\d+)?)/;
  function parse(s) { var m = String(s).match(NUM); return m ? parseFloat(m[1].replace(/,/g, '')) : null; }
  function group(v, decimals) { return v.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }); }

  // Animate the first number inside an element's text, keeping the words around it.
  function roll(el, from, to, ms, done) {
    var text = el.textContent, m = text.match(NUM);
    if (!m || reduced) { if (done) done(); return; }
    var dec = (m[1].split('.')[1] || '').length, pre = text.slice(0, m.index), post = text.slice(m.index + m[1].length);
    var t0 = null;
    requestAnimationFrame(function f(now) {
      if (t0 === null) t0 = now;
      var p = Math.min(1, (now - t0) / ms), v = from + (to - from) * ease(p);
      el.textContent = pre + group(p < 1 ? (dec ? v : Math.round(v)) : to, dec) + post;
      if (p < 1) requestAnimationFrame(f); else if (done) done();
    });
  }

  function onView(els, fn, threshold) {
    if (!('IntersectionObserver' in window)) { els.forEach(fn); return; }
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { io.unobserve(e.target); fn(e.target); } });
    }, { threshold: threshold || .5 });
    els.forEach(function (el) { io.observe(el); });
  }

  // 1. Count-ups
  onView([].slice.call(document.querySelectorAll('[data-count]')), function (el) {
    var to = parse(el.textContent); if (to === null) return;
    el.classList.add('counting');
    roll(el, 0, to, to > 9 ? 1600 : 900, function () { el.classList.remove('counting'); el.classList.add('counted'); });
  }, .6);

  // 2. The three steps as one journey
  onView([].slice.call(document.querySelectorAll('[data-journey]')), function (el) { el.classList.add('go'); }, .3);

  // 3. Monthly / annual: prices roll to their new value, the old monthly price is struck through with a drawn line
  if (typeof window.setBilling === 'function') {
    var orig = window.setBilling;
    window.setBilling = function (b) {
      var prices = [].slice.call(document.querySelectorAll('.pv')), before = prices.map(function (el) { return parse(el.textContent); });
      orig(b);
      prices.forEach(function (el, i) {
        var to = parse(el.textContent);
        if (before[i] !== null && to !== null && before[i] !== to) roll(el, before[i], to, 650);
      });
      document.querySelectorAll('s.was').forEach(function (s) {
        s.classList.remove('drawn');
        if (b === 'a') { if (reduced) s.classList.add('drawn'); else requestAnimationFrame(function () { requestAnimationFrame(function () { s.classList.add('drawn'); }); }); }
      });
    };
  }
})();
