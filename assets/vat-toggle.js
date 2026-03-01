/**
 * assets/vat-toggle.js
 * Gymdealen.se — B2B / B2C VAT toggle
 *
 * Behaviour:
 *   - Reads/writes localStorage('vatMode') — 'incl' (default) or 'excl'
 *   - On 'excl': adds class body.vat-excl and updates all [data-price-incl] elements
 *   - Prices in Shopify are stored in öre (1/100 SEK) including 25% Swedish VAT
 *   - To convert incl → excl: price_excl = Math.round(price_incl / 1.25)
 *   - Notifies Finanslaget widget of the effective price via custom event
 */

(function () {
  'use strict';

  const STORAGE_KEY = 'vatMode';
  const VAT_RATE = 1.25; // 25% Swedish VAT

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  /**
   * Format öre (integer) as Swedish price string
   * e.g. 59900 → "599 kr" or with Shopify money format
   */
  function formatPrice(ore) {
    const sek = ore / 100;
    return sek.toLocaleString('sv-SE', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }) + ' kr';
  }

  /**
   * Return effective price in öre given vatMode
   */
  function effectivePrice(priceInclOre, mode) {
    if (mode === 'excl') {
      return Math.round(priceInclOre / VAT_RATE);
    }
    return priceInclOre;
  }

  // ---------------------------------------------------------------------------
  // Update all price elements in the DOM
  // ---------------------------------------------------------------------------

  function updatePrices(mode) {
    document.querySelectorAll('[data-price-incl]').forEach((el) => {
      const priceIncl = parseInt(el.dataset.priceIncl, 10);
      if (isNaN(priceIncl)) return;

      const price = effectivePrice(priceIncl, mode);
      el.textContent = formatPrice(price);
    });

    // Update VAT suffix labels
    document.querySelectorAll('.price-vat-label').forEach((el) => {
      // These labels have their text set via Liquid (t filter).
      // We toggle a data attribute so CSS can reflect the correct suffix.
      el.dataset.vatMode = mode;
    });

    // Notify Finanslaget of updated price (dispatched on the widget element)
    document.querySelectorAll('.finanslaget-widget').forEach((widget) => {
      const priceInclSek = parseFloat(widget.dataset.price);
      if (isNaN(priceInclSek)) return;

      const effectiveSek = mode === 'excl'
        ? Math.round((priceInclSek / VAT_RATE) * 100) / 100
        : priceInclSek;

      widget.dataset.effectivePrice = effectiveSek;

      // Update the fallback monthly estimate display
      const amountEl = widget.querySelector('[data-monthly-estimate]');
      if (amountEl) {
        const months = parseInt(widget.dataset.leaseMonths || '36', 10);
        amountEl.textContent = Math.ceil(effectiveSek / months) + ' kr';
      }

      // Also update product-card lease hints on collection pages
      // (handled separately below)

      widget.dispatchEvent(new CustomEvent('finanslaget:price-update', {
        bubbles: true,
        detail: { priceInclSek, effectiveSek, mode },
      }));
    });

    // Update product card lease hints
    document.querySelectorAll('[data-lease-hint]').forEach((el) => {
      const card = el.closest('[data-product-id]');
      if (!card) return;
      // The price element on this card
      const priceEl = card.querySelector('[data-price-incl]');
      if (!priceEl) return;
      const priceIncl = parseInt(priceEl.dataset.priceIncl, 10);
      const effectiveSek = effectivePrice(priceIncl, mode) / 100;
      const monthly = Math.ceil(effectiveSek / 36);
      // Preserve the "Från ca X kr/mån" structure
      el.textContent = el.textContent.replace(/\d[\d\s]*kr/, monthly + ' kr');
    });
  }

  // ---------------------------------------------------------------------------
  // Apply mode (set body class + aria states + update prices)
  // ---------------------------------------------------------------------------

  function applyMode(mode) {
    document.body.classList.toggle('vat-excl', mode === 'excl');

    document.querySelectorAll('[data-vat-toggle] .vat-toggle__btn, .vat-toggle__btn').forEach((btn) => {
      const isActive = btn.dataset.vat === mode;
      btn.setAttribute('aria-pressed', String(isActive));
      btn.classList.toggle('is-active', isActive);
    });

    updatePrices(mode);
  }

  // ---------------------------------------------------------------------------
  // Persist and read
  // ---------------------------------------------------------------------------

  function getMode() {
    try {
      return localStorage.getItem(STORAGE_KEY) || 'incl';
    } catch {
      return 'incl';
    }
  }

  function setMode(mode) {
    try {
      localStorage.setItem(STORAGE_KEY, mode);
    } catch { /* storage disabled */ }
    applyMode(mode);
  }

  // ---------------------------------------------------------------------------
  // Bind toggle buttons
  // ---------------------------------------------------------------------------

  function bindToggles() {
    document.querySelectorAll('.vat-toggle__btn').forEach((btn) => {
      btn.addEventListener('click', () => setMode(btn.dataset.vat));
    });
  }

  // ---------------------------------------------------------------------------
  // Init
  // ---------------------------------------------------------------------------

  function init() {
    bindToggles();
    applyMode(getMode());
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
