/* Compostela — pricing and line validation.
 *
 * Shared by the browser and by the Stripe checkout function, so the price a
 * customer sees and the price they are charged are produced by the same code
 * reading the same catalog. There is no second copy of this arithmetic.
 *
 * All amounts are integer cents throughout. No floats, ever.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./catalog.js'));
  } else {
    root.COMPOSTELA_PRICING = factory(root.COMPOSTELA_CATALOG);
  }
})(typeof self !== 'undefined' ? self : this, function (catalog) {

  var MAX_QTY = 20;

  function byId(list, id) {
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === id) return list[i];
    }
    return null;
  }

  function workBySlug(slug) {
    for (var i = 0; i < catalog.works.length; i++) {
      if (catalog.works[i].slug === slug) return catalog.works[i];
    }
    return null;
  }

  function sizeById(id) { return byId(catalog.sizes, id); }
  function frameById(id) { return byId(catalog.frames, id); }

  /* What framing costs on top of the print, for a given size. Returns null
     when that size is not offered framed at all — 5 × 7, as it stands. A
     frame may carry its own per-size map to override the shared one. */
  function framePrice(sizeId, frameId) {
    var frame = frameById(frameId);
    if (!frame) return null;
    if (frame.id === 'none') return 0;
    var table = frame.price || catalog.framePrices;
    var amount = table[sizeId];
    return amount == null ? null : amount;
  }

  function isFramed(frameId) { return frameId !== 'none'; }

  /* The frame colours offered at a size. Always includes 'Unframed print';
     at a size with no framing that is the only entry. */
  function availableFrames(sizeId) {
    return catalog.frames.filter(function (frame) {
      return framePrice(sizeId, frame.id) != null;
    });
  }

  function sizeCanBeFramed(sizeId) {
    return availableFrames(sizeId).length > 1;
  }

  /* Shipping for one piece, by size and whether it is framed. */
  function shippingFor(sizeId, frameId) {
    var rate = catalog.shipping.rates[sizeId];
    if (!rate) return null;
    var amount = isFramed(frameId) ? rate.framed : rate.unframed;
    return amount == null ? null : amount;
  }

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

  /* Lowest price a work can be had for, used for the gallery's "From $X". */
  function priceFrom(work) {
    var offered = availableSizes(work).filter(function (size) {
      return !isSizeSoldOut(work, size.id);
    });
    if (!offered.length) offered = availableSizes(work);
    return Math.min.apply(null, offered.map(function (size) {
      return work.prices[size.id];
    }));
  }

  /* Per-work print specs fall back to the shared policy text, so the common
     case is written once in catalog.js. */
  function detailsFor(work) {
    return work.details || catalog.policies.details;
  }

  /* The one validator. Takes an untrusted {slug, sizeId, frameId, qty} and
     either resolves it to real catalog objects and a price, or explains why
     it cannot. The checkout function trusts nothing else. */
  function resolveLine(input) {
    if (!input || typeof input !== 'object') {
      return { ok: false, error: 'Malformed line item.' };
    }

    var work = workBySlug(input.slug);
    if (!work) return { ok: false, error: 'Unknown work: ' + input.slug };

    var size = sizeById(input.sizeId);
    if (!size || work.prices[size.id] == null) {
      return { ok: false, error: 'Unknown size for ' + work.title + '.' };
    }
    if (isSizeSoldOut(work, size.id)) {
      return { ok: false, error: work.title + ' is sold out in ' + size.label.toLowerCase() + '.' };
    }

    var frame = frameById(input.frameId);
    if (!frame) return { ok: false, error: 'Unknown framing option.' };

    var framing = framePrice(size.id, frame.id);
    if (framing == null) {
      return { ok: false, error: work.title + ' is not framed at ' + size.dimensions + '.' };
    }

    var shipping = shippingFor(size.id, frame.id);
    if (shipping == null) {
      return { ok: false, error: 'We cannot ship that combination yet.' };
    }

    var qty = Math.floor(Number(input.qty));
    if (!isFinite(qty) || qty < 1) qty = 1;
    if (qty > MAX_QTY) qty = MAX_QTY;

    var unitAmount = work.prices[size.id] + framing;

    return {
      ok: true,
      work: work,
      size: size,
      frame: frame,
      framing: framing,
      shipping: shipping,
      qty: qty,
      unitAmount: unitAmount,
      total: unitAmount * qty,
      // What the customer sees on the Stripe receipt.
      description: size.label + ' — ' + size.dimensions + ' · ' + frame.label +
        (isFramed(frame.id) ? ' frame' : '')
    };
  }

  /* Resolves a whole basket. Returns every problem at once rather than
     failing on the first, so the browser can explain itself properly. */
  function resolveCart(items) {
    if (!Array.isArray(items) || !items.length) {
      return { ok: false, errors: ['The basket is empty.'], lines: [], total: 0, shipping: 0, grandTotal: 0 };
    }
    if (items.length > 50) {
      return { ok: false, errors: ['Too many items in one order.'], lines: [], total: 0, shipping: 0, grandTotal: 0 };
    }

    var lines = [];
    var errors = [];

    items.forEach(function (item) {
      var line = resolveLine(item);
      if (line.ok) lines.push(line);
      else errors.push(line.error);
    });

    var subtotal = lines.reduce(function (sum, line) { return sum + line.total; }, 0);
    // One order, one shipping charge: the basket pays the highest rate it
    // contains rather than the sum of them.
    var shipping = lines.reduce(function (highest, line) {
      return Math.max(highest, line.shipping);
    }, 0);

    return {
      ok: errors.length === 0 && lines.length > 0,
      errors: errors,
      lines: lines,
      total: subtotal,
      shipping: shipping,
      grandTotal: subtotal + shipping
    };
  }

  /* Browsing prices. Drops the cents on a whole-dollar amount, so the gallery
     reads "$45" rather than "$45.00". */
  function money(cents) {
    var dollars = cents / 100;
    return '$' + dollars.toLocaleString('en-US', {
      minimumFractionDigits: dollars % 1 === 0 ? 0 : 2,
      maximumFractionDigits: 2
    });
  }

  /* Money about to be charged, or already charged. Always shows the cents —
     a checkout total or a receipt reading "$45" looks like a rounding. */
  function moneyExact(cents, currency) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: (currency || catalog.currency).toUpperCase()
    }).format((cents || 0) / 100);
  }

  return {
    MAX_QTY: MAX_QTY,
    catalog: catalog,
    workBySlug: workBySlug,
    sizeById: sizeById,
    frameById: frameById,
    collectionLabel: collectionLabel,
    availableSizes: availableSizes,
    availableFrames: availableFrames,
    sizeCanBeFramed: sizeCanBeFramed,
    framePrice: framePrice,
    shippingFor: shippingFor,
    isFramed: isFramed,
    isSizeSoldOut: isSizeSoldOut,
    isSoldOut: isSoldOut,
    priceFrom: priceFrom,
    detailsFor: detailsFor,
    resolveLine: resolveLine,
    resolveCart: resolveCart,
    money: money,
    moneyExact: moneyExact
  };
});
