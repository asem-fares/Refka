/* ==========================================================================
   NAVBAR — Mobile Navigation Toggle & Active Section Tracking
   ========================================================================== */

import { throttle } from './utils.js';
import { prefersReducedMotion } from './motion-system.js';

/**
 * Query focusable elements inside a container.
 * @param {HTMLElement} container
 * @returns {HTMLElement[]}
 */
function getFocusable(container) {
  if (!container) return [];
  return Array.from(
    container.querySelectorAll('a[href], button:not([disabled]), input, [tabindex]:not([tabindex="-1"])')
  );
}

/**
 * Initialize the mobile navigation hamburger menu.
 * Manages open/close state, focus move + trap, and body scroll locking.
 */
export function initNavbar() {
  const toggle = document.getElementById('nav-toggle');
  const links = document.getElementById('nav-links');
  const overlay = document.getElementById('nav-overlay');

  if (!toggle || !links) return;

  /**
   * Lock body scroll while compensating for the disappearing scrollbar so the
   * page content doesn't shift horizontally when the menu opens.
   */
  function lockScroll() {
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = scrollbarWidth + 'px';
    }
    document.body.style.overflow = 'hidden';
  }

  /**
   * Restore body scroll and clear the scrollbar compensation.
   */
  function unlockScroll() {
    document.body.style.overflow = '';
    document.body.style.paddingRight = '';
  }

  function openMenu() {
    toggle.setAttribute('aria-expanded', 'true');
    links.classList.add('nav__links--open');
    if (overlay) overlay.classList.add('nav__mobile-overlay--visible');
    lockScroll();

    // Staggered link animation
    if (!prefersReducedMotion() && typeof gsap !== 'undefined') {
      const navItems = links.querySelectorAll('.nav__link, .btn');
      gsap.fromTo(navItems, {
        opacity: 0,
        x: 20
      }, {
        opacity: 1,
        x: 0,
        duration: 0.4,
        stagger: 0.05,
        ease: 'power3.out',
        overwrite: true
      });
    }

    // Move focus into the menu for keyboard / screen-reader users
    const focusables = getFocusable(links);
    if (focusables.length) {
      requestAnimationFrame(() => focusables[0].focus());
    }
  }

  function closeMenu(returnFocus = true) {
    toggle.setAttribute('aria-expanded', 'false');
    links.classList.remove('nav__links--open');
    if (overlay) overlay.classList.remove('nav__mobile-overlay--visible');
    unlockScroll();
    if (returnFocus) toggle.focus();
  }

  toggle.addEventListener('click', () => {
    const isOpen = toggle.getAttribute('aria-expanded') === 'true';
    isOpen ? closeMenu(false) : openMenu();
  });

  // Close on overlay click
  if (overlay) {
    overlay.addEventListener('click', closeMenu);
  }

  // Close on nav link click (mobile) — user navigated, no need to refocus toggle
  links.querySelectorAll('.nav__link').forEach(link => {
    link.addEventListener('click', () => closeMenu(false));
  });

  // Keyboard: Escape closes; Tab wraps within the open menu (focus trap)
  document.addEventListener('keydown', (e) => {
    const isOpen = toggle.getAttribute('aria-expanded') === 'true';
    if (!isOpen) return;

    if (e.key === 'Escape') {
      e.stopPropagation();
      closeMenu(true);
      return;
    }

    if (e.key === 'Tab') {
      const focusables = getFocusable(links);
      if (!focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;

      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    }
  });

  // Close menu if resized past mobile breakpoint
  window.addEventListener('resize', throttle(() => {
    if (window.innerWidth > 720 && toggle.getAttribute('aria-expanded') === 'true') {
      closeMenu(false);
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
            const isActive = link.getAttribute('href') === `#${id}`;
            link.classList.toggle('nav__link--active', isActive);
            if (isActive) {
              link.setAttribute('aria-current', 'true');
            } else {
              link.removeAttribute('aria-current');
            }
          });
        }
      });
    },
    { rootMargin: '-20% 0px -60% 0px' }
  );

  sections.forEach((section) => observer.observe(section));
}
