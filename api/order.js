/* GET /api/order?session_id=cs_… — what the customer just bought.
 *
 * The confirmation page cannot ask Stripe anything itself: reading a Checkout
 * Session needs the secret key, and the secret key never leaves the server.
 * So the page asks this function, and this function returns a deliberately
 * narrow view of the order — enough to confirm it went through, and nothing
 * more.
 *
 * A session id is long and unguessable, and the customer has just been handed
 * theirs by Stripe, so possession of the id is what authorises the read. That
 * is the same basis Stripe's own hosted receipts use. It is also why the
 * response below carries no payment intent, no customer id, and no card
 * details beyond the brand and last four: anyone holding the link should be
 * able to see their order, and nothing that would help them do anything else.
 *
 * Requires the STRIPE_SECRET_KEY environment variable, set in Vercel.
 */
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// cs_test_… / cs_live_… — Stripe's own format. Anything else is not a session
// id, and is refused before it reaches the API.
const SESSION_ID = /^cs_[A-Za-z0-9_]{10,255}$/;

function address(details) {
  if (!details || !details.address) return null;
  const a = details.address;
  return {
    name: details.name || null,
    line1: a.line1 || null,
    line2: a.line2 || null,
    city: a.city || null,
    state: a.state || null,
    postalCode: a.postal_code || null,
    country: a.country || null
  };
}

/* Stripe moved shipping onto `collected_information` in newer API versions and
   kept `shipping_details` on older ones. Read whichever this account returns
   so the page does not depend on the pinned version. */
function shippingDetails(session) {
  return (session.collected_information && session.collected_information.shipping_details)
    || session.shipping_details
    || null;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  // An order is per-customer and changes as Stripe settles it — never cache it,
  // at the browser or at the edge.
  res.setHeader('Cache-Control', 'no-store, max-age=0');

  if (!process.env.STRIPE_SECRET_KEY) {
    return res.status(503).json({ error: 'Orders cannot be looked up yet.' });
  }

  const sessionId = String((req.query && req.query.session_id) || '');
  if (!SESSION_ID.test(sessionId)) {
    return res.status(400).json({ error: 'That is not an order reference we recognise.' });
  }

  let session;
  try {
    session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['line_items.data.price.product', 'payment_intent.payment_method']
    });
  } catch (err) {
    if (err && err.code === 'resource_missing') {
      return res.status(404).json({ error: 'We could not find that order.' });
    }
    console.error('Order lookup failed:', err);
    return res.status(502).json({ error: 'Could not reach the payment provider.' });
  }

  const totals = session.total_details || {};
  const lineItems = (session.line_items && session.line_items.data) || [];

  const card = session.payment_intent
    && session.payment_intent.payment_method
    && session.payment_intent.payment_method.card;

  return res.status(200).json({
    // 'complete' once the customer has paid; 'open' if they backed out
    // mid-checkout and 'expired' if the session timed out.
    status: session.status,
    paymentStatus: session.payment_status,
    paid: session.payment_status === 'paid' || session.payment_status === 'no_payment_required',
    // The short form the customer sees, matching what we show on the page.
    reference: sessionId.slice(-12).toUpperCase(),
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
        quantity: item.quantity,
        amount: item.amount_total
      };
    })
  });
};
