# Refka website (refka.tech)

The public marketing site for Refka: one page, 22 languages, local-currency pricing, and a
"Start Free Trial" form that emails each request to the team. Plain HTML, CSS and JavaScript.
No framework, no build step, no third-party requests except the form endpoint.

The previous site is kept untouched on the `legacy-site` branch.

## How it is deployed

Every push to `main` runs `.github/workflows/static.yml`, which publishes the repository root to
GitHub Pages. The custom domain `refka.tech` is configured in the repository settings
(Settings → Pages), so no `CNAME` file is needed. Work happens on a branch and reaches `main`
through a pull request.

## Files

```
index.html               page markup, meta tags, CSP, structured data, legal documents, form
404.html                 "page not found" (served by GitHub Pages for unknown URLs)
assets/css/fonts.css     self-hosted fonts (Sora, Inter, IBM Plex Sans Arabic)
assets/css/site.css      all styles: layout, legibility layer, Arabic/RTL, form
assets/js/i18n.js        translations: one object per language inside T
assets/js/app.js         menu, background, pricing engine, language switcher, member phone demo, owner app section, modals, WhatsApp button
assets/js/form.js        click handling, modal focus handling, the signup/contact form
assets/fonts/            woff2 files + LICENSE.txt (SIL Open Font License)
assets/icons/            favicon and app icons
assets/images/           social sharing image (1200x630) and logo
manifest.json, robots.txt, sitemap.xml, _headers
```

Scripts are classic scripts loaded with `defer`, in the order i18n.js → app.js → form.js.

## Common changes

**Edit copy.** Every visible string is in `assets/js/i18n.js` under `T.<language>.<key>`; the
English text in `index.html` is only the fallback before JavaScript runs. Change the key in every
language you support. Brand rules: "Refka" in Latin script, "رفقة" in Arabic text; German uses
"Sie"; plan names (Starter, Growth, Pro) stay in English.

**Change prices.** `PRICING` at the top of `assets/js/app.js` (USD, per zone). Zone A is the
`ZONE_A` country list; every other country is Zone B. The zone comes from the gym's country,
never from the visitor's IP.

**Exchange rates.** `FX` in `assets/js/app.js` is a dated snapshot used only to *display* prices
in local currency. A server can override it by defining `window.REFKA_FX` before app.js loads.

**Where form requests go.** `LEADS_INBOX` in `assets/js/form.js` (currently
`community@refka.tech`), delivered by FormSubmit. Before launch, submit the form once on
refka.tech and click the activation link FormSubmit sends to that inbox; until then requests
are not forwarded and visitors see the email fallback. Forms on any host other than
refka.tech run in preview mode and send nothing.

**When the gym-owner app goes live.** Set `APP_URL = 'https://app.refka.tech'` in
`assets/js/form.js`. Every "Start Free Trial" button then goes straight to registration with
`lang`, `country` and `plan` in the URL, and the form is no longer used.

## Rules that keep the site working

- **No inline JavaScript.** The Content-Security-Policy in `index.html` blocks `onclick="…"` and
  `<script>` blocks with code. Make an element clickable with `data-click="action"` (plus
  `data-click-arg` if needed) and add the action to `CLICK_ACTIONS` in `form.js`.
- **No third-party scripts, fonts or images.** Anything new must be added to the CSP on purpose
  and to the Cookie Policy and Privacy Policy. The site sets no cookies, so it has no cookie banner:
  adding anything that sets cookies means bringing back a consent banner first.
- **Visit statistics:** Cloudflare Web Analytics (cookieless). Paste the token from the Cloudflare
  dashboard into `CF_ANALYTICS_TOKEN` in `assets/js/app.js`; it loads only on refka.tech.
- **Keep the two CSPs identical**: the `<meta>` tag in `index.html` and `_headers`.
- **Relative asset paths** (`assets/…`) in `index.html`, so the page also works from a preview.

## Checking a change

Open `index.html` in a browser (the form runs in preview mode), then check at least: English,
Arabic (right-to-left) and German; a phone-width window; every "Start Free Trial" button; the
pricing country selector; the legal documents in the footer. The browser console must show no
errors, and there must be no horizontal scrolling on a phone.
