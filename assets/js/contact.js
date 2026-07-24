/* ==========================================================================
   CONTACT — Form Validation, Submission & UX States
   Uses FormSubmit AJAX endpoint for direct email delivery.
   ========================================================================== */

import { sanitize } from './utils.js';
import { animateButtonSuccess, animateButtonError } from './motion-system.js';

// Configuration: Recipient email address (branded inbox, never a personal address)
const RECIPIENT_EMAIL = 'community@refka.tech';
const FORMSUBMIT_URL = `https://formsubmit.co/ajax/${RECIPIENT_EMAIL}`;

// Rate limiting
let lastSubmitTime = 0;
const SUBMIT_COOLDOWN = 10000; // 10 seconds between submissions
const FETCH_TIMEOUT = 12000;   // 12s — abort the request if FormSubmit is unresponsive

/**
 * Initialize the contact form.
 */
export function initContactForm() {
  const form = document.getElementById('contact-form');
  if (!form) return;

  form.addEventListener('submit', handleSubmit);

  // Real-time validation on blur & input
  const inputs = form.querySelectorAll('.form__input, .form__textarea');
  inputs.forEach((input) => {
    input.addEventListener('blur', () => validateField(input));
    input.addEventListener('input', () => clearFieldError(input));
  });
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
    showStatus(statusEl, 'error', 'Please wait a few seconds before sending another message.');
    return;
  }

  // Honeypot check (bot trap)
  const honeypot = form.querySelector('[name="website"]');
  if (honeypot && honeypot.value.trim() !== '') {
    showStatus(statusEl, 'success', '✓ Message sent successfully! We\'ll get back to you soon.');
    form.reset();
    return;
  }

  // Validate all required fields
  if (!validateForm(form)) return;

  // Set loading state
  setLoadingState(submitBtn, true);
  hideStatus(statusEl);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

  try {
    const data = collectFormData(form);

    const response = await fetch(FORMSUBMIT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        _subject: `Refka Website Contact: ${data.subject} from ${data.name}`,
        _template: 'table',
        _captcha: 'false',
        Name: data.name,
        Email: data.email,
        Phone: data.phone || 'Not provided',
        Subject: data.subject,
        Message: data.message,
        SubmissionTime: data.timestamp,
        Browser: data.browser,
        Referrer: data.referrer
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    const result = await response.json();

    // Check if form is successfully submitted
    if (result.success === 'true' || result.success === true) {
      lastSubmitTime = Date.now();
      showStatus(statusEl, 'success', '✓ Message sent successfully! We\'ll get back to you soon.');
      animateButtonSuccess(submitBtn);
      form.reset();
    }
    // Check if form requires initial activation link click
    else if (result.message && result.message.toLowerCase().includes('activation')) {
      showStatus(
        statusEl,
        'success',
        'Thanks! Your message was received. Our inbox is completing a one-time FormSubmit activation — please email us directly at community@refka.tech in the meantime.'
      );
    }
    else {
      throw new Error(result.message || 'Submission failed');
    }

  } catch (error) {
    const aborted = error.name === 'AbortError';
    console.error('Contact form error:', error);
    showStatus(
      statusEl,
      'error',
      aborted
        ? 'The request timed out. Please try again, or email us directly at community@refka.tech'
        : 'Something went wrong sending the message. Please email us directly at community@refka.tech'
    );
    animateButtonError(submitBtn);
  } finally {
    clearTimeout(timeoutId);
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
    timestamp: new Date().toLocaleString('en-GB', { timeZone: 'Europe/Tirane' }),
    browser: navigator.userAgent,
    referrer: document.referrer || 'Direct'
  };
}

/**
 * Validate all fields in the form.
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

  if (!isValid) {
    const firstError = form.querySelector('.form__input--error, .form__textarea--error');
    if (firstError) firstError.focus();
  }

  return isValid;
}

/**
 * Validate a single input field.
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
      case 'minlength': {
        const min = parseInt(field.dataset.minlength, 10) || 10;
        if (value && value.length < min) {
          errorMsg = `Please enter at least ${min} characters.`;
        }
        break;
      }
    }
    if (errorMsg) break;
  }

  if (errorMsg) {
    field.classList.add(
      field.tagName === 'TEXTAREA' ? 'form__textarea--error' : 'form__input--error'
    );
    field.setAttribute('aria-invalid', 'true');
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
 * Clear error styling from a field.
 * @param {HTMLElement} field
 */
function clearFieldError(field) {
  field.classList.remove('form__input--error', 'form__textarea--error');
  field.removeAttribute('aria-invalid');
  const errorEl = field.parentElement?.querySelector('.form__error');
  if (errorEl) {
    errorEl.textContent = '';
    errorEl.classList.remove('form__error--visible');
  }
}

/**
 * Set submit button loading state.
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
 * Show status message.
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
 * Hide status message.
 * @param {HTMLElement} el
 */
function hideStatus(el) {
  if (!el) return;
  el.className = 'form__status';
  el.textContent = '';
  el.removeAttribute('role');
}
