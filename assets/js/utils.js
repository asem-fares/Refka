/* ==========================================================================
   UTILS — Shared Helper Functions
   ========================================================================== */

/**
 * Debounce a function — delays execution until after `wait` ms of inactivity.
 * @param {Function} fn - The function to debounce
 * @param {number} wait - Milliseconds to wait
 * @returns {Function}
 */
export function debounce(fn, wait = 100) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), wait);
  };
}

/**
 * Throttle a function — ensures it runs at most once every `limit` ms.
 * @param {Function} fn - The function to throttle
 * @param {number} limit - Milliseconds between calls
 * @returns {Function}
 */
export function throttle(fn, limit = 100) {
  let inThrottle = false;
  return function (...args) {
    if (!inThrottle) {
      fn.apply(this, args);
      inThrottle = true;
      setTimeout(() => { inThrottle = false; }, limit);
    }
  };
}

/**
 * Sanitize a string to prevent XSS in displayed content.
 * @param {string} str - Raw string
 * @returns {string} Escaped string
 */
export function sanitize(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/**
 * Get the current year for copyright notices.
 * @returns {number}
 */
export function getCurrentYear() {
  return new Date().getFullYear();
}
