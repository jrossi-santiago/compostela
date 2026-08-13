/* Compostela — shop runtime.
 *
 * Everything the gallery and product pages share: money formatting, the
 * artwork plate (with a graceful fallback until real image files land),
 * the cart store, and the cart drawer.
 *
 * The cart lives in localStorage only. Line items store identifiers, never
 * prices — totals are always recomputed from the catalog, so a price change
 * can never be carried in a stale basket.
 */
window.Shop = (function () {
  var CART_KEY = 'compostela.cart.v1';
  var catalog = window.COMPOSTELA_CATALOG;
  var listeners = [];
  var cart = [];
  var toastTimer;

  /* ---------- helpers ---------- */

  function money(cents) {
    var dollars = cents / 100;
    return '$' + dollars.toLocaleString('en-US', {
      minimumFractionDigits: dollars % 1 === 0 ? 0 : 2,
      maximumFractionDigits: 2
    });
  }

  function escapeHTML(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function workBySlug(slug) {
    for (var i = 0; i < catalog.works.length; i++) {
      if (catalog.works[i].slug === slug) return catalog.works[i];
    }
    return null;
  }

  function byId(list, id) {
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === id) return list[i];
    }
    return null;
  }

  function sizeById(id) { return byId(catalog.sizes, id); }
  function frameById(id) { return byId(catalog.frames, id); }

  function collectionLabel(id) {
    var found = byId(catalog.collections, id);
    return found ? found.label : '';
  }

  function isSizeSoldOut(work, sizeId) {
    return !!(work.soldOut && work.soldOut.indexOf(sizeId) !== -1);
  }

  function availableSizes(work) {
    return catalog.sizes.filter(function (size) {
      return work.prices[size.id] != null;
    });
  }

  function isSoldOut(work) {
    return availableSizes(work).every(function (size) {
      return isSizeSoldOut(work, size.id);
    });
  }

  function priceFrom(work) {
    var prices = availableSizes(work)
      .filter(function (size) { return !isSizeSoldOut(work, size.id); })
      .map(function (size) { return work.prices[size.id]; });
    if (!prices.length) {
      prices = availableSizes(work).map(function (size) { return work.prices[size.id]; });
    }
    return Math.min.apply(null, prices);
  }

  function linePrice(item) {
    var work = workBySlug(item.slug);
    var frame = frameById(item.frameId);
    if (!work || work.prices[item.sizeId] == null) return null;
    return work.prices[item.sizeId] + (frame ? frame.price : 0);
  }

  function imageSrc(work) {
    return 'assets/art/' + work.slug + '.jpg';
  }

  /* Renders the framed image plate. Falls back to a labelled placeholder
     when the image file is not in assets/art/ yet. */
  function plateHTML(work, options) {
    options = options || {};
    var ratio = options.ratio || '3 / 4';
    var loading = options.eager ? 'eager' : 'lazy';
    var alt = work.title + ' — ' + work.artist;
    return (
      '<span class="plate" style="aspect-ratio: ' + ratio + '">' +
        '<img src="' + escapeHTML(imageSrc(work)) + '" alt="' + escapeHTML(alt) + '"' +
        ' loading="' + loading + '" onerror="Shop.plateFallback(this)">' +
      '</span>'
    );
  }

  function plateFallback(img) {
    var plate = img.parentNode;
    var label = img.getAttribute('alt') || '';
    plate.classList.add('plate--placeholder');
    plate.innerHTML = '<span>' + escapeHTML(label) + '</span>';
  }

  /* ---------- cart store ---------- */

  function readCart() {
    try {
      var raw = window.localStorage.getItem(CART_KEY);
      var parsed = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(function (item) {
        return item && workBySlug(item.slug) && linePrice(item) != null && item.qty > 0;
      });
    } catch (err) {
      return [];
    }
  }

  function writeCart() {
    try {
      window.localStorage.setItem(CART_KEY, JSON.stringify(cart));
    } catch (err) {
      /* Private browsing or a full quota — the basket still works for this
         page view, it just will not survive a reload. */
    }
    listeners.forEach(function (fn) { fn(cart); });
  }

  function lineKey(item) {
    return item.slug + '::' + item.sizeId + '::' + item.frameId;
  }

  function addToCart(entry) {
    var existing = null;
    for (var i = 0; i < cart.length; i++) {
      if (lineKey(cart[i]) === lineKey(entry)) { existing = cart[i]; break; }
    }
    if (existing) {
      existing.qty = Math.min(existing.qty + (entry.qty || 1), 20);
    } else {
      cart.push({
        slug: entry.slug,
        sizeId: entry.sizeId,
        frameId: entry.frameId,
        qty: Math.min(entry.qty || 1, 20)
      });
    }
    writeCart();
  }

  function setQty(index, qty) {
    if (!cart[index]) return;
    if (qty < 1) {
      cart.splice(index, 1);
    } else {
      cart[index].qty = Math.min(qty, 20);
    }
    writeCart();
  }

  function count() {
    return cart.reduce(function (sum, item) { return sum + item.qty; }, 0);
  }

  function subtotal() {
    return cart.reduce(function (sum, item) {
      return sum + (linePrice(item) || 0) * item.qty;
    }, 0);
  }

  /* ---------- chrome ---------- */

  function toast(message) {
    var el = document.getElementById('shopToast');
    if (!el) return;
    el.textContent = message;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('show'); }, 2400);
  }

  function injectChrome() {
    var holder = document.createElement('div');
    holder.innerHTML = [
      '<div class="drawer-scrim" id="cartScrim" hidden></div>',
      '<aside class="drawer" id="cartDrawer" role="dialog" aria-modal="true" aria-label="Basket" hidden>',
      '  <header class="drawer__head">',
      '    <h2 class="drawer__title">Basket</h2>',
      '    <button class="icon-button" type="button" id="cartClose" aria-label="Close basket">&times;</button>',
      '  </header>',
      '  <div class="drawer__body" id="cartBody"></div>',
      '  <footer class="drawer__foot">',
      '    <div class="drawer__row"><span class="eyebrow">Subtotal</span>',
      '      <span class="display" style="font-size:22px" id="cartSubtotal">$0</span></div>',
      '    <p class="drawer__note">Shipping and any duties are calculated at checkout.</p>',
      '    <button class="btn btn--block" type="button" id="cartCheckout">Proceed to checkout</button>',
      '  </footer>',
      '</aside>',
      '<div class="toast" id="shopToast" role="status" aria-live="polite"></div>'
    ].join('');
    while (holder.firstChild) document.body.appendChild(holder.firstChild);
  }

  function renderDrawer() {
    var body = document.getElementById('cartBody');
    if (!body) return;

    if (!cart.length) {
      body.innerHTML = '<p class="drawer__empty">Your basket is empty.</p>';
    } else {
      body.innerHTML = cart.map(function (item, index) {
        var work = workBySlug(item.slug);
        var size = sizeById(item.sizeId);
        var frame = frameById(item.frameId);
        var price = linePrice(item);
        return (
          '<div class="cart-line">' +
            '<a href="product.html?work=' + encodeURIComponent(work.slug) + '" class="cart-line__plate">' +
              plateHTML(work, { ratio: '3 / 4' }) +
            '</a>' +
            '<div>' +
              '<a href="product.html?work=' + encodeURIComponent(work.slug) + '" style="text-decoration:none">' +
                '<span class="cart-line__title">' + escapeHTML(work.title) + '</span>' +
              '</a>' +
              '<div class="cart-line__meta">' + escapeHTML(size.label) + ' · ' + escapeHTML(size.dimensions) + '<br>' +
                escapeHTML(frame.label) + '</div>' +
              '<div class="cart-line__foot">' +
                '<span class="qty">' +
                  '<button type="button" data-qty="-1" data-index="' + index + '" aria-label="Decrease quantity">&minus;</button>' +
                  '<span>' + item.qty + '</span>' +
                  '<button type="button" data-qty="1" data-index="' + index + '" aria-label="Increase quantity">+</button>' +
                '</span>' +
                '<span>' + money(price * item.qty) + '</span>' +
              '</div>' +
              '<button class="cart-line__remove" type="button" data-remove="' + index + '">Remove</button>' +
            '</div>' +
          '</div>'
        );
      }).join('');
    }

    document.getElementById('cartSubtotal').textContent = money(subtotal());
    document.getElementById('cartCheckout').disabled = !cart.length;
  }

  function renderCount() {
    var total = count();
    document.querySelectorAll('[data-cart-count]').forEach(function (el) {
      el.textContent = '(' + total + ')';
    });
  }

  function openCart() {
    var scrim = document.getElementById('cartScrim');
    var drawer = document.getElementById('cartDrawer');
    scrim.hidden = false;
    drawer.hidden = false;
    // Let the browser paint the un-hidden elements before transitioning.
    requestAnimationFrame(function () {
      scrim.classList.add('open');
      drawer.classList.add('open');
    });
    document.body.style.overflow = 'hidden';
    document.getElementById('cartClose').focus();
  }

  function closeCart() {
    var scrim = document.getElementById('cartScrim');
    var drawer = document.getElementById('cartDrawer');
    scrim.classList.remove('open');
    drawer.classList.remove('open');
    document.body.style.overflow = '';
    setTimeout(function () {
      if (!drawer.classList.contains('open')) {
        scrim.hidden = true;
        drawer.hidden = true;
      }
    }, 300);
  }

  function wireChrome() {
    document.getElementById('cartScrim').addEventListener('click', closeCart);
    document.getElementById('cartClose').addEventListener('click', closeCart);

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeCart();
    });

    document.querySelectorAll('[data-cart-open]').forEach(function (btn) {
      btn.addEventListener('click', openCart);
    });

    document.getElementById('cartBody').addEventListener('click', function (e) {
      var qtyBtn = e.target.closest('[data-qty]');
      if (qtyBtn) {
        var i = parseInt(qtyBtn.getAttribute('data-index'), 10);
        setQty(i, cart[i].qty + parseInt(qtyBtn.getAttribute('data-qty'), 10));
        return;
      }
      var removeBtn = e.target.closest('[data-remove]');
      if (removeBtn) {
        setQty(parseInt(removeBtn.getAttribute('data-remove'), 10), 0);
      }
    });

    // No payment processor is wired up yet. When one is, this is the hook:
    // build the line items from `cart` and hand them to the checkout session.
    document.getElementById('cartCheckout').addEventListener('click', function () {
      toast('Checkout opens soon — write to us to reserve a piece.');
    });

    var hamburger = document.getElementById('navToggle');
    var nav = document.getElementById('siteNav');
    if (hamburger && nav) {
      hamburger.addEventListener('click', function () {
        var open = nav.classList.toggle('open');
        hamburger.setAttribute('aria-expanded', open ? 'true' : 'false');
      });
      document.addEventListener('click', function (e) {
        if (nav.classList.contains('open') && !nav.contains(e.target) && !hamburger.contains(e.target)) {
          nav.classList.remove('open');
          hamburger.setAttribute('aria-expanded', 'false');
        }
      });
    }

    // Links that have nowhere to go yet keep the landing page's manners.
    document.querySelectorAll('a[href="#"]').forEach(function (link) {
      link.addEventListener('click', function (e) {
        e.preventDefault();
        toast('Coming soon');
      });
    });
  }

  function subscribe(fn) { listeners.push(fn); }

  function init() {
    cart = readCart();
    injectChrome();
    wireChrome();
    subscribe(function () { renderDrawer(); renderCount(); });
    renderDrawer();
    renderCount();
  }

  return {
    catalog: catalog,
    init: init,
    money: money,
    escapeHTML: escapeHTML,
    workBySlug: workBySlug,
    sizeById: sizeById,
    frameById: frameById,
    collectionLabel: collectionLabel,
    availableSizes: availableSizes,
    isSizeSoldOut: isSizeSoldOut,
    isSoldOut: isSoldOut,
    priceFrom: priceFrom,
    plateHTML: plateHTML,
    plateFallback: plateFallback,
    addToCart: addToCart,
    openCart: openCart,
    closeCart: closeCart,
    toast: toast
  };
})();
