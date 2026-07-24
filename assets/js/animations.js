/* ==========================================================================
   ANIMATIONS — Scroll Reveal & Hero SVG Animation
   ========================================================================== */

/**
 * Initialize scroll-triggered reveal animations.
 * Elements with class "reveal" fade in when 15% visible.
 */
export function initReveal() {
  const revealElements = document.querySelectorAll('.reveal');
  if (!revealElements.length) return;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('in');
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15 }
  );

  revealElements.forEach((el) => observer.observe(el));
}

/**
 * Initialize the hero SVG matching animation.
 * Triggers bridge-drawing animation when the stage element enters the viewport.
 */
export function initHeroAnimation() {
  const stage = document.querySelector('.hero__stage');
  if (!stage) return;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          stage.classList.add('in-view');
          observer.disconnect();
        }
      });
    },
    { threshold: 0.3 }
  );

  observer.observe(stage);
}

/**
 * Initialize back-to-top button visibility.
 * Shows when the user scrolls past the hero section.
 */
export function initBackToTop() {
  const btn = document.getElementById('back-to-top');
  if (!btn) return;

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

  btn.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}
