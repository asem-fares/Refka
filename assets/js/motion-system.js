/* ==========================================================================
   MOTION SYSTEM — Reusable Animation Engine
   GSAP-powered animation utilities for the Refka Motion Design System.
   Every animation is organized by category with consistent API.
   ========================================================================== */

/**
 * Check if user prefers reduced motion.
 * @returns {boolean}
 */
export function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Wait for GSAP and plugins to be available (loaded via CDN defer).
 * @returns {Promise<void>}
 */
function waitForGSAP() {
  return new Promise((resolve) => {
    if (typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined') {
      resolve();
      return;
    }
    // Poll briefly for CDN scripts
    let attempts = 0;
    const check = setInterval(() => {
      attempts++;
      if (typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined') {
        clearInterval(check);
        resolve();
      } else if (attempts > 100) {
        clearInterval(check);
        console.warn('[MotionSystem] GSAP not loaded — falling back to CSS-only animations.');
        resolve();
      }
    }, 50);
  });
}

/**
 * Initialize the complete motion system.
 * This is the single entry point called from main.js.
 */
export async function initMotionSystem() {
  if (prefersReducedMotion()) {
    // Make everything visible immediately
    showAllElements();
    return;
  }

  await waitForGSAP();

  if (typeof gsap === 'undefined') {
    // Fallback: just show everything
    showAllElements();
    return;
  }

  // Register GSAP plugins
  gsap.registerPlugin(ScrollTrigger);

  // Set GSAP defaults
  gsap.defaults({
    ease: 'power4.out',
    duration: 0.8,
  });

  // Initialize all animation categories
  createHeroTimeline();
  createScrollReveals();
  createCounterAnimations();
  createNavAnimations();
  createBackgroundMotion();
  createHeroParallax();
  createFormAnimations();

  // Refresh ScrollTrigger after all animations are set
  ScrollTrigger.refresh();
}

/**
 * Fallback: make all elements visible when animations are disabled.
 */
function showAllElements() {
  const selectors = [
    '.reveal', '.anim-reveal', '.anim-fade-up', '.anim-fade-left',
    '.anim-fade-right', '.anim-scale-in', '.anim-clip-up',
    '.hero__title .word', '.hero__lede', '.hero__ctas', '.hero__ctas .btn',
    '.hero__note', '.hero__stage', '.hero__orb',
    '.thesis__cards .card', '.eco-grid .eco', '.vision__horizon .horizon-card',
    '.funnel__row .funnel__node', '.funnel__row > div:last-child',
    '.steps .step', '.cta-card', '.pilot', '.info-note',
    '.scroll-indicator'
  ];

  selectors.forEach(sel => {
    document.querySelectorAll(sel).forEach(el => {
      el.style.opacity = '1';
      el.style.transform = 'none';
      el.style.clipPath = 'none';
    });
  });
}


/* ==========================================================================
   1. HERO TIMELINE
   Orchestrated entrance sequence on page load.
   ========================================================================== */

