/* ==========================================================================
   NAVBAR — Mobile Navigation Toggle & Active Section Tracking
   ========================================================================== */

import { throttle } from './utils.js';

/**
 * Initialize the mobile navigation hamburger menu.
 * Manages open/close state, focus trapping, and body scroll locking.
 */
export function initNavbar() {
  const toggle = document.getElementById('nav-toggle');
  const links = document.getElementById('nav-links');
  const overlay = document.getElementById('nav-overlay');

  if (!toggle || !links) return;

  function openMenu() {
    toggle.setAttribute('aria-expanded', 'true');
    links.classList.add('nav__links--open');
    if (overlay) overlay.classList.add('nav__mobile-overlay--visible');
    document.body.style.overflow = 'hidden';
  }

  function closeMenu() {
    toggle.setAttribute('aria-expanded', 'false');
    links.classList.remove('nav__links--open');
    if (overlay) overlay.classList.remove('nav__mobile-overlay--visible');
    document.body.style.overflow = '';
  }

  toggle.addEventListener('click', () => {
    const isOpen = toggle.getAttribute('aria-expanded') === 'true';
    isOpen ? closeMenu() : openMenu();
  });

  // Close on overlay click
  if (overlay) {
    overlay.addEventListener('click', closeMenu);
  }

  // Close on nav link click (mobile)
  links.querySelectorAll('.nav__link').forEach(link => {
    link.addEventListener('click', closeMenu);
  });

  // Close on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') {
      closeMenu();
      toggle.focus();
    }
  });

  // Close menu if resized past mobile breakpoint
  window.addEventListener('resize', throttle(() => {
    if (window.innerWidth > 720 && toggle.getAttribute('aria-expanded') === 'true') {
      closeMenu();
    }
  }, 200));
}

/**
 * Initialize active section highlighting in the navigation.
 * Uses IntersectionObserver to detect which section is currently visible.
 */
export function initActiveNav() {
  const sections = document.querySelectorAll('section[id]');
  const navLinks = document.querySelectorAll('.nav__link[href^="#"]');

  if (!sections.length || !navLinks.length) return;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const id = entry.target.getAttribute('id');
          navLinks.forEach((link) => {
            link.classList.toggle(
              'nav__link--active',
              link.getAttribute('href') === `#${id}`
            );
          });
        }
      });
    },
    { rootMargin: '-20% 0px -60% 0px' }
  );

  sections.forEach((section) => observer.observe(section));
}
