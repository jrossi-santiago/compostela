/* The two emails an order sends, and the once-only delivery of them.
 *
 *   1. the fulfilment alert  → ORDER_ALERT_EMAIL, everything needed to print,
 *      frame, pack and post the order, plus a plain-text packing list.
 *   2. the customer's confirmation → what they bought, what it cost, where it
 *      is going, when to expect it, and that a tracking number follows on
 *      dispatch.
 *
 * Underscore-prefixed files in api/ are not turned into routes by Vercel, so
 * this is a shared module rather than an endpoint. Both the Stripe webhook
 * (api/webhook.js) and the confirmation page's lookup (api/order.js) call
 * `deliverOrderEmails`, and the marker written into the session's metadata is
 * what stops an order being emailed twice.
 *
 * Sending goes through Resend's REST API with `fetch`, so there is no SDK to
 * install and nothing to keep in step — the same reason nothing else here has
 * a build step. Requires RESEND_API_KEY; see .env.example for the rest.
 *
 * Wording, prices and policy text all come from assets/catalog.js. Nothing
 * about a work, a rate or a promise is written twice.
 */
const pricing = require('../assets/pricing.js');
const orders = require('./_order.js');

const catalog = pricing.catalog;

/* Written into the session metadata once the emails have gone out. Its
   presence is the whole of the de-duplication: Stripe retries a webhook it
   did not get a 2xx for, and the confirmation page can be reloaded all day. */
const SENT_MARKER = 'orderEmailsAt';

const RESEND_ENDPOINT = 'https://api.resend.com/emails';

const DAY = 86400000;

/* ------------------------------------------------------------------ config */

/* Where the fulfilment alert goes. Deliberately server-side only: this address
   is never rendered into a page, and must not be moved into assets/catalog.js,
   which the browser downloads. */
function alertTo() {
  return process.env.ORDER_ALERT_EMAIL || 'josephrossi613@gmail.com';
}

/* Both emails are sent from the press's own address, on the subdomain verified
   in Resend. A subdomain rather than the bare domain on purpose: if order mail
   ever draws spam complaints, the reputation damage is confined to send. and
   leaves ordinary compostela.press mail alone.

   Resend refuses to send from a domain it has not verified, so if this ever
   changes it has to be changed in Resend first. ORDER_FROM overrides it
   without a deploy. */
function from() {
  return process.env.ORDER_FROM || 'Compostela <orders@send.compostela.press>';
}

/* The address a customer's reply should reach. Left unset, replies go to the
   From address rather than quietly handing out whatever ORDER_ALERT_EMAIL is. */
function customerReplyTo() {
  return process.env.ORDER_REPLY_TO || null;
}

/* Used for links back into the site. Vercel sets the production URL itself, so
   this usually needs no configuration; with neither set, the emails simply
   carry no links. */
function siteUrl() {
  if (process.env.SITE_URL) return String(process.env.SITE_URL).replace(/\/+$/, '');
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return 'https://' + process.env.VERCEL_PROJECT_PRODUCTION_URL;
  }
  return null;
}

/* ---------------------------------------------------------------- plumbing */

function escapeHTML(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/* Receipts always show the cents, even on a whole-dollar amount — the site's
   own money() drops them, which reads oddly on an order total. */
function money(cents, currency) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: (currency || catalog.currency).toUpperCase()
  }).format((cents || 0) / 100);
}

function longDate(ms) {
  return new Date(ms).toLocaleDateString('en-US', {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC'
  });
}

function shortDate(ms) {
  return new Date(ms).toLocaleDateString('en-US', {
    day: 'numeric', month: 'long', timeZone: 'UTC'
  });
}

function addressLines(a) {
  if (!a) return [];
  return [
    a.name,
    a.line1,
    a.line2,
    [a.city, a.state, a.postalCode].filter(Boolean).join(' '),
    a.country
  ].filter(Boolean);
}

/* The delivery window in real dates, from the one place the promise is made:
   catalog.shipping.minDays / maxDays. */
