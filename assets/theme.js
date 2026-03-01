/**
 * assets/theme.js
 * Gymdealen.se — Core theme JavaScript
 * Handles: mobile menu, search toggle, image gallery, quantity selector, cart drawer
 */

'use strict';

// =============================================================================
// Mobile menu
// =============================================================================

class MobileMenu {
  constructor() {
    this.menu = document.getElementById('mobile-menu');
    this.overlay = document.querySelector('[data-mobile-menu-overlay]');
    this.toggle = document.querySelector('[data-mobile-menu-toggle]') ||
                  document.querySelector('.site-header__mobile-menu-toggle');
    this.close = document.querySelector('[data-mobile-menu-close]');

    if (!this.menu) return;
    this.bindEvents();
  }

  open() {
    this.menu.classList.add('is-open');
    this.menu.removeAttribute('aria-hidden');
    this.overlay?.classList.add('is-visible');
    this.toggle?.setAttribute('aria-expanded', 'true');
    document.body.style.overflow = 'hidden';
  }

  close_() {
    this.menu.classList.remove('is-open');
    this.menu.setAttribute('aria-hidden', 'true');
    this.overlay?.classList.remove('is-visible');
    this.toggle?.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
  }

  bindEvents() {
    this.toggle?.addEventListener('click', () => this.open());
    this.close?.addEventListener('click', () => this.close_());
    this.overlay?.addEventListener('click', () => this.close_());

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.menu.classList.contains('is-open')) {
        this.close_();
      }
    });
  }
}

// =============================================================================
// Search bar toggle
// =============================================================================

class SearchToggle {
  constructor() {
    this.toggle = document.querySelector('[data-search-toggle]');
    this.bar = document.getElementById('search-bar');
    if (!this.toggle || !this.bar) return;
    this.bindEvents();
  }

  bindEvents() {
    this.toggle.addEventListener('click', () => {
      const isHidden = this.bar.hasAttribute('hidden');
      if (isHidden) {
        this.bar.removeAttribute('hidden');
        this.bar.querySelector('input')?.focus();
      } else {
        this.bar.setAttribute('hidden', '');
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !this.bar.hasAttribute('hidden')) {
        this.bar.setAttribute('hidden', '');
        this.toggle.focus();
      }
    });
  }
}

// =============================================================================
// Product image gallery
// =============================================================================

class ProductGallery {
  constructor() {
    this.main = document.getElementById('product-gallery-main');
    this.thumbs = document.getElementById('product-gallery-thumbs');
    if (!this.main) return;
    this.bindEvents();
  }

  showSlide(mediaId) {
    this.main.querySelectorAll('.product-gallery__slide').forEach((slide) => {
      slide.classList.toggle('is-active', slide.dataset.mediaId === mediaId);
    });
    this.thumbs?.querySelectorAll('.product-gallery__thumb').forEach((thumb) => {
      thumb.classList.toggle('is-active', thumb.dataset.mediaId === mediaId);
    });
  }

  bindEvents() {
    this.thumbs?.querySelectorAll('.product-gallery__thumb').forEach((thumb) => {
      thumb.addEventListener('click', () => this.showSlide(thumb.dataset.mediaId));
    });

    // Keyboard navigation on thumbs
    this.thumbs?.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        const thumbs = [...this.thumbs.querySelectorAll('.product-gallery__thumb')];
        const current = thumbs.findIndex((t) => t.classList.contains('is-active'));
        const next = e.key === 'ArrowRight'
          ? (current + 1) % thumbs.length
          : (current - 1 + thumbs.length) % thumbs.length;
        thumbs[next]?.click();
        thumbs[next]?.focus();
      }
    });
  }
}

// =============================================================================
// Quantity selector
// =============================================================================

class QuantitySelector {
  constructor() {
    document.querySelectorAll('[data-qty-change]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const delta = parseInt(btn.dataset.qtyChange, 10);
        const input = btn.closest('.quantity-selector')?.querySelector('.quantity-selector__input');
        if (!input) return;
        const newVal = Math.max(1, parseInt(input.value, 10) + delta);
        input.value = newVal;
      });
    });
  }
}

