/* ==========================================================================
   ENHANCE — Progressive-Enhancement Guard (runs before first paint)
   ==========================================================================
   Problem this solves:
   The section cards (and hero copy) start at opacity:0 in animations.css so
   GSAP can animate them in without a flash. That hiding is CSS-only — so if
   JavaScript ever fails to run cleanly in the visitor's browser (stale cached
   entry module that 404s, ES modules blocked on a file:// preview, an ad
   blocker killing the GSAP CDN, or any uncaught error), the reveal never
   happens and the cards are stranded invisible forever — while the section
   titles, which have no such hide rule, keep rendering.

   Fix: gate the hiding behind a `js` class on <html>. enhance.js is a plain
   (non-module, non-defer) classic script, so it executes during <head> parsing
   on every supported environment (including file://) before first paint. The
   matching CSS (`html:not(.js) …`) forces all entrance-hidden content visible
   by default, so "no JS" = "fully visible, just unanimated".

   Safety net: if the motion system does not signal readiness within 7s (well
   past the waitForGSAP 5s fallback), we drop the `js` class — which re-triggers
   the visible fallback and recovers the page even when the app module itself
   never loaded. motion-system.js adds `motion-ready` on every successful path.
   ========================================================================== */

document.documentElement.classList.add('js');

window.setTimeout(function () {
  if (!document.documentElement.classList.contains('motion-ready')) {
    document.documentElement.classList.remove('js');
  }
}, 7000);