function createHeroTimeline() {
  const heroTitle = document.querySelector('.hero__title');
  const heroEyebrow = document.querySelector('.hero .eyebrow');
  const heroLede = document.querySelector('.hero__lede');
  const heroCtas = document.querySelector('.hero__ctas');
  const heroNote = document.querySelector('.hero__note');
  const heroStage = document.querySelector('.hero__stage');
  const heroOrbs = document.querySelectorAll('.hero__orb');
  const scrollIndicator = document.getElementById('scroll-indicator');
  const heroButtons = document.querySelectorAll('.hero__ctas .btn');

  const tl = gsap.timeline({
    defaults: { ease: 'power4.out' }
  });

  // 0. Fade in ambient orbs
  if (heroOrbs.length) {
    tl.to(heroOrbs, {
      opacity: 1,
      duration: 2,
      stagger: 0.3,
      ease: 'power2.out'
    }, 0);
  }

  // 1. Eyebrow line draw + text fade
  if (heroEyebrow) {
    tl.fromTo(heroEyebrow, {
      opacity: 0,
      y: 10
    }, {
      opacity: 1,
      y: 0,
      duration: 0.5
    }, 0.1);

    // Animate the ::before line via class
    tl.add(() => {
      heroEyebrow.classList.add('anim-active');
    }, 0.3);
  }

  // 2. Title word-by-word reveal
  if (heroTitle) {
    // Use SplitType if available, otherwise fallback
    if (typeof SplitType !== 'undefined') {
      const split = new SplitType(heroTitle, { types: 'words' });
      const words = split.words;

      if (words && words.length) {
        // Set initial state
        gsap.set(words, {
          opacity: 0,
          y: 40,
          rotateX: 15,
          transformOrigin: 'left bottom'
        });

        tl.to(words, {
          opacity: 1,
          y: 0,
          rotateX: 0,
          duration: 0.8,
          stagger: 0.06,
          ease: 'power4.out'
        }, 0.25);
      }
    } else {
      // Fallback: animate entire title
      gsap.set(heroTitle, { opacity: 0, y: 30 });
      tl.to(heroTitle, {
        opacity: 1,
        y: 0,
        duration: 0.8
      }, 0.3);
    }
  }

  // 3. Lede paragraph fade up
  if (heroLede) {
    tl.to(heroLede, {
      opacity: 1,
      y: 0,
      duration: 0.7,
      ease: 'power3.out'
    }, 0.7);
  }

  // 4. CTA buttons — staggered scale in
  if (heroCtas) {
    tl.to(heroCtas, {
      opacity: 1,
      y: 0,
      duration: 0.5
    }, 0.9);
  }

  if (heroButtons.length) {
    tl.to(heroButtons, {
      opacity: 1,
      scale: 1,
      y: 0,
      duration: 0.5,
      stagger: 0.12,
      ease: 'back.out(1.4)'
    }, 1.0);
  }

  // 5. Note fade in
  if (heroNote) {
    tl.to(heroNote, {
      opacity: 1,
      y: 0,
      duration: 0.5
    }, 1.2);
  }

  // 6. Hero stage — float in and trigger SVG animation
  if (heroStage) {
    tl.to(heroStage, {
      opacity: 1,
      y: 0,
      scale: 1,
      duration: 0.9,
      ease: 'power3.out',
      onComplete: () => {
        heroStage.classList.add('in-view');
      }
    }, 0.5);
  }

  // 7. Scroll indicator — fade in late
  if (scrollIndicator) {
    tl.to(scrollIndicator, {
      opacity: 1,
      duration: 0.6,
      ease: 'power2.out'
    }, 2.0);

    // Hide on scroll
    ScrollTrigger.create({
      trigger: '.hero',
      start: 'top top',
      end: 'bottom 80%',
      onLeave: () => gsap.to(scrollIndicator, { opacity: 0, duration: 0.3 }),
      onEnterBack: () => gsap.to(scrollIndicator, { opacity: 1, duration: 0.3 })
    });

    // Click to scroll
    scrollIndicator.addEventListener('click', () => {
      const story = document.getElementById('story');
      if (story) story.scrollIntoView({ behavior: 'smooth' });
    });
  }
}


/* ==========================================================================
   2. SCROLL REVEALS — Section-Specific Animations
   Each section gets a unique motion signature.
   ========================================================================== */