// =============================================================================
// Add to cart (AJAX)
// =============================================================================

class CartHandler {
  constructor() {
    this.form = document.querySelector('.product-form');
    this.cartCount = document.querySelector('[data-cart-count]');
    this.cartToggle = document.querySelector('[data-cart-toggle]');
    this.drawer = document.querySelector('.cart-drawer');

    if (!this.form) return;
    this.bindEvents();
  }

  async addToCart(formData) {
    const btn = this.form.querySelector('[data-add-to-cart]');
    btn?.classList.add('is-loading');

    try {
      const response = await fetch('/cart/add.js', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) throw new Error('Add to cart failed');

      await response.json();
      await this.updateCartCount();

      // Open drawer if it exists, otherwise redirect to cart
      if (this.drawer) {
        this.openCartDrawer();
      } else {
        window.location.href = '/cart';
      }
    } catch (err) {
      console.error('Add to cart error:', err);
    } finally {
      btn?.classList.remove('is-loading');
    }
  }

  async updateCartCount() {
    try {
      const res = await fetch('/cart.js');
      const cart = await res.json();
      if (this.cartCount) {
        this.cartCount.textContent = cart.item_count;
        this.cartCount.hidden = cart.item_count === 0;
      }
    } catch (err) { /* silent */ }
  }

  openCartDrawer() {
    this.drawer?.classList.add('is-open');
    document.querySelector('.cart-drawer__overlay')?.classList.add('is-visible');
    document.body.style.overflow = 'hidden';
  }

  closeCartDrawer() {
    this.drawer?.classList.remove('is-open');
    document.querySelector('.cart-drawer__overlay')?.classList.remove('is-visible');
    document.body.style.overflow = '';
  }

  bindEvents() {
    this.form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = new FormData(this.form);
      await this.addToCart(formData);
    });

    document.querySelector('.cart-drawer__overlay')?.addEventListener('click', () => this.closeCartDrawer());
    document.querySelector('[data-cart-drawer-close]')?.addEventListener('click', () => this.closeCartDrawer());

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.closeCartDrawer();
    });

    // Cart link opens drawer instead of navigating (if drawer exists)
    if (this.drawer) {
      this.cartToggle?.addEventListener('click', (e) => {
        e.preventDefault();
        this.openCartDrawer();
      });
    }
  }
}

// =============================================================================
// Language switcher dropdown
// =============================================================================

class LanguageSwitcher {
  constructor() {
    document.querySelectorAll('[data-language-switcher]').forEach((el) => {
      const toggle = el.querySelector('.language-switcher__toggle');
      const list = el.querySelector('.language-switcher__list');
      if (!toggle || !list) return;

      toggle.addEventListener('click', () => {
        const expanded = toggle.getAttribute('aria-expanded') === 'true';
        toggle.setAttribute('aria-expanded', String(!expanded));
        list.toggleAttribute('hidden');
      });

      // Close on outside click
      document.addEventListener('click', (e) => {
        if (!el.contains(e.target)) {
          toggle.setAttribute('aria-expanded', 'false');
          list.setAttribute('hidden', '');
        }
      });
    });
  }
}

// =============================================================================
// Header scroll behavior (add shadow on scroll)
// =============================================================================

class HeaderScroll {
  constructor() {
    this.header = document.querySelector('.site-header');
    if (!this.header) return;

    const observer = new IntersectionObserver(
      ([entry]) => this.header.classList.toggle('is-scrolled', !entry.isIntersecting),
      { threshold: 1, rootMargin: '-1px 0px 0px 0px' }
    );

    const sentinel = document.createElement('div');
    sentinel.style.cssText = 'position:absolute;top:0;left:0;width:1px;height:1px;pointer-events:none';
    document.body.prepend(sentinel);
    observer.observe(sentinel);
  }
}

// =============================================================================
// Initialize
// =============================================================================

document.addEventListener('DOMContentLoaded', () => {
  new MobileMenu();
  new SearchToggle();
  new ProductGallery();
  new QuantitySelector();
  new CartHandler();
  new LanguageSwitcher();
  new HeaderScroll();
});
