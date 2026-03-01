#!/usr/bin/env node
/**
 * woo-to-shopify.js
 * Gymdealen.se — WooCommerce to Shopify Product Migration Script
 *
 * Usage:
 *   node woo-to-shopify.js --input woo-export.csv --output shopify-products.csv
 *
 * Input:  WooCommerce product export CSV (exported from WP Admin → Products → Export)
 * Output: Shopify product import CSV (import via Shopify Admin → Products → Import)
 *
 * Shopify product CSV columns:
 *   https://help.shopify.com/en/manual/products/import-export/using-csv
 */

const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');
const { stringify } = require('csv-stringify/sync');

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const ARGS = parseArgs(process.argv.slice(2));
const INPUT_FILE = ARGS['--input'] || 'woo-export.csv';
const OUTPUT_FILE = ARGS['--output'] || 'shopify-products.csv';
const VENDOR_NAME = 'Gymdealen';

// WooCommerce category → Shopify collection handle mapping
const CATEGORY_MAP = {
  'lopband': 'lopband',
  'löpband': 'lopband',
  'treadmills': 'lopband',
  'cyklar': 'cyklar-roddmaskiner',
  'bikes': 'cyklar-roddmaskiner',
  'roddmaskiner': 'cyklar-roddmaskiner',
  'rowers': 'cyklar-roddmaskiner',
  'crosstrainers': 'crosstrainers',
  'elliptical': 'crosstrainers',
  'styrketraning': 'styrketraning',
  'styrketräning': 'styrketraning',
  'strength': 'styrketraning',
  'kabelmaskiner': 'kabelmaskiner',
  'cable machines': 'kabelmaskiner',
  'fria vikter': 'fria-vikter',
  'free weights': 'fria-vikter',
};

// Shopify CSV column headers (in required order)
const SHOPIFY_HEADERS = [
  'Handle',
  'Title',
  'Body (HTML)',
  'Vendor',
  'Product Category',
  'Type',
  'Tags',
  'Published',
  'Option1 Name',
  'Option1 Value',
  'Variant SKU',
  'Variant Grams',
  'Variant Inventory Tracker',
  'Variant Inventory Qty',
  'Variant Inventory Policy',
  'Variant Fulfillment Service',
  'Variant Price',
  'Variant Compare At Price',
  'Variant Requires Shipping',
  'Variant Taxable',
  'Variant Barcode',
  'Image Src',
  'Image Position',
  'Image Alt Text',
  'Gift Card',
  'SEO Title',
  'SEO Description',
  'Google Shopping / Google Product Category',
  'Google Shopping / Gender',
  'Google Shopping / Age Group',
  'Google Shopping / MPN',
  'Google Shopping / Condition',
  'Variant Image',
  'Variant Weight Unit',
  'Variant Tax Code',
  'Cost per item',
  'Status',
  // Metafields
  'Metafield: custom.condition [single_line_text_field]',
  'Metafield: custom.brand [single_line_text_field]',
  'Metafield: custom.year_of_manufacture [number_integer]',
  'Metafield: custom.weight_kg [number_decimal]',
  'Metafield: custom.max_user_weight_kg [number_decimal]',
  'Metafield: custom.power_requirement [single_line_text_field]',
];

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  if (!fs.existsSync(INPUT_FILE)) {
    console.error(`Error: Input file not found: ${INPUT_FILE}`);
    console.error('Export products from WooCommerce: WP Admin → Products → Export all products');
    process.exit(1);
  }

  console.log(`Reading WooCommerce export: ${INPUT_FILE}`);
  const raw = fs.readFileSync(INPUT_FILE, 'utf-8');

  let wooProducts;
  try {
    wooProducts = parse(raw, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      bom: true,
    });
  } catch (err) {
    console.error('CSV parse error:', err.message);
    process.exit(1);
  }

  console.log(`Found ${wooProducts.length} WooCommerce products`);

  const shopifyRows = [];

  for (const woo of wooProducts) {
    // Skip variable product parents — they have no price
    if (woo.type === 'variable') continue;

    const rows = transformProduct(woo);
    shopifyRows.push(...rows);
  }

  const csvOutput = stringify(shopifyRows, {
    header: true,
    columns: SHOPIFY_HEADERS,
  });

  fs.writeFileSync(OUTPUT_FILE, csvOutput, 'utf-8');
  console.log(`✓ Shopify CSV written: ${OUTPUT_FILE} (${shopifyRows.length} rows)`);
  console.log('\nNext steps:');
  console.log('  1. Review the CSV for accuracy');
  console.log('  2. Shopify Admin → Products → Import → Upload CSV');
  console.log('  3. Verify metafields are mapped correctly in Shopify Admin → Custom Data');
}

