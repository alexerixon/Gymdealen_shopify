#!/usr/bin/env node
// Merges custom locale keys into Dawn's en.default.json and fixes sv locale files

const fs = require('fs');
const path = require('path');

function deepMerge(target, source) {
  const result = Object.assign({}, target);
  for (const key of Object.keys(source)) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      result[key] = deepMerge(target[key] || {}, source[key]);
    } else if (!(key in target)) {
      result[key] = source[key];
    }
  }
  return result;
}

// 1. Merge our English custom keys into Dawn's en.default.json
const enDefault = JSON.parse(fs.readFileSync('locales/en.default.json', 'utf8'));
const enCustom  = JSON.parse(fs.readFileSync('locales/en.json', 'utf8'));
const merged = deepMerge(enDefault, enCustom);
fs.writeFileSync('locales/en.default.json', JSON.stringify(merged, null, 2), 'utf8');
console.log('Merged en.json into en.default.json');

// 2. Replace Dawn sv.json with our full Swedish translations
const svDefault = JSON.parse(fs.readFileSync('locales/sv.default.json', 'utf8'));
fs.writeFileSync('locales/sv.json', JSON.stringify(svDefault, null, 2), 'utf8');
fs.unlinkSync('locales/sv.default.json');
console.log('Moved sv.default.json to sv.json');
