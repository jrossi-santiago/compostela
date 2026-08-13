/* POST /api/checkout — creates a Stripe Checkout Session.
 *
 * The browser sends identifiers only: [{ slug, sizeId, frameId, qty }].
 * Prices are never accepted from the client; every amount charged is looked
 * up here, from assets/catalog.js, through the same pricing module the pages
 * use. Editing a price in the catalog changes what is charged. There are no
 * products or prices stored in the Stripe dashboard to keep in sync.
 *
 * Requires the STRIPE_SECRET_KEY environment variable (set it in the Vercel
 * project settings, never in this repository).
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

function shippingOptions() {
  return catalog.shipping.rates.map((rate) => ({
    shipping_rate_data: {
      type: 'fixed_amount',
      display_name: rate.label,
      fixed_amount: { amount: rate.price, currency: catalog.currency },
      delivery_estimate: {
        minimum: { unit: 'business_day', value: rate.minDays },
        maximum: { unit: 'business_day', value: rate.maxDays }
      }
    }
  }));
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    // Deployed without the key — say so plainly rather than 500-ing.
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
      line_items: lineItems,
      success_url: `${origin}/thank-you.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/gallery.html`,
      shipping_address_collection: {
        allowed_countries: catalog.shipping.allowedCountries
      },
      shipping_options: shippingOptions(),
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

    return res.status(200).json({ url: session.url });
  } catch (err) {
    console.error('Stripe session creation failed:', err);
    return res.status(502).json({
      error: 'Could not reach the payment provider. Please try again.'
    });
  }
};