function deliveryWindow(order) {
  const ship = catalog.shipping;
  if (!order.placedAt) return null;
  return {
    from: shortDate(order.placedAt + ship.minDays * DAY),
    to: shortDate(order.placedAt + ship.maxDays * DAY)
  };
}

/* A line as the press needs to read it: catalog labels rather than the Stripe
   description, falling back to the description when a work has since been
   renamed or removed from the catalog. */
function describe(line) {
  const size = line.size ? pricing.sizeById(line.size) : null;
  const frame = line.frame ? pricing.frameById(line.frame) : null;
  if (!size && !frame) return line.detail || '';
  const parts = [];
  if (size) parts.push(size.label + ' — ' + size.dimensions);
  if (frame) parts.push(frame.label + (pricing.isFramed(frame.id) ? ' frame' : ''));
  return parts.join(' · ');
}

function anyFramed(order) {
  return order.lines.some((line) => line.frame && pricing.isFramed(line.frame));
}

/* --------------------------------------------------------------- transport */

async function send(message) {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error('RESEND_API_KEY is not set.');

  const response = await fetch(RESEND_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + key,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(message)
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const reason = (body && (body.message || body.error)) || response.statusText;
    throw new Error('Resend refused the message (' + response.status + '): ' + reason);
  }
  return body.id || null;
}

/* ------------------------------------------------------------- shared HTML */

const INK = '#2b2118';
const INK_SOFT = '#5c5142';
const BG = '#e5d9c3';
const RAISED = '#ece2cf';
const HAIRLINE = '#c2b59c';
const HAIRLINE_SOFT = '#d8cdb7';
const ACCENT = '#2c1930';
const SERIF = "Georgia, 'Times New Roman', 'EB Garamond', serif";

function shell(parts) {
  return '<!DOCTYPE html><html><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1">' +
    '<title>' + escapeHTML(parts.title) + '</title></head>' +
    '<body style="margin:0;padding:0;background:' + BG + ';">' +
    // Shown in the inbox preview line, then hidden in the body itself.
    '<div style="display:none;max-height:0;overflow:hidden;opacity:0;">' +
      escapeHTML(parts.preheader || '') +
    '</div>' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" ' +
      'style="background:' + BG + ';padding:28px 16px;">' +
      '<tr><td align="center">' +
        '<table role="presentation" width="600" cellpadding="0" cellspacing="0" ' +
          'style="width:100%;max-width:600px;background:' + RAISED + ';' +
          'border:1px solid ' + HAIRLINE + ';font-family:' + SERIF + ';' +
          'color:' + INK + ';font-size:16px;line-height:1.55;">' +
          parts.body +
        '</table>' +
      '</td></tr>' +
    '</table></body></html>';
}

function header(eyebrow, headline) {
  return '<tr><td style="padding:30px 32px 24px;border-bottom:1px solid ' + HAIRLINE_SOFT + ';">' +
    '<div style="font-size:11px;letter-spacing:0.2em;text-transform:uppercase;' +
      'color:' + INK_SOFT + ';">' + escapeHTML(eyebrow) + '</div>' +
    '<div style="font-size:34px;line-height:1.15;margin-top:10px;">' +
      escapeHTML(headline) + '</div>' +
  '</td></tr>';
}

function section(html, extra) {
  return '<tr><td style="padding:24px 32px;' + (extra || '') + '">' + html + '</td></tr>';
}

function fields(pairs) {
  const cells = pairs.filter((pair) => pair[1]).map((pair) =>
    '<td valign="top" style="padding:0 20px 14px 0;font-family:' + SERIF + ';">' +
      '<div style="font-size:11px;letter-spacing:0.16em;text-transform:uppercase;' +
        'color:' + INK_SOFT + ';">' + escapeHTML(pair[0]) + '</div>' +
      '<div style="font-size:16px;color:' + INK + ';margin-top:4px;">' +
        escapeHTML(pair[1]) + '</div>' +
    '</td>');
  if (!cells.length) return '';
  // Two to a row, so it stays readable on a phone.
  let html = '<table role="presentation" width="100%" cellpadding="0" cellspacing="0">';
  for (let i = 0; i < cells.length; i += 2) {
    html += '<tr>' + cells[i] + (cells[i + 1] || '<td></td>') + '</tr>';
  }
  return html + '</table>';
}

