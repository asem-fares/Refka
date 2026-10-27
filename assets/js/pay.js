/* Refka pay page: copy buttons. No inline scripts (CSP). */
document.addEventListener('click', function (e) {
  var b = e.target.closest('[data-copy]');
  if (!b) return;
  var v = b.getAttribute('data-copy'), done = b.getAttribute('data-done') || 'Copied';
  var ok = function () { var t = b.textContent; b.textContent = done; setTimeout(function () { b.textContent = t; }, 1600); };
  if (navigator.clipboard) { navigator.clipboard.writeText(v).then(ok, function () {}); }
});
