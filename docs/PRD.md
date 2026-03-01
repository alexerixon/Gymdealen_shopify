# Gymdealen.se — Product Requirements Document

**Version:** 1.0
**Date:** 2026-03-01
**Status:** Approved
**Platform:** Shopify (migrating from WordPress/WooCommerce)

---

## 1. Business Objectives

| # | Objective | Success Metric |
|---|-----------|----------------|
| 1 | Replace WooCommerce with a premium Shopify storefront | Store live, 0 critical bugs |
| 2 | Preserve 100% of existing SEO rankings during migration | 301 redirects for all ~500 product URLs, no ranking drop >10% after 90 days |
| 3 | Enable online checkout with Swedish-market payment methods | Klarna, Swish, and card payments functional in SEK |
| 4 | Support 4+ languages for international expansion | SV/EN/NO/DA/DE switchable from header |
| 5 | Offer lease financing via Finanslaget on every product page | Widget renders with correct price on all product pages |

---

## 2. User Stories

### Buyer Stories

| ID | As a... | I want to... | So that... |
|----|---------|--------------|------------|
| B1 | Buyer | Browse products by category, brand, and condition | I can narrow down the ~500 items to relevant ones |
| B2 | Buyer | View detailed specs and condition ratings for each item | I know exactly what I'm buying (used commercial equipment) |
| B3 | Buyer | Calculate a monthly lease estimate via Finanslaget before purchasing | I can budget for the cost without a large upfront payment |
| B4 | Buyer | Pay with Klarna, Swish, or card in SEK (or local currency) | I can use my preferred Swedish payment method |
| B5 | Buyer | Switch the store language between SV/EN/NO/DA/DE | I can shop in my native language |
| B6 | Buyer | See prices with and without VAT | I can evaluate cost as either a private person or a business |
| B7 | Buyer | Search for specific equipment by name or model | I can find a specific machine quickly |

### Admin Stories

| ID | As an... | I want to... | So that... |
|----|---------|--------------|------------|
| A1 | Admin | Add/edit products with custom fields (condition, brand, specs) | Product pages show accurate, structured information |
| A2 | Admin | Import existing WooCommerce products via CSV | I don't have to re-enter 500 products manually |
| A3 | Admin | Manage URL redirects via Shopify Admin | Old WooCommerce URLs automatically forward to new Shopify URLs |
| A4 | Admin | Configure payment providers in Shopify Admin | I can accept Klarna, Swish, and card payments |
| A5 | Admin | Manage multi-language content via Translate & Adapt app | All text is properly translated without custom dev work |

---

## 3. Functional Requirements

### 3.1 Product Catalog

- **Volume:** ~500 products at launch
- **Custom Metafields** (defined in Shopify Admin → Custom Data → Products):

| Metafield key | Type | Values / Notes |
|---------------|------|----------------|
| `condition` | Single-line text (select-like) | Utmärkt / Mycket bra / Bra |
| `brand` | Single-line text | Life Fitness, Technogym, Precor, etc. |
| `year_of_manufacture` | Integer | e.g. 2018 |
| `weight_kg` | Decimal | Equipment weight in kg |
| `max_user_weight_kg` | Decimal | Max user weight capacity |
| `power_requirement` | Single-line text | 230V / Inget elbehov / etc. |

- **Collections (categories):** At minimum:
  - Löpband (Treadmills)
  - Cyklar & Roddmaskiner (Bikes & Rowers)
  - Styrketräning (Strength Training)
  - Kabelmaskiner (Cable Machines)
  - Fria vikter (Free Weights)
  - Crosstrainers

### 3.2 Product Page

- Image gallery with zoom on hover / tap-to-enlarge on mobile
- Product title and price in SEK (with VAT toggle — see §3.7)
- Condition badge (color-coded chip from metafield)
- Specs table: brand, year, weight, power requirement from metafields
- Finanslaget monthly lease estimate widget
- "Add to cart" button (prominent, sticky on mobile)
- Rich text HTML description
- Shipping & returns info accordion

### 3.3 Collection / Listing Page

- Left sidebar with faceted accordion filters (brand, condition, price range)
- Product count per filter value shown in parentheses
- AJAX product grid updates without full page reload
- Active filter chips above grid with × remove buttons
- Sort options: Newest, Price low→high, Price high→low
- 3–4 column responsive grid
- Pagination or "Load more" button

### 3.4 Shopping Cart

- Slide-out cart drawer (no page reload)
- Quantity controls per line item
- Subtotal displayed (incl./excl. VAT depending on toggle)
- "Proceed to checkout" button

### 3.5 Checkout

- Shopify-hosted checkout (standard)
- Payment methods: Klarna, Swish, credit/debit card
- Currency: SEK primary; automatic conversion for other markets via Shopify Markets
- No custom checkout code required (configured in Admin)

### 3.6 SEO Requirements

- 301 redirects from all old WooCommerce URLs (`/product/slug`) to Shopify URLs (`/products/slug`)
- Meta title and meta description preserved from WooCommerce export
- Open Graph tags on all pages
- JSON-LD structured data (Product schema) on all product pages
- Canonical URL tags in `<head>`
- Sitemap.xml auto-generated by Shopify; submitted to Google Search Console post-launch