function linesTable(order) {
  const rows = order.lines.map((line) => {
    const detail = describe(line);
    return '<tr>' +
      '<td style="padding:14px 0;border-bottom:1px solid ' + HAIRLINE_SOFT + ';' +
        'font-family:' + SERIF + ';">' +
        '<div style="font-size:19px;line-height:1.25;">' + escapeHTML(line.name) +
          (line.quantity > 1 ? ' &times; ' + line.quantity : '') + '</div>' +
        (detail
          ? '<div style="font-size:14px;color:' + INK_SOFT + ';margin-top:4px;">' +
              escapeHTML(detail) + '</div>'
          : '') +
      '</td>' +
      '<td align="right" valign="top" style="padding:14px 0 14px 16px;' +
        'border-bottom:1px solid ' + HAIRLINE_SOFT + ';white-space:nowrap;' +
        'font-family:' + SERIF + ';font-size:16px;">' +
        escapeHTML(money(line.amount, order.currency)) +
      '</td>' +
    '</tr>';
  }).join('');
  return '<table role="presentation" width="100%" cellpadding="0" cellspacing="0">' +
    rows + '</table>';
}

function totalsTable(order) {
  const c = order.currency;
  const row = (label, value, strong) =>
    '<tr>' +
      '<td style="padding:5px 0;font-family:' + SERIF + ';font-size:' +
        (strong ? '20px' : '15px') + ';color:' + (strong ? INK : INK_SOFT) + ';' +
        (strong ? 'padding-top:12px;border-top:1px solid ' + HAIRLINE_SOFT + ';' : '') + '">' +
        escapeHTML(label) + '</td>' +
      '<td align="right" style="padding:5px 0;font-family:' + SERIF + ';font-size:' +
        (strong ? '20px' : '15px') + ';color:' + (strong ? INK : INK_SOFT) + ';' +
        (strong ? 'padding-top:12px;border-top:1px solid ' + HAIRLINE_SOFT + ';' : '') + '">' +
        escapeHTML(value) + '</td>' +
    '</tr>';

  return '<table role="presentation" width="100%" cellpadding="0" cellspacing="0">' +
    row('Subtotal', money(order.amountSubtotal, c)) +
    (order.amountDiscount ? row('Discount', '−' + money(order.amountDiscount, c)) : '') +
    row('Shipping', money(order.amountShipping, c)) +
    (order.amountTax ? row('Tax', money(order.amountTax, c)) : '') +
    row('Total paid', money(order.amountTotal, c), true) +
  '</table>';
}

function addressBlock(label, lines) {
  if (!lines.length) return '';
  return '<div style="font-size:11px;letter-spacing:0.16em;text-transform:uppercase;' +
      'color:' + INK_SOFT + ';">' + escapeHTML(label) + '</div>' +
    '<div style="font-size:16px;line-height:1.6;margin-top:6px;">' +
      lines.map(escapeHTML).join('<br>') + '</div>';
}

/* ---------------------------------------------------- 1. fulfilment alert */

