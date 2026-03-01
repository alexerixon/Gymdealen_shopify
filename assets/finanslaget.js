/**
 * assets/finanslaget.js
 * Gymdealen.se — Finanslaget lease widget integration
 *
 * Responsibilities:
 *   1. Initialize Finanslaget embed widget if embed code is present (passes price)
 *   2. React to vat-toggle price updates (recalculate monthly estimate)
 *   3. Expose a global GymdealenFinanslaget API for future direct API integration
 *
 * When Finanslaget provides their official widget/API:
 *   - Replace the placeholder init logic with the real SDK call
 *   - The data-price and data-effective-price attributes will carry the correct price
 */

(function () {
  'use strict';

  // ---------------------------------------------------------------------------
  // Finanslaget embed initialization
  // Finanslaget's widget script (if they provide one) typically looks for
  // a container element with the price data and initializes itself.
  // We ensure the price is set before their script runs.
  // ---------------------------------------------------------------------------

  function initWidget(widget) {
    const priceEl = widget.querySelector('[data-monthly-estimate]');
    const embedEl = widget.querySelector('.finanslaget-widget__embed');

    // If there's an embed, pass price to it via a global config or data attr.
    // The actual integration depends on Finanslaget's documentation.
    if (embedEl) {
      const price = parseFloat(widget.dataset.effectivePrice || widget.dataset.price || '0');
      // Set on embed container so Finanslaget JS can find it
      embedEl.dataset.financiableAmount = price;
      embedEl.dataset.currency = 'SEK';

      // If Finanslaget exposes a global init function, call it here:
      if (typeof window.FinanslagetWidget?.init === 'function') {
        window.FinanslagetWidget.init(embedEl, { amount: price, currency: 'SEK' });
      }
    }
  }

  // ---------------------------------------------------------------------------
  // React to VAT mode changes (dispatched by vat-toggle.js)
  // ---------------------------------------------------------------------------

  document.addEventListener('finanslaget:price-update', (e) => {
    const widget = e.target;
    if (!widget?.classList.contains('finanslaget-widget')) return;

    // Re-initialize with the updated effective price
    initWidget(widget);
  });

  // ---------------------------------------------------------------------------
  // Initialize all widgets on page load
  // ---------------------------------------------------------------------------

  function init() {
    document.querySelectorAll('.finanslaget-widget').forEach((widget) => {
      initWidget(widget);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // ---------------------------------------------------------------------------
  // Public API (for future direct Finanslaget API integration)
  // ---------------------------------------------------------------------------

  window.GymdealenFinanslaget = {
    /**
     * Update all widgets with a new price (SEK, including VAT)
     * @param {number} priceSek - price in SEK (e.g. 25000)
     */
    updatePrice(priceSek) {
      document.querySelectorAll('.finanslaget-widget').forEach((widget) => {
        widget.dataset.price = priceSek;
        initWidget(widget);
      });
    },

    /**
     * Get the current effective price from the first widget
     * @returns {number} price in SEK
     */
    getEffectivePrice() {
      const widget = document.querySelector('.finanslaget-widget');
      return parseFloat(widget?.dataset.effectivePrice || widget?.dataset.price || '0');
    },
  };
})();
