# Refka — Built on Belonging

> The Community Operating System for Independent Gyms.

Refka matches gym members with compatible training partners, reducing churn through belonging. This is the marketing website for Refka — a B2B SaaS platform piloting in Tirana, Albania.

**Live site:** [https://refka.tech](https://refka.tech)

---

## Table of Contents

- [Project Structure](#project-structure)
- [How to Run](#how-to-run)
- [How to Deploy](#how-to-deploy)
- [How to Edit](#how-to-edit)
- [Architecture](#architecture)
- [SEO](#seo)
- [Performance](#performance)
- [Contact Form](#contact-form)
- [Accessibility](#accessibility)
- [Security](#security)
- [Coding Standards](#coding-standards)
- [Future Recommendations](#future-recommendations)

---

## Project Structure

```
refka/
├── index.html                     # Single-page landing site
│
├── assets/
│   ├── css/
│   │   ├── variables.css          # Design tokens (colors, spacing, fonts, shadows)
│   │   ├── reset.css              # CSS reset + base body/heading styles
│   │   ├── typography.css         # Gradient text, eyebrow, pull quote styles
│   │   ├── layout.css             # Wrapper, section, skip-link, sr-only
│   │   ├── components.css         # Nav, buttons, cards, glyph, info-note, back-to-top
│   │   ├── sections.css           # Hero, story, thesis, how, eco, proof, pilot, vision, CTA, contact, footer
│   │   ├── animations.css         # Reveal system, SVG bridge animation, keyframes
│   │   └── responsive.css         # All media queries (960→480px breakpoints)
│   │
│   ├── js/
│   │   ├── main.js                # Entry point — initializes all modules
│   │   ├── navbar.js              # Mobile hamburger menu + active section tracking
│   │   ├── animations.js          # Scroll reveal, hero SVG animation, back-to-top
│   │   ├── contact.js             # Form validation, EmailJS submission, UX states
│   │   └── utils.js               # Debounce, throttle, sanitize, getCurrentYear
│   │
│   ├── images/
│   │   ├── og-image.png           # Open Graph social preview (1200×630)
│   │   └── refka-logo.svg         # Standalone logo with wordmark
│   │
│   └── icons/
│       └── favicon.svg            # SVG favicon (Refka logo mark)
│
├── robots.txt                     # Search engine crawl rules
├── sitemap.xml                    # URL map for search engines
├── manifest.json                  # PWA manifest
├── .gitignore                     # Git ignore rules
├── .github/
│   └── workflows/
│       └── static.yml             # GitHub Pages auto-deploy on push to main
│
└── README.md                      # This file
```

### Folder Explanation

| Folder | Purpose |
|--------|---------|
| `assets/css/` | Modular CSS files loaded in order. Each file has a single responsibility. |
| `assets/js/` | ES6 module JavaScript. `main.js` imports and initializes everything. |
| `assets/images/` | Marketing images: OG preview, logo exports. |
| `assets/icons/` | Favicons and app icons. |
| `.github/workflows/` | CI/CD: auto-deploys to GitHub Pages on `main` push. |

---

## How to Run

This is a static HTML site — no build step required.

### Option 1: VS Code Live Server
1. Install the [Live Server extension](https://marketplace.visualstudio.com/items?itemName=ritwickdey.LiveServer)
2. Open `index.html`
3. Click "Go Live" in the status bar

### Option 2: Python
```bash
cd refka
python -m http.server 8000
# Open http://localhost:8000
```

### Option 3: Node.js
```bash
npx serve .
# Open the URL shown in terminal
```

> **Important:** The site uses ES6 modules (`type="module"`) and absolute paths (`/assets/...`), so it must be served via HTTP, not opened as a file.

---

## How to Deploy

### GitHub Pages (current setup)
Deployment is automatic. Push to `main` and the GitHub Actions workflow deploys to GitHub Pages.

### Custom Domain
1. Add a `CNAME` file to the root with your domain: `refka.tech`
2. Configure DNS:
   - A records pointing to GitHub Pages IPs
   - Or CNAME record pointing to `<username>.github.io`
3. Enable HTTPS in GitHub Pages settings

### Other Hosts (Netlify, Vercel, Cloudflare Pages)
Simply connect the repo — all these hosts detect and deploy static sites automatically.

---

## How to Edit

### Content Changes
- **Text/copy:** Edit directly in `index.html`. Content is in semantic HTML sections.
- **Colors/spacing:** Edit `assets/css/variables.css` — all design tokens are here.
- **Section styles:** Edit `assets/css/sections.css` for section-specific styling.
- **New components:** Add to `assets/css/components.css` using BEM naming.

### Adding a New Section
1. Add the HTML to `index.html` inside `<main>`
2. Add styles to `assets/css/sections.css`
3. Add `.reveal` class to elements for scroll animation
4. Add a nav link in the `<nav>` element if needed

### Changing Contact Form Behavior
- Validation rules: Edit `data-validate` attributes on inputs
- Email service: Edit credentials in `assets/js/contact.js`
- Form fields: Add HTML in the contact section + update `collectFormData()` in `contact.js`

---

## Architecture

### Design Decisions

| Decision | Rationale |
|----------|-----------|
| **No build tool** | Static site simplicity — no npm, webpack, or bundler needed. Deploys anywhere. |
| **CSS modules via `<link>`** | Each file is independently cacheable. Logical separation without build complexity. |
| **ES6 modules** | Native browser support (97%+). Clean imports without bundling. |
| **BEM naming** | Predictable, collision-free class names. Industry standard. |
| **CSS custom properties** | Single source of truth for the design system. Runtime-changeable. |
| **IntersectionObserver** | Performant scroll detection without scroll event listeners. |
| **EmailJS** | Email from static sites without a backend. Free tier sufficient for startup stage. |

### CSS Architecture

Files are loaded in dependency order:
1. `variables.css` — tokens (no rules, just declarations)
2. `reset.css` — normalizes browser defaults
3. `typography.css` — text patterns
4. `layout.css` — structural patterns
5. `components.css` — reusable components (nav, btn, card)
6. `sections.css` — page-specific sections
7. `animations.css` — motion
8. `responsive.css` — media queries (always last, overrides above)

### JavaScript Architecture

```
main.js (entry)
├── navbar.js    → Mobile menu, active nav tracking
├── animations.js → Scroll reveal, hero animation, back-to-top
├── contact.js   → Form validation + EmailJS
└── utils.js     → Shared helpers (debounce, throttle, sanitize)
```

---

## SEO

### Implemented SEO Features

| Feature | Status |
|---------|--------|
| Title tag (optimized, <60 chars visible) | ✅ |
| Meta description | ✅ |
| Canonical URL | ✅ |
| Open Graph (full) | ✅ |
| Twitter Cards | ✅ |
| `robots.txt` | ✅ |
| `sitemap.xml` | ✅ |
| `hreflang` (en + x-default) | ✅ |
| Geo-targeting meta (Albania) | ✅ |
| JSON-LD: Organization | ✅ |
| JSON-LD: WebSite | ✅ |
| JSON-LD: SoftwareApplication | ✅ |
| JSON-LD: FAQPage | ✅ |
| Semantic HTML5 | ✅ |
| Heading hierarchy (single H1) | ✅ |
| Image alt text | ✅ |
| Internal linking | ✅ |
| Proper robots directive | ✅ |

### Albania Targeting
- `geo.region: AL`, `geo.placename: Tirana`
- `geo.position` and `ICBM` meta tags
- `hreflang="en"` with `x-default` fallback
- Organization schema includes `areaServed: Albania, Europe`
- Content naturally references Tirana, Albanian gyms

### How to Verify
- **Structured Data:** [Google Rich Results Test](https://search.google.com/test/rich-results)
- **Open Graph:** [Facebook Sharing Debugger](https://developers.facebook.com/tools/debug/)
- **Twitter Cards:** [Twitter Card Validator](https://cards-dev.twitter.com/validator)

---

## Performance

### Optimization Strategies

| Strategy | Implementation |
|----------|---------------|
| Font preconnect | `<link rel="preconnect">` for Google Fonts |
| Font display swap | `display=swap` prevents FOIT |
| CSS modules (cacheable) | 8 separate files, each independently cached |
| No render-blocking JS | `<script type="module">` is deferred by default |
| SVG graphics (no raster images) | Zero image HTTP requests for visuals |
| IntersectionObserver | No scroll listeners; efficient reveal animations |
| Reduced motion support | `prefers-reduced-motion` disables all animations |
| Lazy EmailJS loading | SDK loaded dynamically only when form exists |

### Core Web Vitals Targets

| Metric | Target | Strategy |
|--------|--------|----------|
| **LCP** | < 2.5s | No large images; fonts preconnected |
| **CLS** | < 0.1 | No layout shifts; fonts use swap; SVGs have dimensions |
| **INP** | < 200ms | Minimal JS; no heavy event handlers |

---

## Contact Form

### Architecture

The contact form uses **FormSubmit AJAX** — a zero-configuration email service for static websites. 

- ⚡ **Zero Setup Required:** Submissions automatically route directly to `mahmoudahmed10197@gmail.com`
- 🔒 Includes built-in honeypot spam protection and client-side rate limiting
- 📋 Formatted HTML table notifications with metadata (submission time, browser user agent, referrer)
- ♿ Full accessibility (labels, `aria-required`, `aria-live`, keyboard navigation)

To change the receiving email address, update `RECIPIENT_EMAIL` in `assets/js/contact.js`.

---

## Accessibility

### WCAG AA Compliance

| Feature | Status |
|---------|--------|
| Skip-to-content link | ✅ |
| `<main>` landmark | ✅ |
| `<nav>` with `role="navigation"` | ✅ |
| `<footer>` with `role="contentinfo"` | ✅ |
| Section `aria-labelledby` | ✅ |
| Focus-visible styles | ✅ |
| Keyboard-navigable mobile menu | ✅ |
| Escape closes mobile menu | ✅ |
| `aria-expanded` on toggle | ✅ |
| `aria-hidden` on decorative SVGs | ✅ |
| `aria-live` on form errors | ✅ |
| `aria-required` on required fields | ✅ |
| Form labels on all inputs | ✅ |
| `prefers-reduced-motion` | ✅ |
| Color contrast (AA compliant) | ✅ |
| Minimum touch target 44px | ✅ |

---

## Security

### Implemented

| Measure | Implementation |
|---------|---------------|
| `X-Content-Type-Options: nosniff` | Meta tag |
| `Referrer-Policy: strict-origin-when-cross-origin` | Meta tag |
| Input sanitization | `sanitize()` in `utils.js` strips HTML |
| Honeypot field | Invisible field traps automated bots |
| Rate limiting | 30s cooldown on form submissions |
| No exposed secrets | EmailJS public key is safe to expose by design |

### Recommended (requires hosting configuration)

If using Cloudflare or a custom server, add these headers:

```
Content-Security-Policy: default-src 'self'; script-src 'self' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:; connect-src https://api.emailjs.com;
X-Frame-Options: DENY
Permissions-Policy: camera=(), microphone=(), geolocation=()
```

---

## Coding Standards

### CSS
- **Naming:** BEM (Block__Element--Modifier), e.g. `.nav__link--active`
- **Variables:** All tokens in `variables.css`. Use `var(--color-text)` not `#F4F4F6`
- **No `!important`:** Except reduced-motion overrides
- **No inline styles:** Except two margin-top exceptions on info-notes

### JavaScript
- **Modules:** ES6 `import`/`export`. One module per feature.
- **No globals:** Everything is scoped to modules
- **Comments:** JSDoc on all exported functions
- **Error handling:** Try/catch on async operations
- **Feature detection:** Modules degrade gracefully if DOM elements are missing

### HTML
- **Semantic:** `<header>`, `<main>`, `<section>`, `<article>`, `<nav>`, `<footer>`
- **One `<h1>`:** Only in the hero. All sections use `<h2>`.
- **IDs:** Every form element and interactive component has a unique ID
- **ARIA:** Labels, roles, and states on all interactive elements

---

## Future Recommendations

### Short-term
- [ ] Set up EmailJS account and replace placeholder credentials
- [ ] Add Google Analytics 4 or Plausible for traffic tracking
- [ ] Add social media links (LinkedIn, Twitter/X) to footer
- [ ] Create PNG favicon fallbacks for older browsers (32×32, 16×16)
- [ ] Add Cloudflare for CDN + security headers

### Medium-term
- [ ] Add Albanian language version with `/sq/` path
- [ ] Add a blog for SEO content marketing
- [ ] Implement Cloudflare Turnstile for stronger spam protection
- [ ] Add cookie consent banner (GDPR compliance)
- [ ] Performance monitoring with Web Vitals library

### Long-term
- [ ] Migrate to a framework (Astro, Next.js) when the site grows beyond 3-4 pages
- [ ] Add a CMS (Contentful, Sanity) for non-developer content editing
- [ ] Implement A/B testing on CTA sections
- [ ] Add automated Lighthouse CI checks in the GitHub workflow

---

## License

© Refka. All rights reserved.