function alertEmail(order, session) {
  const c = order.currency;
  const customer = session.customer_details || {};
  const ship = addressLines(order.shipping);
  const window_ = deliveryWindow(order);
  const site = siteUrl();

  const intent = session.payment_intent;
  const intentId = intent && (typeof intent === 'string' ? intent : intent.id);
  const dashboard = intentId
    ? 'https://dashboard.stripe.com/' + (session.livemode ? '' : 'test/') + 'payments/' + intentId
    : null;

  /* The packing list: one line per piece, in the order they come off the
     press. Kept as plain text on purpose — it copies cleanly into a lab order
     or a note in the box. */
  const packing = order.lines.map((line) => {
    const size = line.size ? pricing.sizeById(line.size) : null;
    const frame = line.frame ? pricing.frameById(line.frame) : null;
    return [
      (line.quantity || 1) + ' ×',
      line.name,
      '[' + (line.slug || 'unknown') + ']',
      size ? size.dimensions : (line.size || '?'),
      frame ? (pricing.isFramed(frame.id) ? frame.label + ' frame' : 'unframed') : (line.frame || '?')
    ].join('  ');
  }).join('\n');

  const subject = 'New order · ' + order.reference + ' · ' +
    money(order.amountTotal, c) +
    (order.lines.length === 1 ? '' : ' · ' + order.lines.length + ' pieces') +
    (session.livemode ? '' : ' [TEST]');

  const body =
    header(session.livemode ? 'Fulfilment' : 'Fulfilment · test mode', 'New order') +

    section(fields([
      ['Reference', order.reference],
      ['Placed', order.placedAt ? longDate(order.placedAt) : null],
      ['Customer', customer.name || null],
      ['Email', order.email],
      ['Phone', customer.phone || null],
      ['Paid with', order.card ? order.card.brand.toUpperCase() + ' ending ' + order.card.last4 : null]
    ])) +

    section(
      '<div style="font-size:11px;letter-spacing:0.16em;text-transform:uppercase;' +
        'color:' + INK_SOFT + ';margin-bottom:10px;">To print</div>' +
      linesTable(order),
      'border-top:1px solid ' + HAIRLINE_SOFT + ';'
    ) +

    section(totalsTable(order)) +

    section(
      '<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>' +
        '<td valign="top" style="padding-right:20px;font-family:' + SERIF + ';">' +
          (ship.length
            ? addressBlock('Ship to', ship)
            : '<div style="color:' + INK_SOFT + ';">No shipping address on this order.</div>') +
        '</td>' +
        '<td valign="top" style="font-family:' + SERIF + ';">' +
          '<div style="font-size:11px;letter-spacing:0.16em;text-transform:uppercase;' +
            'color:' + INK_SOFT + ';">Promised</div>' +
          '<div style="font-size:16px;line-height:1.6;margin-top:6px;">' +
            (window_
              ? 'Delivery ' + escapeHTML(window_.from) + ' – ' + escapeHTML(window_.to) + '.'
              : catalog.shipping.minDays + '–' + catalog.shipping.maxDays + ' days from order.') +
            '<br>Send the tracking number when it goes out.' +
          '</div>' +
        '</td>' +
      '</tr></table>',
      'border-top:1px solid ' + HAIRLINE_SOFT + ';'
    ) +

    section(
      '<div style="font-size:11px;letter-spacing:0.16em;text-transform:uppercase;' +
        'color:' + INK_SOFT + ';margin-bottom:8px;">Packing list</div>' +
      '<pre style="margin:0;padding:14px 16px;background:' + BG + ';' +
        'border:1px solid ' + HAIRLINE_SOFT + ';font-family:ui-monospace,Menlo,Consolas,monospace;' +
        'font-size:13px;line-height:1.7;color:' + INK + ';white-space:pre-wrap;">' +
        escapeHTML(packing) + '</pre>' +
      '<div style="font-size:14px;color:' + INK_SOFT + ';margin-top:12px;">' +
        escapeHTML(catalog.policies.details) +
        (anyFramed(order) ? ' ' + escapeHTML(catalog.policies.framing) : '') +
      '</div>',
      'border-top:1px solid ' + HAIRLINE_SOFT + ';'
    ) +

    ((dashboard || site) ? section(
      [
        dashboard ? '<a href="' + escapeHTML(dashboard) + '" style="color:' + ACCENT + ';">Open the payment in Stripe</a>' : '',
        site ? '<a href="' + escapeHTML(site + '/gallery.html') + '" style="color:' + ACCENT + ';">The gallery</a>' : ''
      ].filter(Boolean).join(' &nbsp;·&nbsp; '),
      'border-top:1px solid ' + HAIRLINE_SOFT + ';font-size:15px;'
    ) : '');

  const text = [
    'NEW ORDER' + (session.livemode ? '' : ' (TEST MODE)'),
    '',
    'Reference:  ' + order.reference,
    'Placed:     ' + (order.placedAt ? longDate(order.placedAt) : 'unknown'),
    'Customer:   ' + (customer.name || '—'),
    'Email:      ' + (order.email || '—'),
    customer.phone ? 'Phone:      ' + customer.phone : null,
    'Paid with:  ' + (order.card ? order.card.brand.toUpperCase() + ' ending ' + order.card.last4 : '—'),
    '',
    'TO PRINT',
    packing,
    '',
    'SHIP TO',
    ship.length ? ship.join('\n') : 'No shipping address on this order.',
    '',
    'Delivery promised: ' + (window_ ? window_.from + ' – ' + window_.to
      : catalog.shipping.minDays + '–' + catalog.shipping.maxDays + ' days from order'),
    'Send the tracking number when it goes out.',
    '',
    'MONEY',
    'Subtotal:   ' + money(order.amountSubtotal, c),
    order.amountDiscount ? 'Discount:  -' + money(order.amountDiscount, c) : null,
    'Shipping:   ' + money(order.amountShipping, c),
    order.amountTax ? 'Tax:        ' + money(order.amountTax, c) : null,
    'Total paid: ' + money(order.amountTotal, c),
    '',
    dashboard ? 'Stripe: ' + dashboard : null
  ].filter((row) => row !== null).join('\n');

  return {
    from: from(),
    to: [alertTo()],
    subject: subject,
    html: shell({
      title: subject,
      preheader: order.reference + ' — ' + order.lines.length + ' piece' +
        (order.lines.length === 1 ? '' : 's') + ' to print',
      body: body
    }),
    text: text,
    // Hit reply and you are writing to the customer.
    reply_to: order.email ? [order.email] : undefined
  };
}

