#!/usr/bin/env node
/**
 * woo-to-shopify.js
 * Gymdealen — converts product_export.csv (WooCommerce Swedish export)
 * into a Shopify product import CSV.
 *
 * Input columns:  Namn, Publicerad, Kort beskrivning, Ordinarie pris, Kategorier
 * Output:         migration/shopify-import.csv
 * Usage:          node migration/woo-to-shopify.js
 */

const fs = require('fs');

// ---------------------------------------------------------------------------
// Category → collection handle (used as primary tag for smart collections)
// ---------------------------------------------------------------------------
const CAT_TO_COLLECTION = {
  'Kondition > Löpband':                        'lopband',
  'Kondition > Crosstrainer':                   'crosstrainers',
  'Kondition > Motionscykel':                   'cyklar-roddmaskiner',
  'Kabelmaskiner':                              'kabelmaskiner',
  'Kabelmaskiner > Cable cross':                'kabelmaskiner',
  'Kabelmaskiner > Multistationer':             'kabelmaskiner',
  'Styrkemaskiner':                             'styrketraning',
  'Styrkemaskiner > Axelpress':                 'styrketraning',
  'Styrkemaskiner > Benpress':                  'styrketraning',
  'Styrkemaskiner > Benspark':                  'styrketraning',
  'Styrkemaskiner > Bröstpress':                'styrketraning',
  'Styrkemaskiner > Cable cross':               'kabelmaskiner',
  'Friviktsmaskiner':                           'styrketraning',
  'Friviktsmaskiner > Friviktsmaskiner ben':    'styrketraning',
  'Friviktsmaskiner > Friviktsmaskiner överkropp': 'styrketraning',
  'Friviktsmaskiner > Friviktsmaskiner övrigt': 'styrketraning',
  'Viktmagasinsmaskiner':                       'styrketraning',
  'Viktmagasinsmaskiner > Viktmagasinsmaskiner Benmaskiner':  'styrketraning',
  'Viktmagasinsmaskiner > Viktmagasinsmaskiner överkropp':    'styrketraning',
  'Viktmagasinsmaskiner > Viktmagasinsmaskiner Övrig':        'styrketraning',
  'Fria vikter':                                'fria-vikter',
  'Fria vikter > Hantlar':                      'fria-vikter',
  'Fria vikter > Skivstänger':                  'fria-vikter',
  'Fria vikter > Viktpaket':                    'fria-vikter',
  'Fria vikter > hantelset':                    'fria-vikter',
  'Hela serier':                                'hela-serier',
  'Övrigt':                                     'ovrigt',
  'Övrigt > Golv':                              'ovrigt',
  'Övrigt > Rack':                              'ovrigt',
  'Övrigt > Smithmaskin':                       'ovrigt',
  'Övrigt > Övriga':                            'ovrigt',
};

const COLLECTION_TO_TYPE = {
  'lopband':             'Löpband',
  'crosstrainers':       'Crosstrainer',
  'cyklar-roddmaskiner': 'Motionscykel',
  'kabelmaskiner':       'Kabelmaskin',
  'styrketraning':       'Styrkemaskin',
  'fria-vikter':         'Fria vikter',
  'hela-serier':         'Hela serier',
  'ovrigt':              'Övrigt',
};

const KNOWN_BRANDS = [
  'Life Fitness', 'Technogym', 'Precor', 'Matrix', 'Cybex',
  'StarTrac', 'Hammer Strength', 'Nautilus', 'Concept2',
  'Kettler', 'BH Fitness', 'Spirit', 'Sole', 'NordicTrack',
  'Impulse', 'Panatta', 'Stairmaster', 'Assault', 'Rogue',
  'Eleiko', 'Gym80', 'Technogym', 'Torque', 'Keiser',
  'Indoor', 'Schwinn', 'Bowflex',
];

// ---------------------------------------------------------------------------
// CSV helpers (no npm deps)
// ---------------------------------------------------------------------------

function parseCSV(text) {
  const rows = [];
  const lines = text.split('\n');
  let i = 0;
  while (i < lines.length) {
    let line = lines[i];
    while ((line.match(/"/g) || []).length % 2 !== 0 && i + 1 < lines.length) {
      i++;
      line += '\n' + lines[i];
    }
    if (line.trim()) rows.push(parseLine(line));
    i++;
  }
  return rows;
}

function parseLine(line) {
  const cells = [];
  let cur = '', inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
      else inQ = !inQ;
    } else if (c === ',' && !inQ) {
      cells.push(cur); cur = '';
    } else {
      cur += c;
    }
  }
  cells.push(cur);
  return cells;
}