function createScrollReveals() {
  // ---- Story Section ----
  animateOnScroll('.story__body', {
    y: 28,
    duration: 0.7,
    once: true
  });

  // Story stat — scale in
  const storyStat = document.querySelector('.story__stat');
  if (storyStat) {
    gsap.fromTo(storyStat, {
      scale: 0.7,
      opacity: 0
    }, {
      scale: 1,
      opacity: 1,
      duration: 1,
      ease: 'power4.out',
      scrollTrigger: {
        trigger: storyStat,
        start: 'top 85%',
        once: true
      }
    });
  }

  // Name definition
  animateOnScroll('.name-def', { y: 20, duration: 0.6, once: true });

  // ---- Thesis Section ----
  animateOnScroll('#thesis .eyebrow', { y: 16, duration: 0.5, once: true });
  animateOnScroll('.thesis__title', { y: 24, duration: 0.7, once: true, delay: 0.1 });
  animateOnScroll('.thesis__subtitle', { y: 20, duration: 0.6, once: true, delay: 0.15 });

  // Thesis cards — cascade
  animateStagger('.thesis__cards .card', {
    y: 30,
    stagger: 0.12,
    duration: 0.6,
    ease: 'power3.out'
  });

  // ---- How It Works ----
  animateOnScroll('#how .eyebrow', { y: 16, duration: 0.5, once: true });
  animateOnScroll('.how__title', { y: 24, duration: 0.7, once: true, delay: 0.1 });
  animateOnScroll('.how__subtitle', { y: 20, duration: 0.6, once: true, delay: 0.15 });

  // Steps — stagger from left
  animateStagger('.steps .step', {
    x: -30,
    y: 0,
    stagger: 0.15,
    duration: 0.6,
    ease: 'power3.out',
    trigger: '.steps'
  });

  // Info notes
  document.querySelectorAll('.info-note').forEach(note => {
    gsap.fromTo(note, {
      opacity: 0,
      y: 16
    }, {
      opacity: 1,
      y: 0,
      duration: 0.6,
      ease: 'power3.out',
      scrollTrigger: {
        trigger: note,
        start: 'top 88%',
        once: true
      }
    });
  });

  // ---- Ecosystem ----
  animateOnScroll('#ecosystem .eyebrow', { y: 16, duration: 0.5, once: true });
  animateOnScroll('.eco__title-section', { y: 24, duration: 0.7, once: true, delay: 0.1 });
  animateOnScroll('.eco__subtitle', { y: 20, duration: 0.6, once: true, delay: 0.15 });

  // Ecosystem cards — stagger
  animateStagger('.eco-grid .eco', {
    y: 30,
    stagger: 0.1,
    duration: 0.5,
    ease: 'power3.out'
  });

  // ---- Proof Funnel ----
  animateOnScroll('.funnel-head', { y: 24, duration: 0.7, once: true });
  createFunnelAnimation();

  animateOnScroll('.funnel__footer', { y: 16, duration: 0.5, once: true });

  // ---- Pilot ----
  const pilot = document.querySelector('.pilot');
  if (pilot) {
    gsap.fromTo(pilot, {
      opacity: 0,
      scale: 0.96
    }, {
      opacity: 1,
      scale: 1,
      duration: 0.8,
      ease: 'power3.out',
      scrollTrigger: {
        trigger: pilot,
        start: 'top 85%',
        once: true
      }
    });
  }

  // ---- Vision ----
  animateOnScroll('#vision .eyebrow', { y: 16, duration: 0.5, once: true });
  animateOnScroll('.vision__title', { y: 24, duration: 0.7, once: true, delay: 0.1 });
  animateOnScroll('.vision__subtitle', { y: 20, duration: 0.6, once: true, delay: 0.15 });

  // Vision horizon cards — sequential
  animateStagger('.vision__horizon .horizon-card', {
    y: 30,
    stagger: 0.15,
    duration: 0.6,
    ease: 'power3.out'
  });

  // ---- Dual CTA ----
  const ctaCards = document.querySelectorAll('.cta-card');
  if (ctaCards.length) {
    gsap.fromTo(ctaCards, {
      opacity: 0,
      y: 30
    }, {
      opacity: 1,
      y: 0,
      duration: 0.7,
      stagger: 0.2,
      ease: 'power3.out',
      scrollTrigger: {
        trigger: '.cta-grid',
        start: 'top 85%',
        once: true
      }
    });
  }

  // ---- Contact ----
  const contactGrid = document.querySelector('.contact__grid');
  if (contactGrid) {
    const contactInfo = contactGrid.querySelector(':scope > div:first-child');
    const contactForm = contactGrid.querySelector('.form');

    if (contactInfo) {
      gsap.fromTo(contactInfo, {
        opacity: 0,
        x: -30
      }, {
        opacity: 1,
        x: 0,
        duration: 0.7,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: contactGrid,
          start: 'top 85%',
          once: true
        }
      });
    }

    if (contactForm) {
      gsap.fromTo(contactForm, {
        opacity: 0,
        x: 30
      }, {
        opacity: 1,
        x: 0,
        duration: 0.7,
        delay: 0.1,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: contactGrid,
          start: 'top 85%',
          once: true
        }
      });
    }
  }

  // ---- Eyebrow line draw animations ----
  document.querySelectorAll('section .eyebrow').forEach(eyebrow => {
    ScrollTrigger.create({
      trigger: eyebrow,
      start: 'top 88%',
      once: true,
      onEnter: () => eyebrow.classList.add('anim-drawn')
    });
  });

  // ---- Pull quote border draw ----
  document.querySelectorAll('.pull').forEach(pull => {
    ScrollTrigger.create({
      trigger: pull,
      start: 'top 88%',
      once: true,
      onEnter: () => pull.classList.add('anim-drawn')
    });
  });
}


/* ==========================================================================
   3. FUNNEL ANIMATION — Progressive Node Reveal
   ========================================================================== */

