/* Reading an order back out of Stripe — the one place it happens.
 *
 * Underscore-prefixed files in api/ are not turned into routes by Vercel, so
 * this is a shared module rather than an endpoint. Both the confirmation page
 * (api/order.js) and the order emails (api/_email.js) read a session through
 * here, so the customer's on-screen receipt and the emails cannot describe the
 * same order differently.
 *
 * `view()` returns the narrow, customer-safe shape: enough to confirm what was
 * bought, and nothing that would help anyone do anything else with it. The
 * fulfilment alert needs a little more than that, and reads the raw session
 * directly rather than widening this.
 *
 * Requires STRIPE_SECRET_KEY.
 */
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// cs_test_… / cs_live_… — Stripe's own format. Anything else is not a session
// id, and is refused before it reaches the API.
const SESSION_ID = /^cs_[A-Za-z0-9_]{10,255}$/;

/* Line items carry the size and frame in product metadata, and the card brand
   hangs off the payment intent. Both are wanted by the page and by the emails,
   so the expansion is written once here. */
const EXPAND = ['line_items.data.price.product', 'payment_intent.payment_method'];

function retrieve(sessionId) {
  return stripe.checkout.sessions.retrieve(sessionId, { expand: EXPAND });
}

function address(details) {
  if (!details || !details.address) return null;
  const a = details.address;
  return {
    name: details.name || null,
    line1: a.line1 || null,
    line2: a.line2 || null,
    city: a.city || null,
    state: a.state || null,
    postalCode: a.postalCode || a.postal_code || null,
    country: a.country || null
  };
}

/* Stripe moved shipping onto `collected_information` in newer API versions and
   kept `shipping_details` on older ones. Read whichever this account returns
   so nothing here depends on the pinned version. */
function shippingDetails(session) {
  return (session.collected_information && session.collected_information.shipping_details)
    || session.shipping_details
    || null;
}

function isPaid(session) {
  return session.payment_status === 'paid' || session.payment_status === 'no_payment_required';
}

/* The short form the customer sees on the page, in both emails, and quotes
   back to us when they write. Derived from the session id, so it needs no
   counter and no database. */
function reference(sessionId) {
  return String(sessionId).slice(-12).toUpperCase();
}

function view(session) {
  const totals = session.total_details || {};
  const lineItems = (session.line_items && session.line_items.data) || [];

  const card = session.payment_intent
    && session.payment_intent.payment_method
    && session.payment_intent.payment_method.card;

  return {
    // 'complete' once the customer has paid; 'open' if they backed out
    // mid-checkout and 'expired' if the session timed out.
    status: session.status,
    paymentStatus: session.payment_status,
    paid: isPaid(session),
    reference: reference(session.id),
    placedAt: session.created ? session.created * 1000 : null,
    email: (session.customer_details && session.customer_details.email) || null,
    currency: session.currency,
    amountSubtotal: session.amount_subtotal,
    amountShipping: totals.amount_shipping || 0,
    amountTax: totals.amount_tax || 0,
    amountDiscount: totals.amount_discount || 0,
    amountTotal: session.amount_total,
    card: card ? { brand: card.brand, last4: card.last4 } : null,
    shipping: address(shippingDetails(session)),
    lines: lineItems.map((item) => {
      const product = (item.price && item.price.product) || {};
      const metadata = product.metadata || {};
      return {
        // "The Storm on the Sea of Galilee — Rembrandt"
        name: product.name || item.description || 'Print',
        // "Extra large — 24 × 36 in · Red oak frame"
        detail: product.description || null,
        slug: metadata.slug || null,
        // The catalog ids behind that description. The page does not need
        // them; the packing list does.
        size: metadata.size || null,
        frame: metadata.frame || null,
        quantity: item.quantity,
        amount: item.amount_total
      };
    })
  };
}

module.exports = {
  stripe,
  SESSION_ID,
  EXPAND,
  retrieve,
  view,
  address,
  shippingDetails,
  isPaid,
  reference
};
