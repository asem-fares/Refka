/* ==========================================================================
   MAIN — Application Entry Point
   Initializes all modules when the DOM is ready.
   ========================================================================== */

import { initNavbar, initActiveNav } from './navbar.js';
import { initAnimations, initBackToTop } from './animations.js';
import { initContactForm } from './contact.js';
import { getCurrentYear } from './utils.js';

/**
 * Initialize the application.
 */
async function init() {
  // Navigation
  initNavbar();
  initActiveNav();

  // Motion Design System (async — waits for GSAP CDN)
  await initAnimations();

  // Back to top (after motion system is ready)
  initBackToTop();

  // Contact form
  initContactForm();

  // Dynamic copyright year
  const yearEl = document.getElementById('current-year');
  if (yearEl) {
    yearEl.textContent = getCurrentYear();
  }
}

// Run when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
