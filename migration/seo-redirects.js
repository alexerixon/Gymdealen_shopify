#!/usr/bin/env node
/**
 * seo-redirects.js
 * Gymdealen.se — WooCommerce → Shopify 301 Redirect Generator
 *
 * Usage:
 *   node seo-redirects.js --input woo-export.csv --output redirects.csv
 *
 * Output CSV format accepted by Shopify Admin → Navigation → URL Redirects → Import
 * Columns: Redirect from, Redirect to
 *
 * WooCommerce URL pattern: /product/product-slug/
 * Shopify URL pattern:     /products/product-slug
 *
 * After importing, verify redirects work with:
 *   curl -I https://gymdealen.se/product/old-slug/
 */

const fs = require('fs');
const { parse } = require('csv-parse/sync');
const { stringify } = require('csv-stringify/sync');

const ARGS = parseArgs(process.argv.slice(2));
const INPUT_FILE = ARGS['--input'] || 'woo-export.csv';
const OUTPUT_FILE = ARGS['--output'] || 'redirects.csv';

// Base URL of old WooCommerce site (adjust if URL structure differs)
const WOO_PRODUCT_BASE = '/product/';
// Shopify product URL base
const SHOPIFY_PRODUCT_BASE = '/products/';

// Additional static page redirects (WooCommerce → Shopify)
const STATIC_REDIRECTS = [
  // WooCommerce shop page → Shopify all collections
  ['/shop/', '/collections/all'],
  ['/shop', '/collections/all'],
  ['/butik/', '/collections/all'],
  ['/butik', '/collections/all'],
  // WooCommerce category pages → Shopify collections
  ['/product-category/lopband/', '/collections/lopband'],
  ['/product-category/cyklar/', '/collections/cyklar-roddmaskiner'],
  ['/product-category/crosstrainers/', '/collections/crosstrainers'],
  ['/product-category/styrketraning/', '/collections/styrketraning'],
  ['/product-category/kabelmaskiner/', '/collections/kabelmaskiner'],
  ['/product-category/fria-vikter/', '/collections/fria-vikter'],
  // Swedish slugs
  ['/produktkategori/lopband/', '/collections/lopband'],
  ['/produktkategori/cyklar/', '/collections/cyklar-roddmaskiner'],
  ['/produktkategori/crosstrainers/', '/collections/crosstrainers'],
  ['/produktkategori/styrketraning/', '/collections/styrketraning'],
  ['/produktkategori/styrketräning/', '/collections/styrketraning'],
  ['/produktkategori/kabelmaskiner/', '/collections/kabelmaskiner'],
  ['/produktkategori/fria-vikter/', '/collections/fria-vikter'],
  // Cart
  ['/checkout/', '/checkout'],
  ['/varukorg/', '/cart'],
  ['/cart/', '/cart'],
  // Contact / About
  ['/kontakt/', '/pages/kontakt'],
  ['/om-oss/', '/pages/om-oss'],
  ['/about/', '/pages/om-oss'],
];

function main() {
  const redirects = [['Redirect from', 'Redirect to']];

  // Add static page redirects
  for (const [from, to] of STATIC_REDIRECTS) {
    redirects.push([from, to]);
    // Also add version without trailing slash if it has one
    if (from.endsWith('/') && from.length > 1) {
      redirects.push([from.slice(0, -1), to]);
    }
  }

  // Add product redirects from WooCommerce export
  if (fs.existsSync(INPUT_FILE)) {
    console.log(`Reading WooCommerce export: ${INPUT_FILE}`);
    const raw = fs.readFileSync(INPUT_FILE, 'utf-8');

    let products;
    try {
      products = parse(raw, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        bom: true,
      });
    } catch (err) {
      console.error('CSV parse error:', err.message);
      process.exit(1);
    }

    let count = 0;
    for (const product of products) {
      // Skip variable parents
      if (product['type'] === 'variable') continue;

      const slug = extractSlug(product);
      if (!slug) continue;

      // WooCommerce URL → Shopify URL
      const fromUrl = `${WOO_PRODUCT_BASE}${slug}/`;
      const fromUrlNoSlash = `${WOO_PRODUCT_BASE}${slug}`;
      const toUrl = `${SHOPIFY_PRODUCT_BASE}${shopifySlug(slug)}`;

      redirects.push([fromUrl, toUrl]);
      redirects.push([fromUrlNoSlash, toUrl]);

      // Also handle /?p=123 permalink format (WP default)
      const postId = product['ID'] || product['id'] || product['post_id'];
      if (postId) {
        redirects.push([`/?p=${postId}`, toUrl]);
        redirects.push([`/?product_id=${postId}`, toUrl]);
      }

      count++;
    }

    console.log(`✓ Generated redirects for ${count} products`);
  } else {
    console.warn(`Warning: Input file not found (${INPUT_FILE}). Only static redirects will be generated.`);
    console.warn('Run with --input woo-export.csv to include product redirects.');
  }

  const csvOutput = stringify(redirects);
  fs.writeFileSync(OUTPUT_FILE, csvOutput, 'utf-8');

  console.log(`✓ Redirect CSV written: ${OUTPUT_FILE} (${redirects.length - 1} redirects)`);
  console.log('\nNext steps:');
  console.log('  1. Review redirects.csv');
  console.log('  2. Shopify Admin → Navigation → URL Redirects → Import CSV');
  console.log('  3. After go-live, test with: curl -I https://gymdealen.se/product/<old-slug>/');
  console.log('  4. Submit new sitemap in Google Search Console');
}

function extractSlug(product) {
  // Try different WooCommerce export column names for the slug
  return (
    product['post_name'] ||
    product['Slug'] ||
    product['slug'] ||
    product['URL slug'] ||
    slugify(product['Name'] || product['name'] || '')
  );
}

function shopifySlug(wooSlug) {
  // Shopify slugs are generally the same as WooCommerce slugs,
  // but we normalize just in case
  return wooSlug
    .toLowerCase()
    .replace(/å/g, 'a')
    .replace(/ä/g, 'a')
    .replace(/ö/g, 'o')
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function slugify(str) {
  return (str || '')
    .toLowerCase()
    .replace(/å/g, 'a')
    .replace(/ä/g, 'a')
    .replace(/ö/g, 'o')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) {
      args[argv[i]] = argv[i + 1] || true;
      i++;
    }
  }
  return args;
}

main();
