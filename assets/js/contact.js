/* ==========================================================================
   CONTACT — Form Validation, Submission & UX States
   Uses EmailJS for sending emails from a static site.
   ========================================================================== */

import { sanitize } from './utils.js';

// ---- Configuration ----
// Replace these with your actual EmailJS credentials
const EMAILJS_PUBLIC_KEY = 'YOUR_PUBLIC_KEY';  // Get from EmailJS dashboard
const EMAILJS_SERVICE_ID = 'YOUR_SERVICE_ID';  // Your email service ID
const EMAILJS_TEMPLATE_ID = 'YOUR_TEMPLATE_ID'; // Your email template ID

// Rate limiting
let lastSubmitTime = 0;
const SUBMIT_COOLDOWN = 30000; // 30 seconds between submissions

/**
 * Initialize the contact form.
 */
export function initContactForm() {
  const form = document.getElementById('contact-form');
  if (!form) return;

  // Load EmailJS SDK dynamically
  loadEmailJSSDK();

  form.addEventListener('submit', handleSubmit);

  // Real-time validation on blur
  const inputs = form.querySelectorAll('.form__input, .form__textarea');
  inputs.forEach((input) => {
    input.addEventListener('blur', () => validateField(input));
    input.addEventListener('input', () => clearFieldError(input));
  });
}

/**
 * Dynamically load the EmailJS SDK.
 */
function loadEmailJSSDK() {
  if (window.emailjs) return;

  const script = document.createElement('script');
  script.src = 'https://cdn.jsdelivr.net/npm/@emailjs/browser@4/dist/email.min.js';
  script.onload = () => {
    if (window.emailjs) {
      window.emailjs.init(EMAILJS_PUBLIC_KEY);
    }
  };
  document.head.appendChild(script);
}

/**
 * Handle form submission.
 * @param {Event} e - Submit event
 */
async function handleSubmit(e) {
  e.preventDefault();

  const form = e.target;
  const submitBtn = form.querySelector('.form__submit');
  const statusEl = form.querySelector('.form__status');

  // Rate limiting
  const now = Date.now();
  if (now - lastSubmitTime < SUBMIT_COOLDOWN) {
    showStatus(statusEl, 'error', 'Please wait before sending another message.');
    return;
  }

  // Honeypot check
  const honeypot = form.querySelector('[name="website"]');
  if (honeypot && honeypot.value.trim() !== '') {
    // Silently reject — likely a bot
    showStatus(statusEl, 'success', 'Thank you! Your message has been sent.');
    form.reset();
    return;
  }

  // Validate all fields
  if (!validateForm(form)) return;

  // Set loading state
  setLoadingState(submitBtn, true);
  hideStatus(statusEl);

  try {
    // Collect form data
    const data = collectFormData(form);

    // Send via EmailJS
    if (window.emailjs) {
      await window.emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, data);
    } else {
      // Fallback: if EmailJS not loaded, use mailto
      throw new Error('Email service not available. Please try again.');
    }

    // Success
    lastSubmitTime = Date.now();
    showStatus(statusEl, 'success', '✓ Message sent successfully! We\'ll get back to you soon.');
    form.reset();

  } catch (error) {
    console.error('Contact form error:', error);
    showStatus(
      statusEl,
      'error',
      'Something went wrong. Please try again or email us directly at hello@refka.tech'
    );
  } finally {
    setLoadingState(submitBtn, false);
  }
}

/**
 * Collect and sanitize form data, including metadata.
 * @param {HTMLFormElement} form
 * @returns {Object}
 */
function collectFormData(form) {
  const formData = new FormData(form);

  return {
    name: sanitize(formData.get('name')?.trim() || ''),
    email: sanitize(formData.get('email')?.trim() || ''),
    phone: sanitize(formData.get('phone')?.trim() || ''),
    subject: sanitize(formData.get('subject')?.trim() || 'General Inquiry'),
    message: sanitize(formData.get('message')?.trim() || ''),
    // Metadata
    timestamp: new Date().toLocaleString('en-GB', { timeZone: 'Europe/Tirane' }),
    browser: navigator.userAgent,
    referrer: document.referrer || 'Direct',
    page_url: window.location.href,
  };
}

/**
 * Validate the entire form.
 * @param {HTMLFormElement} form
 * @returns {boolean}
 */
function validateForm(form) {
  const fields = form.querySelectorAll('[data-validate]');
  let isValid = true;

  fields.forEach((field) => {
    if (!validateField(field)) {
      isValid = false;
    }
  });

  // Focus first invalid field
  if (!isValid) {
    const firstError = form.querySelector('.form__input--error, .form__textarea--error');
    if (firstError) firstError.focus();
  }

  return isValid;
}

/**
 * Validate a single field.
 * @param {HTMLElement} field
 * @returns {boolean}
 */
function validateField(field) {
  const value = field.value.trim();
  const rules = field.dataset.validate?.split(',') || [];
  const errorEl = field.parentElement?.querySelector('.form__error');
  let errorMsg = '';

  for (const rule of rules) {
    switch (rule.trim()) {
      case 'required':
        if (!value) errorMsg = 'This field is required.';
        break;
      case 'email':
        if (value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
          errorMsg = 'Please enter a valid email address.';
        }
        break;
      case 'phone':
        if (value && !/^[+]?[\d\s\-().]{7,20}$/.test(value)) {
          errorMsg = 'Please enter a valid phone number.';
        }
        break;
      case 'minlength':
        if (value && value.length < 10) {
          errorMsg = 'Please enter at least 10 characters.';
        }
        break;
    }
    if (errorMsg) break;
  }

  if (errorMsg) {
    field.classList.add(
      field.tagName === 'TEXTAREA' ? 'form__textarea--error' : 'form__input--error'
    );
    if (errorEl) {
      errorEl.textContent = errorMsg;
      errorEl.classList.add('form__error--visible');
    }
    return false;
  }

  clearFieldError(field);
  return true;
}

/**
 * Clear validation error from a field.
 * @param {HTMLElement} field
 */
function clearFieldError(field) {
  field.classList.remove('form__input--error', 'form__textarea--error');
  const errorEl = field.parentElement?.querySelector('.form__error');
  if (errorEl) {
    errorEl.textContent = '';
    errorEl.classList.remove('form__error--visible');
  }
}

/**
 * Set the submit button loading state.
 * @param {HTMLElement} btn
 * @param {boolean} isLoading
 */
function setLoadingState(btn, isLoading) {
  if (!btn) return;
  btn.classList.toggle('btn--loading', isLoading);
  btn.disabled = isLoading;
  btn.textContent = isLoading ? 'Sending…' : 'Send message';
}

/**
 * Show a status message.
 * @param {HTMLElement} el
 * @param {'success'|'error'} type
 * @param {string} message
 */
function showStatus(el, type, message) {
  if (!el) return;
  el.className = `form__status form__status--${type}`;
  el.textContent = message;
  el.setAttribute('role', 'alert');
}

/**
 * Hide the status message.
 * @param {HTMLElement} el
 */
function hideStatus(el) {
  if (!el) return;
  el.className = 'form__status';
  el.textContent = '';
  el.removeAttribute('role');
}
