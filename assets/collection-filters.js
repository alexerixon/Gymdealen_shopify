/**
 * assets/collection-filters.js
 * Gymdealen.se — AJAX collection filtering + sorting
 *
 * Uses Shopify's Section Rendering API to update the product grid
 * without a full page reload, while keeping URLs bookmarkable via history.pushState.
 *
 * References:
 *   https://shopify.dev/docs/storefronts/themes/ajax-api/reference/section-rendering
 */

'use strict';

class CollectionFilters {
  constructor() {
    this.section = document.querySelector('.collection-page[data-section-id]');
    if (!this.section) return;

    this.sectionId = this.section.dataset.sectionId;
    this.grid = document.getElementById('product-grid');
    this.sidebar = document.getElementById('collection-sidebar');
    this.filterDrawerOverlay = document.querySelector('[data-filter-drawer-overlay]');

    this.isLoading = false;

    this.bindEvents();
  }

  // ---------------------------------------------------------------------------
  // Fetch updated section HTML from Shopify and update the grid
  // ---------------------------------------------------------------------------

  async fetchSection(url) {
    if (this.isLoading) return;
    this.isLoading = true;
    this.grid?.classList.add('product-grid--loading');

    const fetchUrl = `${url}${url.includes('?') ? '&' : '?'}sections=${this.sectionId}`;

    try {
      const response = await fetch(fetchUrl, {
        headers: { 'X-Requested-With': 'XMLHttpRequest' },
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data = await response.json();
      const html = data[this.sectionId];

      if (html) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        // Update product grid
        const newGrid = doc.getElementById('product-grid');
        if (newGrid && this.grid) {
          this.grid.innerHTML = newGrid.innerHTML;
        }

        // Update sidebar (filter counts, active states)
        const newSidebar = doc.getElementById('collection-sidebar');
        if (newSidebar && this.sidebar) {
          this.sidebar.innerHTML = newSidebar.innerHTML;
          this.bindFilterEvents(); // re-bind events on new sidebar content
        }

        // Update product count text
        const newToolbar = doc.querySelector('.collection-page__toolbar');
        const oldToolbar = document.querySelector('.collection-page__toolbar');
        if (newToolbar && oldToolbar) {
          oldToolbar.innerHTML = newToolbar.innerHTML;
        }
      }

      // Update the browser URL without page reload
      history.pushState({}, '', url);

    } catch (err) {
      console.error('Filter fetch error:', err);
    } finally {
      this.isLoading = false;
      this.grid?.classList.remove('product-grid--loading');
    }
  }

  // ---------------------------------------------------------------------------
  // Build URL from current filter form state
  // ---------------------------------------------------------------------------

  buildUrlFromFilters() {
    const params = new URLSearchParams();

    // Collect all checked filter checkboxes
    document.querySelectorAll('[data-filter-checkbox]:checked').forEach((checkbox) => {
      params.append(checkbox.name, checkbox.value);
    });

    // Price range
    const priceMin = document.querySelector('[data-price-min]');
    const priceMax = document.querySelector('[data-price-max]');
    if (priceMin?.value) params.set(priceMin.name, priceMin.value * 100); // convert to öre
    if (priceMax?.value) params.set(priceMax.name, priceMax.value * 100);

    // Sort
    const sortSelect = document.querySelector('.sort-select');
    if (sortSelect?.value) params.set('sort_by', sortSelect.value);

    const baseUrl = window.location.pathname;
    const qs = params.toString();
    return qs ? `${baseUrl}?${qs}` : baseUrl;
  }

  // ---------------------------------------------------------------------------
  // Filter drawer (mobile)
  // ---------------------------------------------------------------------------

  openFilterDrawer() {
    this.sidebar?.classList.add('is-open');
    this.filterDrawerOverlay?.classList.add('is-visible');
    document.body.style.overflow = 'hidden';
  }

  closeFilterDrawer() {
    this.sidebar?.classList.remove('is-open');
    this.filterDrawerOverlay?.classList.remove('is-visible');
    document.body.style.overflow = '';
  }

  // ---------------------------------------------------------------------------
  // Bind events
  // ---------------------------------------------------------------------------

  bindFilterEvents() {
    // Filter checkboxes → immediate AJAX fetch
    document.querySelectorAll('[data-filter-checkbox]').forEach((checkbox) => {
      checkbox.addEventListener('change', () => {
        const url = this.buildUrlFromFilters();
        this.fetchSection(url);
      });
    });

    // Price range — fetch on Apply button click
    document.querySelectorAll('[data-price-range] button').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const url = this.buildUrlFromFilters();
        this.fetchSection(url);
      });
    });
  }

  bindEvents() {
    this.bindFilterEvents();

    // Sort select → AJAX fetch
    document.addEventListener('change', (e) => {
      if (e.target.classList.contains('sort-select')) {
        const url = this.buildUrlFromFilters();
        this.fetchSection(url);
      }
    });

    // Mobile filter drawer open/close
    document.querySelector('[data-filter-drawer-toggle]')?.addEventListener('click', () => {
      this.openFilterDrawer();
    });

    this.filterDrawerOverlay?.addEventListener('click', () => this.closeFilterDrawer());

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.sidebar?.classList.contains('is-open')) {
        this.closeFilterDrawer();
      }
    });

    // Handle browser back/forward navigation
    window.addEventListener('popstate', () => {
      this.fetchSection(window.location.href);
    });
  }
}

// =============================================================================
// Sort-by select (standalone, used outside filter context too)
// =============================================================================

class SortBy {
  constructor() {
    document.querySelectorAll('.sort-select').forEach((select) => {
      // Set initial value from URL
      const params = new URLSearchParams(window.location.search);
      const sortBy = params.get('sort_by');
      if (sortBy) select.value = sortBy;
    });
  }
}

// =============================================================================
// Init
// =============================================================================

document.addEventListener('DOMContentLoaded', () => {
  new CollectionFilters();
  new SortBy();
});
