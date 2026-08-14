/* POST /api/webhook — Stripe tells us an order has been paid for.
 *
 * This is the reliable half of order email. The customer's browser may never
 * come back to thank-you.html — they close the tab, the phone dies, the
 * network drops — but Stripe will keep telling this endpoint about the payment
 * until it gets a 2xx. So the fulfilment alert and the customer's confirmation
 * are sent from here, and api/order.js only picks up what this missed.
 *
 * Nothing in the request body is trusted for the order's contents: the session
 * id is taken from the event and everything else is read back from Stripe with
 * the secret key. The signature check is what stops the endpoint being poked at
 * all.
 *
 * Requires STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET. Set the endpoint up in
 * the Stripe dashboard: Developers → Webhooks → add
 * https://<your-domain>/api/webhook, subscribed to checkout.session.completed
 * and checkout.session.async_payment_succeeded, then copy the signing secret
 * (whsec_…) into the project's environment variables.
 */
const orders = require('./_order.js');
const email = require('./_email.js');

const stripe = orders.stripe;

const HANDLED = [
  'checkout.session.completed',
  // Bank debits and other delayed methods settle after the session completes.
  'checkout.session.async_payment_succeeded'
];

/* Signature verification is over the exact bytes Stripe sent, so the body must
   not be parsed before we see it. `config` below asks Vercel not to; this reads
   whatever we are actually given, and reports honestly when the raw bytes have
   already been consumed. */
function rawBody(req) {
  if (Buffer.isBuffer(req.body)) return Promise.resolve(req.body);
  if (typeof req.body === 'string') return Promise.resolve(Buffer.from(req.body));
  // Already parsed into an object — the bytes are gone and cannot be rebuilt.
  if (req.body && typeof req.body === 'object') return Promise.resolve(null);
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function parse(raw, req) {
  if (raw) {
    try { return JSON.parse(raw.toString('utf8')); } catch (err) { return null; }
  }
  return (req.body && typeof req.body === 'object') ? req.body : null;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    return res.status(503).json({ error: 'Stripe is not configured.' });
  }
  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    // Unverified, this endpoint would be a stranger's send button. Refuse it
    // rather than accept events we cannot attribute to Stripe.
    console.error('STRIPE_WEBHOOK_SECRET is unset; refusing webhook deliveries.');
    return res.status(503).json({ error: 'Webhooks are not configured.' });
  }

  let raw;
  try {
    raw = await rawBody(req);
  } catch (err) {
    return res.status(400).json({ error: 'Could not read the request body.' });
  }

  let event;
  if (raw) {
    try {
      event = stripe.webhooks.constructEvent(
        raw,
        req.headers['stripe-signature'],
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      console.error('Webhook signature verification failed:', err.message);
      return res.status(400).json({ error: 'Signature verification failed.' });
    }
  } else {
    /* The platform parsed the body before we saw it, so the signature cannot be
       checked against it. The event is then treated as a hint and nothing more:
       we take the session id out of it and read the order itself back from
       Stripe below, which is the only thing we act on either way. */
    console.warn('Webhook body was pre-parsed; signature not verified. ' +
      'Check that the bodyParser config on this function is being applied.');
    event = parse(raw, req);
    if (!event) return res.status(400).json({ error: 'Unreadable event.' });
  }

  if (HANDLED.indexOf(event.type) === -1) {
    // Subscribed to more than we handle: acknowledge and move on.
    return res.status(200).json({ received: true, handled: false });
  }

  const sessionId = event.data && event.data.object && event.data.object.id;
  if (!orders.SESSION_ID.test(String(sessionId || ''))) {
    return res.status(400).json({ error: 'No Checkout Session on that event.' });
  }

  let session;
  try {
    session = await orders.retrieve(sessionId);
  } catch (err) {
    console.error('Webhook could not load session ' + sessionId + ':', err);
    // Let Stripe try again — this is very likely transient.
    return res.status(502).json({ error: 'Could not load the order.' });
  }

  const result = await email.deliverOrderEmails(session);

  if (result.skipped) {
    return res.status(200).json({ received: true, sent: false, skipped: result.skipped });
  }

  if (!result.sent) {
    /* Nothing went out and the marker has been released, so a retry will try
       again in earnest. A non-2xx is how we ask for one. */
    return res.status(500).json({ error: 'Order emails failed.', details: result.errors });
  }

  return res.status(200).json({
    received: true,
    sent: true,
    // Partial delivery still counts as handled; retrying would duplicate the
    // half that worked.
    errors: result.errors.length ? result.errors : undefined
  });
};

/* Vercel parses JSON request bodies by default. Stripe's signature is over the
   raw bytes, so that has to be switched off for this one function. */
module.exports.config = {
  api: { bodyParser: false }
};
