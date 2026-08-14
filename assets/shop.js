/* Compostela — shop runtime.
 *
 * The browser half: the artwork plate, the basket, the drawer, and the hand-
 * off to Stripe. All pricing is delegated to assets/pricing.js, which the
 * checkout function also uses, so there is exactly one implementation of
 * "what does this cost".
 *
 * The basket lives in localStorage and stores identifiers only — never
 * prices. Totals are recomputed from the catalog on every render, so a
 * basket left open across a price change cannot carry a stale amount, and
 * the server recomputes them again before charging anything.
 */
window.Shop = (function () {
  var CART_KEY = 'compostela.cart.v1';
  var pricing = window.COMPOSTELA_PRICING;
  var catalog = pricing.catalog;
  var listeners = [];
  var cart = [];
  var toastTimer;

  function escapeHTML(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function imageSrc(work) {
    return 'assets/art/' + work.slug + '.jpg';
  }

  /* Renders the matted image plate. Falls back to a labelled placeholder
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
      // Drop anything the catalog no longer sells.
      return parsed.filter(function (item) {
        return pricing.resolveLine(item).ok;
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
    var line = pricing.resolveLine(entry);
    if (!line.ok) { toast(line.error); return false; }

    var existing = null;
    for (var i = 0; i < cart.length; i++) {
      if (lineKey(cart[i]) === lineKey(entry)) { existing = cart[i]; break; }
    }
    if (existing) {
      existing.qty = Math.min(existing.qty + line.qty, pricing.MAX_QTY);
    } else {
      cart.push({
        slug: entry.slug,
        sizeId: entry.sizeId,
        frameId: entry.frameId,
        qty: line.qty
      });
    }
    writeCart();
    return true;
  }

  function setQty(index, qty) {
    if (!cart[index]) return;
    if (qty < 1) {
      cart.splice(index, 1);
    } else {
      cart[index].qty = Math.min(qty, pricing.MAX_QTY);
    }
    writeCart();
  }

  function clearCart() {
    cart = [];
    writeCart();
  }

  function count() {
    return cart.reduce(function (sum, item) { return sum + item.qty; }, 0);
  }

  /* ---------- chrome ---------- */

  function toast(message) {
    var el = document.getElementById('shopToast');
    if (!el) return;
    el.textContent = message;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('show'); }, 3200);
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
      '      <span id="cartSubtotal">$0</span></div>',
      '    <div class="drawer__row"><span class="eyebrow">Shipping</span>',
      '      <span id="cartShipping">$0</span></div>',
      '    <div class="drawer__row drawer__row--total"><span class="eyebrow">Total</span>',
      '      <span class="display" style="font-size:22px" id="cartTotal">$0</span></div>',
      '    <p class="drawer__note" id="cartNote"></p>',
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

    var basket = pricing.resolveCart(cart);

    if (!cart.length) {
      body.innerHTML = '<p class="drawer__empty">Your basket is empty.</p>';
    } else {
      body.innerHTML = basket.lines.map(function (line, index) {
        var href = 'product.html?work=' + encodeURIComponent(line.work.slug);
        return (
          '<div class="cart-line">' +
            '<a href="' + href + '" class="cart-line__plate">' +
              plateHTML(line.work, { ratio: '3 / 4' }) +
            '</a>' +
            '<div>' +
              '<a href="' + href + '" style="text-decoration:none">' +
                '<span class="cart-line__title">' + escapeHTML(line.work.title) + '</span>' +
              '</a>' +
              '<div class="cart-line__meta">' +
                escapeHTML(line.size.label) + ' · ' + escapeHTML(line.size.dimensions) + '<br>' +
                escapeHTML(line.frame.label) + (pricing.isFramed(line.frame.id) ? ' frame' : '') +
              '</div>' +
              '<div class="cart-line__foot">' +
                '<span class="qty">' +
                  '<button type="button" data-qty="-1" data-index="' + index + '" aria-label="Decrease quantity">&minus;</button>' +
                  '<span>' + line.qty + '</span>' +
                  '<button type="button" data-qty="1" data-index="' + index + '" aria-label="Increase quantity">+</button>' +
                '</span>' +
                '<span>' + pricing.money(line.total) + '</span>' +
              '</div>' +
              '<button class="cart-line__remove" type="button" data-remove="' + index + '">Remove</button>' +
            '</div>' +
          '</div>'
        );
      }).join('');
    }

    var ship = catalog.shipping;
    document.getElementById('cartSubtotal').textContent = pricing.money(basket.total);
    document.getElementById('cartShipping').textContent = pricing.money(basket.shipping);
    document.getElementById('cartTotal').textContent = pricing.money(basket.grandTotal);
    document.getElementById('cartNote').textContent = cart.length
      ? 'One shipping charge per order, at the highest rate in the basket. ' +
        ship.minDays + '–' + ship.maxDays + ' days from order to delivery.'
      : '';
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

  /* Checkout happens on our own checkout.html, which reads this same basket
     out of localStorage and mounts Stripe's form inside the page. Nothing is
     passed in the URL — the basket is already where it needs to be. */
  function checkout() {
    var button = document.getElementById('cartCheckout');
    if (!cart.length || button.disabled) return;

    button.disabled = true;
    button.textContent = 'Taking you to checkout…';
    window.location.href = 'checkout.html';
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

    document.getElementById('cartCheckout').addEventListener('click', checkout);

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
    // A copy of the basket, for pages that render it without editing it.
    items: function () { return cart.slice(); },
    escapeHTML: escapeHTML,
    // Pricing is re-exported so pages have one object to talk to.
    money: pricing.money,
    moneyExact: pricing.moneyExact,
    resolveCart: pricing.resolveCart,
    workBySlug: pricing.workBySlug,
    sizeById: pricing.sizeById,
    frameById: pricing.frameById,
    collectionLabel: pricing.collectionLabel,
    availableSizes: pricing.availableSizes,
    availableFrames: pricing.availableFrames,
    sizeCanBeFramed: pricing.sizeCanBeFramed,
    framePrice: pricing.framePrice,
    shippingFor: pricing.shippingFor,
    isFramed: pricing.isFramed,
    isSizeSoldOut: pricing.isSizeSoldOut,
    isSoldOut: pricing.isSoldOut,
    priceFrom: pricing.priceFrom,
    detailsFor: pricing.detailsFor,
    resolveLine: pricing.resolveLine,
    plateHTML: plateHTML,
    plateFallback: plateFallback,
    addToCart: addToCart,
    clearCart: clearCart,
    openCart: openCart,
    closeCart: closeCart,
    toast: toast
  };
})();