function csvEscape(val) {
  const s = val === null || val === undefined ? '' : String(val);
  return (s.includes(',') || s.includes('"') || s.includes('\n'))
    ? '"' + s.replace(/"/g, '""') + '"'
    : s;
}

function toCSVRow(obj, headers) {
  return headers.map(h => csvEscape(obj[h] ?? '')).join(',');
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function slugify(str) {
  return (str || '')
    .toLowerCase()
    .replace(/å/g, 'a').replace(/ä/g, 'a').replace(/ö/g, 'o')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function getCollection(categories) {
  for (const [cat, handle] of Object.entries(CAT_TO_COLLECTION)) {
    if (categories.includes(cat)) return handle;
  }
  return 'ovrigt';
}

function extractBrand(title, categories) {
  // Best source: "Märken > BrandName" category
  for (const cat of categories) {
    const m = cat.match(/^Märken > (.+)$/);
    if (m) return m[1].trim();
  }
  // Known brand in title
  for (const brand of KNOWN_BRANDS) {
    if (title.toLowerCase().includes(brand.toLowerCase())) return brand;
  }
  return '';
}

function stripHtml(html) {
  return (html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const HEADERS = [
  'Handle', 'Title', 'Body (HTML)', 'Vendor', 'Type', 'Tags', 'Published',
  'Option1 Name', 'Option1 Value',
  'Variant SKU', 'Variant Inventory Policy', 'Variant Fulfillment Service',
  'Variant Price', 'Variant Requires Shipping', 'Variant Taxable',
  'Gift Card', 'SEO Title', 'SEO Description', 'Status',
  'Metafield: custom.brand [single_line_text_field]',
];

function main() {
  const inputFile  = 'product_export.csv';
  const outputFile = 'migration/shopify-import.csv';

  if (!fs.existsSync(inputFile)) {
    console.error('Error: product_export.csv not found in', process.cwd());
    process.exit(1);
  }

  const raw  = fs.readFileSync(inputFile, 'utf-8').replace(/^\uFEFF/, '');
  const rows = parseCSV(raw);
  const colNames = rows[0]; // ['Namn', 'Publicerad', 'Kort beskrivning', 'Ordinarie pris', 'Kategorier']
  const dataRows = rows.slice(1).filter(r => r.length >= colNames.length && r[0]);

  console.log(`Parsed ${dataRows.length} products from ${inputFile}`);

  const toObj = row => Object.fromEntries(colNames.map((h, i) => [h, (row[i] || '').trim()]));

  const usedHandles = new Set();
  const output = [HEADERS.join(',')];
  let count = 0;

  for (const row of dataRows) {
    const p = toObj(row);
    const title = p['Namn'];
    if (!title) continue;

    const categories = p['Kategorier'].split(',').map(c => c.trim()).filter(Boolean);
    const collection = getCollection(categories);
    const type       = COLLECTION_TO_TYPE[collection] || 'Gymutrustning';
    const brand      = extractBrand(title, categories);
    const price      = parseFloat(p['Ordinarie pris']) || 0;
    const published  = p['Publicerad'] === '1';

    // Tags: collection handle + meaningful subcategory slugs + brand + begagnat
    const tagSet = new Set(['begagnat', collection]);
    for (const cat of categories) {
      if (['Alla', 'Märken', 'Uncategorized', 'Kondition'].includes(cat)) continue;
      if (cat.startsWith('Märken >')) continue;
      tagSet.add(slugify(cat));
    }
    if (brand) tagSet.add(slugify(brand));
    const tags = [...tagSet].join(', ');

    // Unique URL handle
    let handle = slugify(title);
    let candidate = handle;
    let n = 1;
    while (usedHandles.has(candidate)) candidate = `${handle}-${++n}`;
    usedHandles.add(candidate);

    const seoDesc = stripHtml(p['Kort beskrivning']).slice(0, 320);

    const product = {
      'Handle':                      candidate,
      'Title':                       title,
      'Body (HTML)':                 p['Kort beskrivning'],
      'Vendor':                      brand || 'Gymdealen',
      'Type':                        type,
      'Tags':                        tags,
      'Published':                   published ? 'TRUE' : 'FALSE',
      'Option1 Name':                'Title',
      'Option1 Value':               'Default Title',
      'Variant SKU':                 '',
      'Variant Inventory Policy':    'deny',
      'Variant Fulfillment Service': 'manual',
      'Variant Price':               price.toFixed(2),
      'Variant Requires Shipping':   'TRUE',
      'Variant Taxable':             'TRUE',
      'Gift Card':                   'FALSE',
      'SEO Title':                   title,
      'SEO Description':             seoDesc,
      'Status':                      published ? 'active' : 'draft',
      'Metafield: custom.brand [single_line_text_field]': brand,
    };

    output.push(toCSVRow(product, HEADERS));
    count++;
  }

  fs.writeFileSync(outputFile, output.join('\n'), 'utf-8');
  console.log(`✓ ${count} products written to ${outputFile}`);
  console.log('\nNext: Shopify Admin → Products → Import → upload migration/shopify-import.csv');
  console.log('      Check "Overwrite products with matching handles" if re-importing.');
}

main();
