# AccessibleAI Demo Site

An intentionally inaccessible Angular application, built as a fixture for demoing the
AccessibleAI Chrome extension and MCP server (Task 6.2 of the implementation plan). Every
violation on this site is **deliberate** and commented in the source with
`<!-- Intentional violation: ... -->` (or `// Intentional violation: ...` in TypeScript).
Do not "fix" any of them — that would defeat the purpose of the fixture.

The app has four routes:

| Route         | Component                                | Purpose                                   |
| ------------- | ----------------------------------------- | ------------------------------------------ |
| `/`           | `src/app/home/home.ts`                    | Home / landing page                        |
| `/products`   | `src/app/products/products.ts`            | Product listing with filter/sort widgets   |
| `/checkout`   | `src/app/checkout/checkout.ts`            | Checkout form (flagship "missing labels" page) |
| `/contact`    | `src/app/contact/contact.ts`              | Contact form + embedded map                |

The header/nav/footer shared by every page live in `src/app/app.html` / `app.css` / `app.ts`.

## Running locally

```bash
cd examples/demo-site
npm install
npm start        # ng serve, http://localhost:4200
npm run build    # ng build (production)
```

This app is self-contained (its own `package.json`/`node_modules`) and is **not** part of
the root npm workspaces — it is a standalone example, not a monorepo package.

## How "verifiable" was checked

Every violation below cites the WCAG success criterion it fails. Where possible, the
description also names the **axe-core rule** that automatically flags it. These were not
just guessed — they were checked directly against the `axe-core@4.13.0` package already
vendored in this repo's root `node_modules`, using small `jsdom` snippets that mirror the
exact markup pattern used on each page (see the git history of this file / commit for the
throwaway scripts), and cross-referenced against
`packages/standards/src/data/wcag-criteria.json` for the canonical criterion IDs/names used
elsewhere in this product. Two things that came out of that check materially changed how
this fixture is built, worth calling out for whoever maintains it next:

