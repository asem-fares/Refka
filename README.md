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
assets/js/boot.js        runs first (in <head>): picks country and language, sets lang/dir, starts the language file
assets/js/i18n/<lang>.js translations: one file per language (en.js always loads; the visitor's language loads on demand)
assets/js/app.js         menu, background, pricing engine, language switcher, member phone demo, owner app section, modals, WhatsApp button
assets/js/form.js        click handling, modal focus handling, the signup/contact form
assets/fonts/            woff2 files + LICENSE.txt (SIL Open Font License)
assets/icons/            favicon and app icons
assets/images/           social sharing image (1200x630) and logo
manifest.json, robots.txt, sitemap.xml, _headers
```

`boot.js` is the only script in `<head>` and runs before the page is drawn. The others are classic scripts
loaded with `defer`, in the order i18n/en.js → app.js → form.js; app.js waits for the visitor's language file
(`RFK.whenLang`) before it fills the page. Sections start hidden only when boot.js has added the class `js`,
so the page shows in full without JavaScript, and boot.js shows everything if the scripts have not finished
within 6 seconds.

## Common changes

**Edit copy.** Every visible string is in `assets/js/i18n/<language>.js` under its key; the English
text in `index.html` is the fallback without JavaScript. A new key goes into all 22 files (English
first). Brand rules: "Refka" in Latin letters in every language, Arabic included; German uses "Sie";
plan names (Starter, Growth, Pro) stay in English. A new language needs its file, its code in `LANGS`
in boot.js, a button in the language picker and an hreflang line in index.html and sitemap.xml.

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

## Design system (assets/css/site.css)

- **Tokens first.** Every color, font family, font size, radius and the page width live in the
  single `:root` block at the top of `site.css`. A raw color anywhere else is a bug; add a token.
- **Brand:** teal `--p` (fills), `--p-txt` (teal text on dark), gold `--a`. Logo gradient: teal to gold.
  The wordmark is Sora ExtraBold (800), tracking −0.01em, color `--t1`. `assets/images/refka-logo.svg`
  is the outlined master logo (no font needed).
- **Type:** `--font-display` (Sora) for headings, buttons and labels; `--font-body` (Inter) for text;
  `--font-brand` (always Sora) for the wordmark and prices. A language changes only these two
  tokens (section 7), so new components need no per-language rules. Sizes come from the `--fs-*` scale.
- **Shapes:** buttons, inputs and selects `--r-control` (10px); cards `--r-card` (16px); panels
  `--r-panel` (20px); pills `--r-pill`. Buttons: `.btn-teal`, `.btn-outline`, `.btn-sm-outline`,
  48px tall, `.lg` and `.btn-outline` 52px.
- **Spacing:** 4px base, 8px rhythm. Padding, margin and gap use only `--sp-*` tokens
  (2, 4, 8, 12, 16, 20, 24, 32, 40, 48, 56, 64, 80, 96 px). Phone demos are scaled-down app
  screens and keep their own fine values.
- **Motion:** durations `--dur-fast` 150ms (hover/press), `--dur-base` 250ms (component state),
  `--dur-slow` 400ms (content arriving), `--dur-ambient` 600ms (photo zoom only); easing `--ease-std`
  for state changes, `--ease-out` for arrivals. Always name the property, never `transition: all`.
  Everything that moves has a `prefers-reduced-motion` fallback. Phone-demo keyframes are story
  timelines and keep their own timing.
- **Contrast:** every text pair is at least 4.5:1 (3:1 for 24px+ or bold 18.66px+), measured on the
  rendered page. `--t3` is the dimmest color for labels and small text; `--t-off` is only for large
  display text (step numbers). Links inside the legal documents use `--p-txt`.
- **Font sizes:** only the `--fs-*` scale. Arabic uses the same scale one step up for card text
  (`--fs-body`) and an 18px body, because Arabic glyphs read smaller at the same size.
- **Layout:** every band (nav, hero, sections, footer) uses `padding-inline: var(--pad-x)`, which
  centers content in `--container` (1200px) with a `--gutter` of 64px (20px under 900px).
- **Breakpoints:** 1240, 900, 600, 480 px (plus `max-height: 520px` for phones held sideways).
- **Icons:** inline SVG line icons from the sprite in the Features section (`#ic-*`, `#oa-*`),
  `stroke="currentColor"`. No emoji as icons.

## Checking a change

Open `index.html` in a browser (the form runs in preview mode), then check at least: English,
Arabic (right-to-left) and German; a phone-width window; every "Start Free Trial" button; the
pricing country selector; the legal documents in the footer. The browser console must show no
errors, and there must be no horizontal scrolling on a phone.