// ---------------------------------------------------------------------------
// Transform a single WooCommerce product row → one or more Shopify CSV rows
// ---------------------------------------------------------------------------

function transformProduct(woo) {
  const handle = slugify(woo['Name'] || woo['post_name'] || woo['ID']);
  const title = woo['Name'] || '';
  const bodyHtml = woo['Description'] || woo['Short description'] || '';
  const sku = woo['SKU'] || '';
  const price = parsePrice(woo['Regular price'] || woo['Sale price'] || woo['Price'] || '0');
  const compareAtPrice = parsePrice(woo['Regular price'] || '');
  const salePrice = parsePrice(woo['Sale price'] || '');
  const finalPrice = salePrice > 0 ? salePrice : price;
  const finalCompareAt = salePrice > 0 && price > 0 ? price : '';

  const tags = buildTags(woo);
  const categories = (woo['Categories'] || woo['category'] || '').split(',').map(c => c.trim());
  const collectionHandle = mapCategory(categories);
  const type = mapType(categories);

  const imageUrls = parseImages(woo);
  const seoTitle = woo['Meta: _yoast_wpseo_title'] || woo['SEO Title'] || title;
  const seoDesc = woo['Meta: _yoast_wpseo_metadesc'] || woo['SEO Description'] || '';

  // Extract custom gym equipment metafields
  const condition = mapCondition(woo['Meta: _condition'] || woo['Condition'] || tags);
  const brand = woo['Meta: _brand'] || woo['Brand'] || extractBrand(title);
  const yearOfMfr = woo['Meta: _year_of_manufacture'] || woo['Year'] || '';
  const weightKg = parseFloat(woo['Weight (kg)'] || woo['Weight'] || '') || '';
  const maxUserWeight = woo['Meta: _max_user_weight_kg'] || '';
  const powerReq = woo['Meta: _power_requirement'] || '';

  const baseRow = {
    'Handle': handle,
    'Title': title,
    'Body (HTML)': bodyHtml,
    'Vendor': brand || VENDOR_NAME,
    'Product Category': collectionHandle,
    'Type': type,
    'Tags': tags,
    'Published': 'TRUE',
    'Option1 Name': 'Title',
    'Option1 Value': 'Default Title',
    'Variant SKU': sku,
    'Variant Grams': weightKg ? String(Math.round(weightKg * 1000)) : '',
    'Variant Inventory Tracker': 'shopify',
    'Variant Inventory Qty': woo['Stock'] || woo['Quantity'] || '1',
    'Variant Inventory Policy': 'deny',
    'Variant Fulfillment Service': 'manual',
    'Variant Price': String(finalPrice),
    'Variant Compare At Price': String(finalCompareAt),
    'Variant Requires Shipping': 'TRUE',
    'Variant Taxable': 'TRUE',
    'Variant Barcode': woo['GTIN, UPC, EAN, or ISBN'] || '',
    'Image Src': imageUrls[0] || '',
    'Image Position': '1',
    'Image Alt Text': title,
    'Gift Card': 'FALSE',
    'SEO Title': seoTitle,
    'SEO Description': seoDesc,
    'Google Shopping / Google Product Category': '',
    'Google Shopping / Gender': '',
    'Google Shopping / Age Group': '',
    'Google Shopping / MPN': sku,
    'Google Shopping / Condition': 'used',
    'Variant Image': '',
    'Variant Weight Unit': 'kg',
    'Variant Tax Code': '',
    'Cost per item': '',
    'Status': 'active',
    'Metafield: custom.condition [single_line_text_field]': condition,
    'Metafield: custom.brand [single_line_text_field]': brand,
    'Metafield: custom.year_of_manufacture [number_integer]': String(yearOfMfr),
    'Metafield: custom.weight_kg [number_decimal]': String(weightKg),
    'Metafield: custom.max_user_weight_kg [number_decimal]': String(maxUserWeight),
    'Metafield: custom.power_requirement [single_line_text_field]': powerReq,
  };

  const rows = [baseRow];

  // Additional images (image rows have only Handle + Image columns)
  for (let i = 1; i < imageUrls.length; i++) {
    rows.push({
      'Handle': handle,
      'Image Src': imageUrls[i],
      'Image Position': String(i + 1),
      'Image Alt Text': `${title} - bild ${i + 1}`,
    });
  }

  return rows;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function slugify(str) {
  return (str || '')
    .toLowerCase()
    .replace(/å/g, 'a')
    .replace(/ä/g, 'a')
    .replace(/ö/g, 'o')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function parsePrice(str) {
  const num = parseFloat((str || '').replace(/[^\d.,]/g, '').replace(',', '.'));
  return isNaN(num) ? 0 : num;
}

function parseImages(woo) {
  const mainImage = woo['Images'] || woo['Image URL'] || woo['image_url'] || '';
  const galleryImages = woo['Gallery Image URLs'] || woo['gallery_image_urls'] || '';
  const all = [mainImage, ...galleryImages.split(',')]
    .map(u => u.trim())
    .filter(Boolean);
  return [...new Set(all)]; // deduplicate
}

function buildTags(woo) {
  const tags = new Set();

  // Tags from WooCommerce
  const wooTags = (woo['Tags'] || woo['tag'] || '').split(',').map(t => t.trim()).filter(Boolean);
  wooTags.forEach(t => tags.add(t));

  // Categories as tags
  const cats = (woo['Categories'] || woo['category'] || '').split(',').map(c => c.trim()).filter(Boolean);
  cats.forEach(c => tags.add(c));

  // Add "begagnat" (used equipment) tag universally
  tags.add('begagnat');
  tags.add('gymmaskin');

  return [...tags].join(', ');
}

function mapCategory(categories) {
  for (const cat of categories) {
    const key = cat.toLowerCase().trim();
    if (CATEGORY_MAP[key]) return CATEGORY_MAP[key];
    // Partial match
    for (const [k, v] of Object.entries(CATEGORY_MAP)) {
      if (key.includes(k) || k.includes(key)) return v;
    }
  }
  return 'ovrigt'; // fallback collection
}

function mapType(categories) {
  const handle = mapCategory(categories);
  const typeMap = {
    'lopband': 'Löpband',
    'cyklar-roddmaskiner': 'Cyklar & Roddmaskiner',
    'crosstrainers': 'Crosstrainers',
    'styrketraning': 'Styrketräning',
    'kabelmaskiner': 'Kabelmaskiner',
    'fria-vikter': 'Fria vikter',
  };
  return typeMap[handle] || 'Gymutrustning';
}

function mapCondition(value) {
  if (!value) return '';
  const v = value.toLowerCase();
  if (v.includes('utmärkt') || v.includes('excellent') || v.includes('utm')) return 'Utmärkt';
  if (v.includes('mycket bra') || v.includes('very good')) return 'Mycket bra';
  if (v.includes('bra') || v.includes('good')) return 'Bra';
  return value; // pass through if unknown
}

function extractBrand(title) {
  const knownBrands = [
    'Life Fitness', 'Technogym', 'Precor', 'Matrix', 'Cybex',
    'StarTrac', 'Hammer Strength', 'Nautilus', 'Concept2',
    'Kettler', 'BH Fitness', 'Spirit', 'Sole', 'NordicTrack',
  ];
  for (const brand of knownBrands) {
    if (title.toLowerCase().includes(brand.toLowerCase())) return brand;
  }
  return '';
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

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

main();