- **`<input placeholder="…">` alone is *not* enough to trigger axe-core's `label` rule.**
  Browsers (and axe-core, which follows the same accessible-name computation) fall back to
  the `placeholder` attribute as the input's accessible name when no real label exists. A
  placeholder-only field is a genuine WCAG 3.3.2 failure (the hint vanishes once the user
  types, and it's not what 3.3.2 means by a "label or instruction"), but it would *not* be
  flagged by an automated scan. To keep every "missing label" item here honestly
  axe-detectable, none of the form fields on this site use a placeholder as their only hint
  — each field is preceded by a plain `<div class="field-label">`, styled to look exactly
  like a label to a sighted user, but with no `for`/`aria-labelledby` link to the input. That
  reproduces the far more common real-world bug (a visual label that was never wired up
  semantically) and does reliably fail axe-core's `label` rule.
- **The classic "any duplicate id" rule (`duplicate-id`) is deprecated and disabled by
  default** in the axe-core version vendored here; only `duplicate-id-aria` runs
  out of the box, and it only fires for ids that are actually *referenced* — by
  `<label for>`, `aria-labelledby`, etc. The duplicate `id="price-filter"` on the Products
  page is therefore deliberately built with two separate `<label for="price-filter">`
  elements, one pointing at each `<select>`, so the reused id is genuinely picked up.

A few items are genuine WCAG failures that automated tools cannot detect on their own (e.g.
vague link text, filename-as-alt-text, color-only "required" indicators, empty `alt=""` on
a meaningful image) — these are marked **manual** and would be caught by a human reviewer
or the product's AI-assisted deep-analysis, not by a Quick Audit alone. That distinction is
called out explicitly so expectations for an automated scan stay accurate.

One item references a WCAG 2.2 criterion that is **not** present in this repo's
`wcag-criteria.json` (which only goes up to WCAG 2.1): SC 2.5.8 Target Size (Minimum).
1.3.5 Identify Input Purpose (WCAG 2.1 AA) *is* present in that file.

---

## Violation catalogue

### Site-wide (`src/app/app.html`, `app.css`, `app.ts` — present on every page)

| # | Description | WCAG SC | Detection |
|---|---|---|---|
| 1 | No "Skip to main content" link. A keyboard/screen-reader user must tab through the logo, hamburger button, four nav links, the "More" dropdown, and the search box on **every single page load** before reaching page content. | **2.4.1 Bypass Blocks** (A) | axe: `bypass` |
| 2 | Hamburger mobile-nav toggle `<button>` is built from three empty `<span class="bar">` elements — no text, no `aria-label`, no `aria-expanded`. | **4.1.2 Name, Role, Value** (A) | axe: `button-name` |
| 3 | "More" nav dropdown is a plain `<div class="dropdown-toggle" (click)="toggleMore()">`. No `role`, no `tabindex`, no keydown/keyup handler — cannot be opened or navigated from the keyboard at all. | **2.1.1 Keyboard** (A) | manual (keyboard-only testing) |
| 4 | Header search input has no `<label>`, `aria-label`, `aria-labelledby`, or placeholder — its only visual cue is a decorative (`aria-hidden`) icon, so it has no accessible name at all. | **3.3.2 Labels or Instructions** (A) | axe: `label` |
| 5 | Footer copyright text: `color: #aaaaaa` on `background: #ffffff` = **2.32:1** contrast ratio (needs 4.5:1). | **1.4.3 Contrast (Minimum)** (AA) | axe: `color-contrast` |

### Document-level (`src/index.html`)

| # | Description | WCAG SC | Detection |
|---|---|---|---|
| 6 | `<meta name="viewport" content="...maximum-scale=1, user-scalable=no">` blocks pinch-zoom, preventing users from resizing text up to 200%. | **1.4.4 Resize Text** (AA) | axe: `meta-viewport` |

### Home page (`src/app/home/home.html`, `home.css`)

| # | Description | WCAG SC | Detection |
|---|---|---|---|
| 7 | Hero banner `<img src="assets/hero.svg">` has **no `alt` attribute at all**, even though the image contains the page's main headline ("Summer Sale: Up to 50% Off") baked into the graphic. | **1.1.1 Non-text Content** (A) | axe: `image-alt` |
| 8 | Two `<h1>` elements on one page — "Welcome to ShopEasy" in the hero, and a second "Join Our Newsletter" further down. | **2.4.6 Headings and Labels** (AA) | manual / best-practice (`page-has-heading-one` only checks for *at least* one h1) |
| 9 | Heading level skips from `<h2>Why Shop With Us</h2>` straight to `<h4>Fast Shipping</h4>` (×3), with no `<h3>` in between. | **2.4.6 Headings and Labels** (AA) | axe: `heading-order` |
| 10 | Deprecated `<marquee>` "Breaking News" ticker auto-scrolls continuously with no control to pause, stop, or hide it. | **2.2.2 Pause, Stop, Hide** (A) | axe: `marquee` |
| 11 | `<audio src="assets/ambient.wav" autoplay>` — plays automatically, is not muted, runs 4 seconds (over the 3s threshold), and has no visible player/controls. | **1.4.2 Audio Control** (A) | axe: `no-autoplay-audio` |
| 12 | "Shop Now" CTA button: `color: #cccccc` on `background: #f0f0f0` = **1.41:1** contrast ratio. | **1.4.3 Contrast (Minimum)** (AA) | axe: `color-contrast` |
| 13 | "Curious how we got started? **Click here**." — link text gives no indication of destination/purpose out of context. | **2.4.4 Link Purpose (In Context)** (A) | manual |
| 14 | Three social-media links (Facebook/Twitter/Instagram) are empty `<a>` elements styled as colored circles — no text, `aria-label`, or `title`, so they have no accessible name. | **2.4.4 Link Purpose (In Context)** / **4.1.2 Name, Role, Value** (A) | axe: `link-name` |

### Products page (`src/app/products/products.html`, `products.css`, `products.ts`)

| # | Description | WCAG SC | Detection |
|---|---|---|---|
| 15 | **Flagship keyboard violation.** "Sort by" custom combobox is built entirely from `<div>`s (`.custom-select-toggle` / `.custom-select-option`), toggled only via `(click)`. No `role="listbox"`/`"option"`, no `tabindex`, no keyboard handling — mouse-only. | **2.1.1 Keyboard** (A) | manual (keyboard-only testing) |
| 16 | Wireless Headphones product photo uses `alt=""` (empty). Empty alt is only valid for purely decorative images; this photo is the sole depiction of the product being sold. | **1.1.1 Non-text Content** (A) | manual (axe's `image-alt` accepts `alt=""` as syntactically valid; it cannot judge whether the image is decorative) |
| 17 | Ceramic Coffee Mug product photo uses `alt="IMG_2043.JPG"` — a raw filename instead of a description. | **1.1.1 Non-text Content** (A) | manual (alt text is present, so automated presence-checks pass; quality requires human review) |
| 18 | The page's own toolbar search input has no `<label>`, `aria-label`, or placeholder at all — no accessible name. | **3.3.2 Labels or Instructions** (A) | axe: `label` |
| 19 | `id="price-filter"` reused: the toolbar "Quick price filter" `<select>` and the sidebar "Filters" panel `<select>` both render simultaneously with the same id, and **both** have their own `<label for="price-filter">` pointing at it. | **4.1.1 Parsing** (A) | axe: `duplicate-id-aria` (verified via jsdom — reported with `impact: critical`; the legacy `duplicate-id` rule that fires on *any* id collision is deprecated/disabled by default in this axe-core version) |
| 20 | Every product card includes an empty `<h3></h3>` used purely to reserve vertical spacing in the layout. | **2.4.6 Headings and Labels** (AA) | axe: `empty-heading` |
| 21 | "Add to Wishlist" button per card is empty (`<button class="wishlist-btn"></button>`); the heart glyph is drawn via CSS `::before { content: '♥' }`, which is invisible to the accessibility tree, so the button has no accessible name. | **4.1.2 Name, Role, Value** (A) | axe: `button-name` |
| 22 | Quantity stepper `-`/`+` buttons are styled to ~16×16 CSS px (`.qty-btn`), under the 24×24 CSS px minimum target size. | **2.5.8 Target Size (Minimum)** (AA, WCAG 2.2 — not present in this repo's `wcag-criteria.json`, which covers up to WCAG 2.1) | axe: `target-size` |
| 23 | "Out of stock" label: `color: #a0a0a0` on `background: #e8e8e8` = **2.13:1** contrast ratio. | **1.4.3 Contrast (Minimum)** (AA) | axe: `color-contrast` |

### Checkout page (`src/app/checkout/checkout.html`, `checkout.css`) — flagship missing-labels page

Every field below is preceded by a plain, disconnected `<div class="field-label">` (see
the callout above) rather than a real `<label>` — visually identical to a labeled form,
semantically empty.

| # | Description | WCAG SC | Detection |
|---|---|---|---|
| 24 | "Full Name" `<input type="text">` — no `<label>`, `aria-label`, or `aria-labelledby`. | **3.3.2 Labels or Instructions** (A) | axe: `label` |
| 25 | "Email Address" `<input type="email">` — same issue. | **3.3.2 Labels or Instructions** (A) | axe: `label` |
| 26 | "Phone Number" `<input type="text">` — a numeric-ish field, no label, no format hint. | **3.3.2 Labels or Instructions** (A) | axe: `label` |
| 27 | "Shipping Address" `<input type="text">` — no label. | **3.3.2 Labels or Instructions** (A) | axe: `label` |
| 28 | "Card Number" `<input type="text">` — no label, and no `autocomplete="cc-number"` token, so its purpose isn't programmatically determinable. | **3.3.2 Labels or Instructions** (A) + **1.3.5 Identify Input Purpose** (AA, manual — `autocomplete-valid` only flags *invalid* tokens, not a missing one) | axe: `label` |
| 29 | "Expiration (MM/YY)" `<input type="text">` — a plain text field used for a date value, no label, no format guidance anywhere in the DOM. | **3.3.2 Labels or Instructions** (A) | axe: `label` |
| 30 | "CVV" `<input type="text">` — no label. | **3.3.2 Labels or Instructions** (A) | axe: `label` |
| 31 | Required fields are marked only by a red `<span class="required-mark">*</span>` — no text equivalent (e.g. "(required)") and no `aria-required` on the inputs. | **1.4.1 Use of Color** (A) | manual |
| 32 | "Place Order" submit button is empty (`<button type="submit" class="submit-btn"></button>`); the checkmark is drawn via CSS `::after { content: '✓' }`, invisible to the accessibility tree — no accessible name. | **4.1.2 Name, Role, Value** (A) | axe: `button-name` |

### Contact page (`src/app/contact/contact.html`, `contact.css`, `contact.ts`)

| # | Description | WCAG SC | Detection |
|---|---|---|---|
| 33 | Dismissible promo banner's "close" button is empty (`<button class="close-btn"></button>`); the "×" glyph is CSS-drawn (`::before { content: '×' }`) — no accessible name. | **4.1.2 Name, Role, Value** (A) | axe: `button-name` |
| 34 | "Subject" `<input type="text">` — preceded by a disconnected `<div class="field-label">`, no real `<label>`. | **3.3.2 Labels or Instructions** (A) | axe: `label` |
| 35 | "Message" `<textarea>` — same pattern, no real `<label>`. | **3.3.2 Labels or Instructions** (A) | axe: `label` |
| 36 | "We typically reply within one business day" hint text: `color: #bdbdbd` on `background: #ffffff` = **1.88:1** contrast ratio. | **1.4.3 Contrast (Minimum)** (AA) | axe: `color-contrast` |
| 37 | Embedded map `<iframe>` has no `title` attribute, so screen-reader users navigating by frame get an unlabeled frame with no indication of its contents. | **2.4.1 Bypass Blocks** (A), per this repo's `wcag-criteria.json` mapping of the `frame-title` rule (the axe-core package installed here tags `frame-title` under `wcag412` / 4.1.2 Name, Role, Value instead — both citations are defensible; the WCAG spec text for `frame-title` best matches 4.1.2) | axe: `frame-title` (verified via jsdom) |

---

**Total: 37 distinct violations** across 4 pages plus the shared shell/document, covering:
missing form labels (11 unlabeled inputs/textareas across the header, Products, Checkout,
and Contact), images without meaningful alt text (3), a custom dropdown/menu with no
keyboard support (2 instances), color contrast failures (4 instances, all with computed
ratios), heading hierarchy problems (3), a missing skip-navigation link, icon-only buttons
with no accessible name (4), a duplicate id, unhelpful link text, an empty/icon-only link,
autoplaying audio, an autoplaying `<marquee>`, an un-zoomable viewport, an untitled iframe,
an undersized touch target, and a color-only required-field indicator.

## Assets

- `public/assets/hero.svg`, `product-*.svg` — inline-generated placeholder graphics (no
  external network calls needed).
- `public/assets/ambient.wav` — a 4-second, quiet 220 Hz tone generated locally for the
  autoplaying-audio violation (see `no-autoplay-audio` above); not silence, so the
  `HTMLMediaElement` has a real, non-zero, non-muted audio track for axe-core to detect.
