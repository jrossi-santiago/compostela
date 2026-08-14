/* GET /api/order?session_id=cs_… — what the customer just bought.
 *
 * The confirmation page cannot ask Stripe anything itself: reading a Checkout
 * Session needs the secret key, and the secret key never leaves the server.
 * So the page asks this function, and this function returns a deliberately
 * narrow view of the order — enough to confirm it went through, and nothing
 * more. That view is built in api/_order.js, which the order emails read too,
 * so the page and the emails cannot describe one order two ways.
 *
 * A session id is long and unguessable, and the customer has just been handed
 * theirs by Stripe, so possession of the id is what authorises the read. That
 * is the same basis Stripe's own hosted receipts use. It is also why the view
 * carries no payment intent, no customer id, and no card details beyond the
 * brand and last four: anyone holding the link should be able to see their
 * order, and nothing that would help them do anything else.
 *
 * It is also the backstop for order email. api/webhook.js is what normally
 * sends both emails; if it has not run — not configured yet, or still in
 * Stripe's retry queue — a paid order being looked up here sends them instead.
 * Whichever gets there first writes a marker into the session metadata, so an
 * order is only ever emailed once.
 *
 * Requires the STRIPE_SECRET_KEY environment variable, set in Vercel.
 */
const orders = require('./_order.js');
const email = require('./_email.js');

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
  if (!orders.SESSION_ID.test(sessionId)) {
    return res.status(400).json({ error: 'That is not an order reference we recognise.' });
  }

  let session;
  try {
    session = await orders.retrieve(sessionId);
  } catch (err) {
    if (err && err.code === 'resource_missing') {
      return res.status(404).json({ error: 'We could not find that order.' });
    }
    console.error('Order lookup failed:', err);
    return res.status(502).json({ error: 'Could not reach the payment provider.' });
  }

  /* Only ever a catch-up, and only for an order that has actually been paid
     for. `deliverOrderEmails` does not throw and does nothing at all if the
     webhook has already been through, so the page is never held up by more
     than the one check. Set ORDER_EMAILS_ON_LOOKUP=0 to leave it to the
     webhook alone. */
  if (orders.isPaid(session) && process.env.ORDER_EMAILS_ON_LOOKUP !== '0') {
    const result = await email.deliverOrderEmails(session);
    if (result.sent) {
      console.log('Order emails sent from the confirmation page for ' +
        orders.reference(sessionId) + ' — the webhook did not get there first.');
    }
  }

  return res.status(200).json(orders.view(session));
};