function createFunnelAnimation() {
  const funnelRows = document.querySelectorAll('.funnel__row');
  if (!funnelRows.length) return;

  funnelRows.forEach((row, index) => {
    const node = row.querySelector('.funnel__node');
    const content = row.querySelector(':scope > div:last-child');

    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: row,
        start: 'top 85%',
        once: true
      }
    });

    // Node scales in
    if (node) {
      tl.fromTo(node, {
        scale: 0.5,
        opacity: 0
      }, {
        scale: 1,
        opacity: 1,
        duration: 0.5,
        ease: 'back.out(1.7)'
      });
    }

    // Connecting line draws
    tl.add(() => row.classList.add('anim-active'), 0.2);

    // Content slides in
    if (content) {
      tl.fromTo(content, {
        x: -20,
        opacity: 0
      }, {
        x: 0,
        opacity: 1,
        duration: 0.6,
        ease: 'power3.out'
      }, 0.15);
    }
  });
}


/* ==========================================================================
   4. COUNTER ANIMATIONS — Animated Number Values
   ========================================================================== */

function createCounterAnimations() {
  // Pilot stats
  const statValues = document.querySelectorAll('.pilot__stat-value');
  statValues.forEach(el => {
    const target = parseInt(el.textContent, 10);
    if (isNaN(target)) return;

    // Store original text and set to 0
    el.textContent = '0';

    ScrollTrigger.create({
      trigger: el,
      start: 'top 88%',
      once: true,
      onEnter: () => {
        const obj = { val: 0 };
        gsap.to(obj, {
          val: target,
          duration: 1.5,
          ease: 'power2.out',
          onUpdate: () => {
            el.textContent = Math.round(obj.val);
          }
        });
      }
    });
  });

  // Story stat (180kg)
  const storyStat = document.querySelector('.story__stat');
  if (storyStat) {
    const text = storyStat.childNodes[0]; // Text node "180"
    if (text && text.nodeType === 3) {
      const target = parseInt(text.textContent, 10);
      if (!isNaN(target)) {
        text.textContent = '0';

        ScrollTrigger.create({
          trigger: storyStat,
          start: 'top 88%',
          once: true,
          onEnter: () => {
            const obj = { val: 0 };
            gsap.to(obj, {
              val: target,
              duration: 2,
              ease: 'power2.out',
              onUpdate: () => {
                text.textContent = Math.round(obj.val);
              }
            });
          }
        });
      }
    }
  }
}


/* ==========================================================================
   5. NAV ANIMATIONS — Shrink, Progress Bar
   ========================================================================== */

function createNavAnimations() {
  const nav = document.querySelector('.nav');
  const progressBar = document.getElementById('nav-progress');

  if (!nav) return;

  // Nav shrink on scroll
  ScrollTrigger.create({
    trigger: document.body,
    start: 'top -80px',
    onEnter: () => nav.classList.add('nav--scrolled'),
    onLeaveBack: () => nav.classList.remove('nav--scrolled')
  });

  // Scroll progress bar
  if (progressBar) {
    gsap.to(progressBar, {
      width: '100%',
      ease: 'none',
      scrollTrigger: {
        trigger: document.body,
        start: 'top top',
        end: 'bottom bottom',
        scrub: 0.3
      }
    });
  }
}


/* ==========================================================================
   6. BACKGROUND MOTION — Hero Gradient & Orbs
   ========================================================================== */

function createBackgroundMotion() {
  // Orbs are animated via CSS @keyframes (more performant than GSAP for infinite loops)
  // GSAP just handles the initial fade-in, which is done in the hero timeline
}


/* ==========================================================================
   7. HERO PARALLAX — Mouse-tracking tilt on stage
   ========================================================================== */

function createHeroParallax() {
  const stage = document.querySelector('.hero__stage');
  const hero = document.querySelector('.hero');
  if (!stage || !hero) return;

  // Only enable on desktop (non-touch devices with sufficient screen width)
  if (window.innerWidth < 880 || 'ontouchstart' in window) return;

  const maxTilt = 3; // degrees — subtle, never distracting

  hero.addEventListener('mousemove', (e) => {
    const rect = hero.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;  // -0.5 to 0.5
    const y = (e.clientY - rect.top) / rect.height - 0.5;

    gsap.to(stage, {
      rotateY: x * maxTilt * 2,
      rotateX: -y * maxTilt * 2,
      transformPerspective: 800,
      duration: 0.6,
      ease: 'power2.out'
    });
  });

  hero.addEventListener('mouseleave', () => {
    gsap.to(stage, {
      rotateY: 0,
      rotateX: 0,
      duration: 0.8,
      ease: 'power3.out'
    });
  });
}