/* ------------------------------------------------ 2. customer confirmation */

function confirmationEmail(order) {
  const ship = addressLines(order.shipping);
  const window_ = deliveryWindow(order);
  const site = siteUrl();
  const framed = anyFramed(order);

  const subject = 'Your Compostela order · ' + order.reference;

  const body =
    '<tr><td style="padding:26px 32px 0;font-family:' + SERIF + ';font-size:22px;' +
      'letter-spacing:0.04em;">Compostela</td></tr>' +

    header('Order confirmed', 'Thank you') +

    section(
      '<p style="margin:0;font-size:17px;line-height:1.6;">' +
        'Your order has gone through and is with the press. Everything is printed ' +
        'to order, so the first few days are spent making it rather than moving it.' +
      '</p>'
    ) +

    section(fields([
      ['Order reference', order.reference],
      ['Placed', order.placedAt ? longDate(order.placedAt) : null],
      ['Confirmation sent to', order.email],
      ['Paid with', order.card ? order.card.brand.toUpperCase() + ' ending ' + order.card.last4 : null]
    ]), 'border-top:1px solid ' + HAIRLINE_SOFT + ';') +

    section(linesTable(order), 'border-top:1px solid ' + HAIRLINE_SOFT + ';') +

    section(totalsTable(order)) +

    /* The one thing this email exists to say, given a tracking number cannot
       exist yet: it is coming, and here is roughly when. */
    section(
      '<div style="border-left:3px solid ' + ACCENT + ';padding:4px 0 4px 16px;">' +
        '<div style="font-size:11px;letter-spacing:0.16em;text-transform:uppercase;' +
          'color:' + INK_SOFT + ';">Delivery</div>' +
        '<p style="margin:8px 0 0;font-size:16px;line-height:1.6;">' +
          escapeHTML(catalog.shipping.minDays + '–' + catalog.shipping.maxDays) +
          ' days from order to delivery' +
          (window_
            ? ', which puts this one between <strong>' + escapeHTML(window_.from) +
              '</strong> and <strong>' + escapeHTML(window_.to) + '</strong>'
            : '') + '.' +
        '</p>' +
        '<p style="margin:10px 0 0;font-size:16px;line-height:1.6;">' +
          '<strong>We will email you a tracking number as soon as your order ships.</strong> ' +
          'There is nothing you need to do until then — this email is your confirmation, ' +
          'and the reference above is all we need if you write to us.' +
        '</p>' +
      '</div>',
      'border-top:1px solid ' + HAIRLINE_SOFT + ';'
    ) +

    (ship.length ? section(
      addressBlock('Shipping to', ship),
      'border-top:1px solid ' + HAIRLINE_SOFT + ';'
    ) : '') +

    section(
      '<div style="font-size:11px;letter-spacing:0.16em;text-transform:uppercase;' +
        'color:' + INK_SOFT + ';">Your print' + (order.lines.length === 1 ? '' : 's') + '</div>' +
      '<p style="margin:8px 0 0;font-size:15px;line-height:1.65;color:' + INK_SOFT + ';">' +
        escapeHTML(catalog.policies.details) + '</p>' +
      (framed
        ? '<p style="margin:10px 0 0;font-size:15px;line-height:1.65;color:' + INK_SOFT + ';">' +
            escapeHTML(catalog.policies.framing) + '</p>'
        : '') +
      '<p style="margin:10px 0 0;font-size:15px;line-height:1.65;color:' + INK_SOFT + ';">' +
        escapeHTML(catalog.policies.shipping[1]) + '</p>' +
      catalog.policies.returns.map((line) =>
        '<p style="margin:10px 0 0;font-size:15px;line-height:1.65;color:' + INK_SOFT + ';">' +
          escapeHTML(line) + '</p>').join(''),
      'border-top:1px solid ' + HAIRLINE_SOFT + ';'
    ) +

    (site ? section(
      '<a href="' + escapeHTML(site + '/gallery.html') +
        '" style="display:inline-block;padding:11px 22px;background:' + ACCENT + ';' +
        'color:#f3ead9;text-decoration:none;font-family:' + SERIF + ';font-size:16px;">' +
        'Back to the gallery</a>',
      'border-top:1px solid ' + HAIRLINE_SOFT + ';'
    ) : '') +

    '<tr><td style="padding:20px 32px 28px;border-top:1px solid ' + HAIRLINE_SOFT + ';' +
      'font-family:' + SERIF + ';font-size:13px;color:' + INK_SOFT + ';">' +
      'Compostela — a Catholic press.' +
    '</td></tr>';

  const text = [
    'COMPOSTELA',
    '',
    'Thank you — your order is confirmed.',
    '',
    'Your order has gone through and is with the press. Everything is printed to',
    'order, so the first few days are spent making it rather than moving it.',
    '',
    'Order reference: ' + order.reference,
    order.placedAt ? 'Placed: ' + longDate(order.placedAt) : null,
    order.card ? 'Paid with: ' + order.card.brand.toUpperCase() + ' ending ' + order.card.last4 : null,
    '',
    'YOUR ORDER',
    order.lines.map((line) => {
      const detail = describe(line);
      return '· ' + line.name + (line.quantity > 1 ? ' × ' + line.quantity : '') +
        (detail ? '\n  ' + detail : '') +
        '\n  ' + money(line.amount, order.currency);
    }).join('\n'),
    '',
    'Subtotal:   ' + money(order.amountSubtotal, order.currency),
    order.amountDiscount ? 'Discount:  -' + money(order.amountDiscount, order.currency) : null,
    'Shipping:   ' + money(order.amountShipping, order.currency),
    order.amountTax ? 'Tax:        ' + money(order.amountTax, order.currency) : null,
    'Total paid: ' + money(order.amountTotal, order.currency),
    '',
    'DELIVERY',
    catalog.shipping.minDays + '–' + catalog.shipping.maxDays + ' days from order to delivery' +
      (window_ ? ', which puts this one between ' + window_.from + ' and ' + window_.to : '') + '.',
    'We will email you a tracking number as soon as your order ships. There is',
    'nothing you need to do until then — this email is your confirmation, and the',
    'reference above is all we need if you write to us.',
    '',
    ship.length ? 'SHIPPING TO\n' + ship.join('\n') : null,
    '',
    catalog.policies.details,
    framed ? '\n' + catalog.policies.framing : null,
    '\n' + catalog.policies.shipping[1],
    '\n' + catalog.policies.returns.join('\n'),
    site ? '\nThe gallery: ' + site + '/gallery.html' : null,
    '',
    'Compostela — a Catholic press.'
  ].filter((row) => row !== null).join('\n');

  const message = {
    from: from(),
    to: [order.email],
    subject: subject,
    html: shell({
      title: subject,
      preheader: 'Order ' + order.reference + ' is confirmed. A tracking number follows when it ships.',
      body: body
    }),
    text: text
  };

  const replyTo = customerReplyTo();
  if (replyTo) message.reply_to = [replyTo];
  return message;
}

