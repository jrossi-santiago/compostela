/* POST /api/checkout — creates an embedded Stripe Checkout Session.
 *
 * The browser sends identifiers only: [{ slug, sizeId, frameId, qty }].
 * Prices are never accepted from the client; every amount charged is looked
 * up here, from assets/catalog.js, through the same pricing module the pages
 * use. Editing a price in the catalog changes what is charged. There are no
 * products or prices stored in the Stripe dashboard to keep in sync.
 *
 * The session is created with ui_mode 'embedded', so it mounts inside
 * checkout.html on our own domain rather than sending the customer to
 * checkout.stripe.com. The response carries the session's client secret and
 * the publishable key the page needs to mount it — both are public values by
 * design. The secret key never leaves this function.
 *
 * Requires two environment variables, set in the Vercel project settings and
 * never in this repository:
 *   STRIPE_SECRET_KEY       sk_… — signs the API call
 *   STRIPE_PUBLISHABLE_KEY  pk_… — handed to the browser to mount the form
 * Both must be from the same mode; a live secret with a test publishable key
 * fails at mount time with a confusing error.
 */
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const pricing = require('../assets/pricing.js');

const catalog = pricing.catalog;

function readBody(req) {
  // Vercel parses JSON bodies already; this covers the raw case too.
  if (req.body && typeof req.body === 'object') return Promise.resolve(req.body);
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', (chunk) => { raw += chunk; });
    req.on('end', () => {
      try { resolve(JSON.parse(raw || '{}')); } catch (err) { resolve({}); }
    });
  });
}

function originOf(req) {
  const proto = req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  return `${proto}://${host}`;
}

/* Shipping is priced per piece by size and framing, so the rate depends on
   what is in the basket. `resolveCart` has already picked the single rate the
   order pays; this turns it into the one option Stripe offers. */
function shippingOptions(basket) {
  const ship = catalog.shipping;
  return [{
    shipping_rate_data: {
      type: 'fixed_amount',
      display_name: ship.label,
      fixed_amount: { amount: basket.shipping, currency: catalog.currency },
      delivery_estimate: {
        minimum: { unit: 'day', value: ship.minDays },
        maximum: { unit: 'day', value: ship.maxDays }
      }
    }
  }];
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_PUBLISHABLE_KEY) {
    // Deployed without a key — say so plainly rather than 500-ing. The
    // embedded form needs both, so a half-configured deploy fails here
    // rather than with an opaque error once the page tries to mount.
    return res.status(503).json({
      error: 'Checkout is not configured yet.'
    });
  }

  const body = await readBody(req);
  const basket = pricing.resolveCart(body.items);

  if (!basket.ok) {
    return res.status(400).json({ error: basket.errors.join(' ') });
  }

  const origin = originOf(req);

  const lineItems = basket.lines.map((line) => ({
    quantity: line.qty,
    price_data: {
      currency: catalog.currency,
      unit_amount: line.unitAmount,
      product_data: {
        name: `${line.work.title} — ${line.work.artist}`,
        description: line.description,
        // Once assets/art/<slug>.jpg files exist, uncomment to show
        // thumbnails on the Stripe page:
        // images: [`${origin}/assets/art/${line.work.slug}.jpg`],
        metadata: {
          slug: line.work.slug,
          size: line.size.id,
          frame: line.frame.id
        }
      }
    }
  }));

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      ui_mode: 'embedded',
      line_items: lineItems,
      // Embedded sessions take a return_url and must not be given
      // success_url or cancel_url. Stripe sends the customer here after
      // payment, and thank-you.html reads the order back from it.
      return_url: `${origin}/thank-you.html?session_id={CHECKOUT_SESSION_ID}`,
      shipping_address_collection: {
        allowed_countries: catalog.shipping.allowedCountries
      },
      shipping_options: shippingOptions(basket),
      billing_address_collection: 'auto',
      // Stripe Tax has to be switched on in the dashboard first; leave the
      // env var unset until it is, or every session will fail.
      automatic_tax: { enabled: process.env.STRIPE_TAX === '1' },
      metadata: {
        // A compact record of the order, in case it is ever needed alongside
        // the line items.
        basket: basket.lines
          .map((l) => `${l.work.slug}/${l.size.id}/${l.frame.id}x${l.qty}`)
          .join(', ')
          .slice(0, 490)
      }
    });

    return res.status(200).json({
      clientSecret: session.client_secret,
      publishableKey: process.env.STRIPE_PUBLISHABLE_KEY
    });
  } catch (err) {
    console.error('Stripe session creation failed:', err);
    return res.status(502).json({
      error: 'Could not reach the payment provider. Please try again.'
    });
  }
};
