/* ==========================================================================
   MAIN — Application Entry Point
   Initializes all modules when the DOM is ready.
   ========================================================================== */

import { initNavbar, initActiveNav } from './navbar.js';
import { initReveal, initHeroAnimation, initBackToTop } from './animations.js';
import { initContactForm } from './contact.js';
import { getCurrentYear } from './utils.js';

/**
 * Initialize the application.
 */
function init() {
  // Navigation
  initNavbar();
  initActiveNav();

  // Animations
  initReveal();
  initHeroAnimation();
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