/* ------------------------------------------------------------- once, only */

/* Claim the order before sending, not after. Stripe retries a webhook until it
   is answered, and the confirmation page can be reloaded; whoever writes the
   marker first is the one that sends. The claim is dropped again if nothing
   went out, so a Resend outage does not swallow the order. */
async function claim(session) {
  const stamped = Object.assign({}, session.metadata, {
    [SENT_MARKER]: new Date().toISOString()
  });
  await orders.stripe.checkout.sessions.update(session.id, { metadata: stamped });
}

async function release(session) {
  const cleared = Object.assign({}, session.metadata);
  // Stripe removes a metadata key when it is set to an empty string.
  cleared[SENT_MARKER] = '';
  await orders.stripe.checkout.sessions.update(session.id, { metadata: cleared });
}

/**
 * Sends both order emails, at most once per Checkout Session.
 *
 * Returns { sent, skipped, alert, confirmation, errors } — `sent` is false
 * when nothing went out, whether because the order was already emailed or
 * because both sends failed. Never throws: the caller is either a webhook that
 * must decide its own status code, or a page lookup that must not fail because
 * an email did.
 */
async function deliverOrderEmails(session) {
  if (!session || !orders.isPaid(session)) {
    return { sent: false, skipped: 'unpaid', errors: [] };
  }
  if (session.metadata && session.metadata[SENT_MARKER]) {
    return { sent: false, skipped: 'already-sent', errors: [] };
  }
  if (!process.env.RESEND_API_KEY) {
    console.warn('Order emails are not configured: RESEND_API_KEY is unset.');
    return { sent: false, skipped: 'not-configured', errors: [] };
  }

  let claimed = false;
  try {
    await claim(session);
    claimed = true;
  } catch (err) {
    /* Better a duplicate email than a missed order: carry on unclaimed and
       say so, rather than treating a metadata write as a gate. */
    console.error('Could not mark order ' + session.id + ' as emailed:', err);
  }

  const order = orders.view(session);
  const errors = [];
  const result = { sent: false, alert: null, confirmation: null, errors: errors };

  try {
    result.alert = await send(alertEmail(order, session));
  } catch (err) {
    errors.push('alert: ' + err.message);
    console.error('Order alert failed for ' + order.reference + ':', err);
  }

  if (order.email) {
    try {
      result.confirmation = await send(confirmationEmail(order));
    } catch (err) {
      errors.push('confirmation: ' + err.message);
      console.error('Order confirmation failed for ' + order.reference + ':', err);
    }
  } else {
    errors.push('confirmation: no email address on the session.');
  }

  result.sent = Boolean(result.alert || result.confirmation);

  // Nothing went out at all — let it be retried.
  if (!result.sent && claimed) {
    try {
      await release(session);
    } catch (err) {
      console.error('Could not clear the email marker on ' + session.id + ':', err);
    }
  }

  return result;
}

module.exports = {
  SENT_MARKER,
  deliverOrderEmails,
  alertEmail,
  confirmationEmail
};