/* ==========================================================================
   8. FORM ANIMATIONS — Focus Glow, Validation, Success
   ========================================================================== */

function createFormAnimations() {
  const form = document.getElementById('contact-form');
  if (!form) return;

  // Animate validation errors with shake
  const originalValidationHandler = form.querySelector('.form__submit');
  if (originalValidationHandler) {
    // Observe error classes being added to inputs
    const inputs = form.querySelectorAll('.form__input, .form__textarea');
    inputs.forEach(input => {
      // Watch for error class
      const observer = new MutationObserver((mutations) => {
        mutations.forEach(mutation => {
          if (mutation.attributeName === 'class') {
            const hasError = input.classList.contains('form__input--error') ||
                             input.classList.contains('form__textarea--error');
            if (hasError) {
              input.classList.add('form__input--shake', 'form__textarea--shake');
              setTimeout(() => {
                input.classList.remove('form__input--shake', 'form__textarea--shake');
              }, 400);
            }
          }
        });
      });
      observer.observe(input, { attributes: true, attributeFilter: ['class'] });
    });
  }
}


/* ==========================================================================
   UTILITY: Reusable Animation Helpers
   ========================================================================== */

/**
 * Animate an element on scroll (fade up by default).
 * @param {string} selector - CSS selector
 * @param {Object} options - Animation options
 */
function animateOnScroll(selector, options = {}) {
  const elements = document.querySelectorAll(selector);
  if (!elements.length) return;

  elements.forEach(el => {
    gsap.fromTo(el, {
      opacity: 0,
      y: options.y ?? 24,
      x: options.x ?? 0,
      scale: options.scale ?? 1
    }, {
      opacity: 1,
      y: 0,
      x: 0,
      scale: 1,
      duration: options.duration ?? 0.7,
      delay: options.delay ?? 0,
      ease: options.ease ?? 'power3.out',
      scrollTrigger: {
        trigger: el,
        start: options.start ?? 'top 88%',
        once: options.once ?? true
      }
    });
  });
}

/**
 * Animate a group of elements with stagger.
 * @param {string} selector - CSS selector for the group
 * @param {Object} options - Animation options
 */
function animateStagger(selector, options = {}) {
  const elements = document.querySelectorAll(selector);
  if (!elements.length) return;

  const triggerEl = options.trigger
    ? document.querySelector(options.trigger)
    : elements[0]?.parentElement || elements[0];

  gsap.fromTo(elements, {
    opacity: 0,
    y: options.y ?? 24,
    x: options.x ?? 0
  }, {
    opacity: 1,
    y: 0,
    x: 0,
    duration: options.duration ?? 0.6,
    stagger: options.stagger ?? 0.1,
    ease: options.ease ?? 'power3.out',
    scrollTrigger: {
      trigger: triggerEl,
      start: options.start ?? 'top 85%',
      once: true
    }
  });
}


/* ==========================================================================
   PUBLIC API — For use by other modules
   ========================================================================== */

/**
 * Animate a submit button to show success state.
 * @param {HTMLElement} btn - The button element
 */
export function animateButtonSuccess(btn) {
  if (!btn || prefersReducedMotion()) return;
  if (typeof gsap === 'undefined') return;

  btn.classList.add('form__submit--success');
  const originalText = btn.textContent;
  btn.textContent = '✓ Sent!';

  gsap.fromTo(btn, {
    scale: 0.95
  }, {
    scale: 1,
    duration: 0.4,
    ease: 'back.out(1.7)'
  });

  // Reset after 2.5 seconds
  setTimeout(() => {
    btn.classList.remove('form__submit--success');
    btn.textContent = originalText;
    gsap.to(btn, {
      scale: 1,
      duration: 0.3
    });
  }, 2500);
}

/**
 * Animate a submit button to show error state.
 * @param {HTMLElement} btn - The button element
 */
export function animateButtonError(btn) {
  if (!btn || prefersReducedMotion()) return;
  if (typeof gsap === 'undefined') return;

  gsap.to(btn, {
    x: [-4, 4, -3, 3, 0],
    duration: 0.4,
    ease: 'power2.out'
  });
}
