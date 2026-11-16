// Refka member app: entry point. Screens register themselves on import.
import './home.js';
import './social.js';
import './me.js';
import { boot } from './entry.js';

if (!window.rf) {
  // The Supabase client or config did not load (offline, blocked CDN). Say so in both languages instead of a blank page.
  const p = document.createElement('p');
  p.style.cssText = 'padding:24px;text-align:center';
  p.textContent = 'Could not load the app. Check your internet and open the link again. · معرفناش نحمّل التطبيق. راجع النت وافتح اللينك تاني.';
  const r = document.getElementById('root'); r.textContent = ''; r.appendChild(p);
} else {
  boot();
}