### 3.7 Multi-Language

- 5 locales: Swedish (SV — primary), English (EN), Norwegian (NO), Danish (DA), German (DE)
- Technology: Shopify Markets + Translate & Adapt app (both free)
- Language switcher in header accessible on all pages
- All hardcoded strings use Shopify's `t` (translation) filter
- URL structure: `/sv/`, `/en/`, `/no/`, `/da/`, `/de/` prefixes via Shopify Markets

### 3.8 VAT Toggle (B2B / B2C)

- Toggle in header: "Privatperson (inkl. moms)" vs. "Företag (exkl. moms)"
- Prices stored including 25% Swedish VAT
- JavaScript divides price by 1.25 when "Företag" mode is active
- Preference persisted in `localStorage`
- Applied consistently on product pages, collection pages, and cart

### 3.9 Finanslaget Lease Integration

- Widget or calculation shown on every product page
- Displays estimated monthly lease cost based on product price
- Fallback calculation: `ceil(price / 36)` kr/mån if Finanslaget API unavailable
- Widget embed code paste-able in Theme Customizer (no code deploy required)

---

## 4. Non-Functional Requirements

| Requirement | Target |
|-------------|--------|
| Lighthouse Performance (mobile) | ≥ 90 |
| Page load time (4G mobile) | < 3 seconds |
| HTML validity | Valid HTML5 |
| Accessibility | WCAG 2.1 AA target |
| GDPR compliance | Cookie consent banner required |
| Browser support | Last 2 versions of Chrome, Firefox, Safari, Edge |
| Uptime | Shopify SLA (99.98%) |

---

## 5. Out of Scope — v1

The following features are explicitly excluded from the initial launch:

- Custom Shopify app development (no private apps)
- ERP / inventory management system integration
- Customer accounts, loyalty program, or purchase history
- Blog or content marketing section
- Real-time inventory sync
- Advanced B2B pricing (customer-specific price lists)
- Custom checkout UI (requires Shopify Plus)

---

## 6. Technical Architecture

### Theme

- **Base:** Shopify Dawn (open-source, GitHub: `Shopify/dawn`)
- **Language:** Liquid (Shopify templating), HTML5, CSS3, vanilla JS
- **Styling:** CSS custom properties for design tokens; no CSS framework
- **Fonts:** Inter (Google Fonts) or Neue Haas Grotesk
- **Color palette:** Dark charcoal primary (`#1a1a1a`), accent TBD with client

### Apps (install via Shopify Admin — no custom code)

| App | Purpose | Cost |
|-----|---------|------|
| Shopify Search & Discovery | Product filters (brand, condition) | Free |
| Translate & Adapt | Multi-language content management | Free |
| Klarna | Buy now, pay later (SV/NO/DE) | Free (transaction %) |
| Metafields (native or Guru) | Define custom product metafields | Free |
| SEO Manager or Plug in SEO | SEO monitoring post-migration | ~$20/mo |

### Data Migration

- WooCommerce export → CSV transformation → Shopify product import
- Script: `migration/woo-to-shopify.js`
- SEO redirects: `migration/seo-redirects.js` → CSV imported via Shopify Admin

---

## 7. Information Architecture

### Navigation (Primary)

```
Gymdealen.se
├── Kondition
│   ├── Löpband
│   ├── Crosstrainers
│   └── Cyklar & Roddmaskiner
├── Styrka
│   ├── Styrketräning (maskiner)
│   ├── Kabelmaskiner
│   └── Fria vikter
├── Om oss
└── Kontakt
```

### URL Structure

| Page type | URL pattern |
|-----------|-------------|
| Homepage | `/` |
| Collection | `/collections/lopband` |
| Product | `/products/life-fitness-t5-lopband` |
| Page | `/pages/om-oss` |
| Cart | `/cart` |

---

## 8. Design Principles

1. **Premium but functional** — clean whitespace, strong typography, no clutter
2. **Used equipment confidence** — condition badges and specs prominently displayed to build trust
3. **Conversion-focused** — lease calculator + multiple payment options reduce purchase friction
4. **Mobile-first** — sidebar collapses to drawer, sticky CTA, thumb-friendly touch targets
5. **Performance** — no heavy JS frameworks, lazy-loaded images, minimal third-party scripts

---

## 9. Launch Checklist

- [ ] All 500 products imported with metafields and images
- [ ] URL redirects imported (all old WooCommerce URLs)
- [ ] Meta titles and descriptions set on all products
- [ ] Finanslaget widget configured and tested
- [ ] Klarna and Swish payment methods activated
- [ ] All 5 languages reviewed and approved
- [ ] Lighthouse score ≥ 90 on product page
- [ ] Google Search Console: old sitemap removed, new sitemap submitted
- [ ] GDPR cookie banner active
- [ ] Custom domain pointed to Shopify
- [ ] SSL certificate active (automatic on Shopify)
- [ ] Order confirmation emails customized with brand logo
