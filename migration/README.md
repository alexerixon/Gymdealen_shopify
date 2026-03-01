# Gymdealen.se — Migration Tooling

This folder contains scripts for migrating from WooCommerce to Shopify.
These files are **not** part of the Shopify theme and should not be uploaded to Shopify.

---

## Prerequisites

```bash
npm install csv-parse csv-stringify
```

---

## Step 1: Export from WooCommerce

1. Log into WordPress Admin
2. Go to **Products → Export**
3. Select "All products", check all columns, export as CSV
4. Save the file as `woo-export.csv` in this folder

---

## Step 2: Generate Shopify Product CSV

```bash
node woo-to-shopify.js --input woo-export.csv --output shopify-products.csv
```

This transforms the WooCommerce export into Shopify's import format, including:
- Product titles, descriptions (HTML), prices
- SKUs, stock quantities
- Images (by URL — Shopify will fetch them)
- Tags and collections
- Custom metafields (condition, brand, year, weight, power)
- SEO title and meta description (from Yoast SEO columns if present)

**Review `shopify-products.csv` before importing!**

Then import via: **Shopify Admin → Products → Import → Upload CSV**

---

## Step 3: Generate 301 Redirect CSV

```bash
node seo-redirects.js --input woo-export.csv --output redirects.csv
```

This generates a CSV of URL redirects for all ~500 products:
- `/product/old-slug/` → `/products/new-slug`
- `/product/old-slug` → `/products/new-slug` (no trailing slash variant)
- `/?p=123` → `/products/new-slug` (WordPress numeric permalink)
- Static page redirects (shop, categories, cart, contact)

**Import via: Shopify Admin → Navigation → URL Redirects → Import CSV**

---

## Step 4: After Go-Live

1. **Verify redirects:** `curl -I https://gymdealen.se/product/old-product-slug/`
   - Should return `HTTP/2 301` with `Location: https://gymdealen.se/products/new-slug`

2. **Submit sitemap:** Google Search Console → Sitemaps → `https://gymdealen.se/sitemap.xml`

3. **Remove old sitemap:** Delete the WooCommerce sitemap URL from Search Console if it was submitted previously

4. **Monitor:** Watch for crawl errors in Search Console for 4–6 weeks after launch

---

## Column Mapping Reference

| WooCommerce column | Shopify column |
|-------------------|----------------|
| Name | Title |
| Description | Body (HTML) |
| Regular price | Variant Price |
| Sale price | Variant Compare At Price |
| SKU | Variant SKU |
| Categories | Tags, Type, Product Category |
| Images | Image Src (+ additional image rows) |
| Meta: _yoast_wpseo_title | SEO Title |
| Meta: _yoast_wpseo_metadesc | SEO Description |
| Weight (kg) | Variant Grams (× 1000) |
| Stock | Variant Inventory Qty |
| Meta: _condition | Metafield: custom.condition |
| Meta: _brand | Metafield: custom.brand |
| Meta: _year_of_manufacture | Metafield: custom.year_of_manufacture |
| Meta: _power_requirement | Metafield: custom.power_requirement |
