/* ==========================================================================
   ANIMATIONS — Thin Orchestrator
   Delegates to motion-system.js for all GSAP-powered animations.
   Maintains backward-compatible exports for main.js.
   ========================================================================== */

import { initMotionSystem, prefersReducedMotion } from './motion-system.js';

/**
 * Initialize all animations.
 * This replaces the old initReveal + initHeroAnimation pattern
 * with a single call to the GSAP-powered motion system.
 */
export async function initAnimations() {
  await initMotionSystem();
}

/**
 * Initialize back-to-top button visibility.
 * Kept separate from the motion system because it's a UI utility, not an animation.
 */
export function initBackToTop() {
  const btn = document.getElementById('back-to-top');
  if (!btn) return;

  // Use GSAP ScrollTrigger if available, otherwise fallback to IntersectionObserver
  if (!prefersReducedMotion() && typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined') {
    // Wait a tick for GSAP to be fully ready
    requestAnimationFrame(() => {
      if (typeof ScrollTrigger !== 'undefined') {
        ScrollTrigger.create({
          trigger: '.hero',
          start: 'bottom top',
          onEnter: () => btn.classList.add('back-to-top--visible'),
          onEnterBack: () => btn.classList.remove('back-to-top--visible'),
        });
      } else {
        fallbackBackToTop(btn);
      }
    });
  } else {
    fallbackBackToTop(btn);
  }

  btn.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}

/**
 * Fallback back-to-top using IntersectionObserver.
 */
function fallbackBackToTop(btn) {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        btn.classList.toggle('back-to-top--visible', !entry.isIntersecting);
      });
    },
    { threshold: 0 }
  );

  const hero = document.querySelector('.hero');
  if (hero) {
    observer.observe(hero);
  }
}
