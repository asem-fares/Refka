/* ==========================================================================
   ANIMATIONS — Backward-Compatibility Shim
   ==========================================================================
   Why this exists:
   Commit 0bebeb7 (production-readiness hardening) consolidated this file's
   logic into motion-system.js and rewrote main.js to import it directly.
   However the JS is shipped under STABLE, un-fingerprinted filenames and
   /_headers marks /assets/js/* as `Cache-Control: public, max-age=31536000,
   immutable`. Returning visitors therefore keep using their CACHED copy of
   the previous main.js, which still does:

       import { initAnimations, initBackToTop } from './animations.js';

   Once animations.js disappeared, that import 404'd. ES modules fail
   atomically, so the whole entry graph never executed — init() never ran,
   GSAP never revealed the section cards, and they stayed at their CSS
   opacity:0 initial state (while titles/descriptions, which have no such
   hide rule, kept rendering). Result: every card on the homepage vanished.

   This shim restores the deleted module so cached entry points resolve
   again. New entry points import motion-system.js directly and are
   unaffected. It is a pure re-export (single source of truth, no
   duplication). Safe to remove once the immutable JS cache is rotated
   (e.g. content-hashed filenames) so no client holds the old main.js.
   ========================================================================== */

export { initMotionSystem as initAnimations, initBackToTop } from './motion-system.js';
