# Compostela

A Catholic press. Static site — plain HTML, CSS and JavaScript, no build step
and no framework — plus two serverless functions that talk to Stripe.

```
index.html            landing page
gallery.html          the shop
product.html          one work, read from ?work=<slug>
thank-you.html        order confirmation, read from ?session_id=<id>

assets/catalog.js     THE source of truth: works, prices, policies, shipping
assets/pricing.js     price + validation logic, shared by browser and server
assets/shop.js        basket, drawer, checkout hand-off
assets/site.css       shop chrome
assets/art/<slug>.jpg artwork, named after the slug

api/checkout.js       creates the Stripe Checkout Session
api/order.js          reads one back, for the confirmation page
api/webhook.js        Stripe says an order is paid; the emails go out
api/_order.js         reading a session back — shared, not a route
api/_email.js         the two order emails, and sending them once
```

Files in `api/` beginning with `_` are shared modules, not endpoints — Vercel
does not turn them into functions.

## The one-place rule

Everything about a work — title, artist, description, prices, sizes, framing,
sold-out state — lives in **`assets/catalog.js`** and nowhere else.

- **No products are created in the Stripe dashboard.** Stripe is handed an
  amount at checkout time and charges it. There is no second catalog to keep
  in sync.
- **Prices are computed by one module.** `assets/pricing.js` runs in the
  browser *and* inside the checkout function, so the price shown and the
  price charged cannot drift apart.
- **Policy text is written once.** Shipping, returns and print specs live in
  `catalog.policies` and are rendered into both the gallery and the product
  page accordions.

To change a price: edit one number in `catalog.js`, push.
To add a work: append one object to `works`, drop in `assets/art/<slug>.jpg`.

Amounts are **integer cents** — `4500` is $45.00. Never write decimals.

## How a piece is priced

Three numbers make up what a customer pays, and each lives in exactly one
place in `catalog.js`:

| part | where | varies by |
|---|---|---|
| print | `works[].prices` | work, size |
| framing | `framePrices` | size |
| shipping | `shipping.rates` | size, framed or not |

Framing is an **add-on**, not a second price: a $15.99 8 × 10 with the $20.00
add-on is the $35.99 framed piece. A size left out of `framePrices` is not
offered framed at all — that is the whole mechanism behind 5 × 7 being
print-only, and `shipping.rates` marks the same size `framed: null` to match.

A basket pays **one** shipping charge, the highest rate it contains, so two
prints in an order ship as one order.

### The Storm on the Sea of Galilee — confirmed

| size | print | framed | ship (print) | ship (framed) |
|---|---|---|---|---|
| 5 × 7   |  $9.99 | —       | $4.99 | — |
| 8 × 10  | $15.99 | $35.99  | $4.99 | $10.49 |
| 18 × 24 | $19.99 | $59.99  | $4.99 | $13.99 |
| 24 × 36 | $29.99 | $99.99  | $7.99 | $29.99 |

Frames come in black, white or red oak, all at the same add-on. Delivery is
7–10 days from order, set once in `shipping.minDays` / `maxDays` and used by
the product page, the basket and the Stripe delivery estimate alike.

## Still to fill in

`assets/catalog.js` has a block near the top marked `⚠ NOT YET CONFIRMED`:

1. **The placeholder price ladders.** `priceLadder.standard` and
   `priceLadder.large` are invented numbers, and the other twelve works all
   still use them. Only The Storm on the Sea of Galilee has confirmed prices,
   written inline on the work itself. Replace the ladders before selling
   anything else — as it stands the placeholders run well above the one work
   that is priced for real.
2. **`policies.returns`** — currently deliberately vague. Write the real terms.
3. **`shipping.allowedCountries`** — set to `['US']` only. Add ISO codes once
   international rates and duties are settled.
4. **Artwork** — only `the-storm-on-the-sea-of-galilee.jpg` is in
   `assets/art/`; the rest draw a placeholder plate until a file lands. See
   `assets/art/README.md` for the naming convention and image specs.

## Deploying (Vercel)

1. Import the repository in Vercel. No framework preset, no build command —
   it serves the static files and turns `api/` into functions on its own.
2. Add the environment variable **`STRIPE_SECRET_KEY`** in Project Settings →
   Environment Variables. Use the test key (`sk_test_…`) first. It is only
   ever read server-side; it must never be committed or appear in any page.
3. Deploy. `/api/checkout` and `/api/order` go live with the site.

Optional: set `STRIPE_TAX=1` **only after** enabling Stripe Tax and adding
your registrations in the Stripe dashboard. Until then, leave it unset —
turning it on early makes every checkout session fail.

## How checkout works

1. The browser posts identifiers only — `[{slug, sizeId, frameId, qty}]`. No
   prices leave the page.
2. `api/checkout.js` resolves each line against the catalog, rejecting
   unknown works and sold-out sizes, and computes the total itself.
3. It creates a Stripe Checkout Session with the amounts built on the fly.
4. The customer pays on Stripe's hosted page.
5. Stripe returns them to `thank-you.html?session_id=…`, which asks
   `api/order.js` what was actually bought and shows it back to them.
6. Stripe also calls `api/webhook.js`, which emails the order to the press and
   a confirmation to the customer. See **Order email** below.

Because step 2 never trusts a number from the browser, a customer editing
their local storage cannot change what they are charged.

## The confirmation page

`thank-you.html` cannot ask Stripe anything itself — reading a session needs
the secret key. So it calls `api/order.js`, which returns a narrow view of the
order: reference, line items, totals, shipping address, and the card brand and
last four. No payment intent, no customer id, nothing else.

Holding the session id is what authorises the read, which is the same basis
Stripe's own hosted receipts use — the id is long, random, and was just handed
to that customer.

The page has four states, and the difference between them matters:

| state | what the customer sees | basket |
|---|---|---|
| paid | full order summary | cleared |
| not paid (backed out, expired) | "this one did not go through" | **kept** |
| lookup failed | thank-you + reference to quote | **kept** |
| no `session_id` (bookmark, back button) | "nothing to show here" | **kept** |

The basket is only ever emptied once Stripe has confirmed payment. Clearing it
on arrival would throw away a live basket whenever a lookup hiccuped or someone
opened the page by accident.

## Order email

Every paid order sends two emails, both through [Resend](https://resend.com)
over its REST API — there is no SDK to install, for the same reason there is no
build step.

| | goes to | carries |
|---|---|---|
| **fulfilment alert** | `ORDER_ALERT_EMAIL` | everything needed to make and post the order: reference, customer, address, each piece with its size, frame and slug, the money, a copyable packing list, and a link to the payment in Stripe. Reply to it and you are writing to the customer. |
| **confirmation** | the customer | what they bought, what it cost, where it is going, the delivery window in real dates, the print and returns terms, and that **a tracking number follows when it ships**. |

Both are built in `api/_email.js` from the same order view the confirmation
page uses, so the page and the emails cannot describe one order two ways. Every
word of policy in them — print spec, framing, shipping, returns, the 7–10 day
window — is read from `catalog.policies` and `catalog.shipping` rather than
written a second time.

### What sends them

`api/webhook.js` is the reliable path: Stripe reports the payment and keeps
reporting it until the endpoint answers 2xx, whether or not the customer's
browser ever comes back. Nothing in the request body is trusted for the order's
contents — the session id is taken from the event and the order is read back
from Stripe with the secret key.

`api/order.js` is the backstop. If someone lands on the confirmation page and
the webhook has not been through — not set up yet, or still in Stripe's retry
queue — the lookup sends the emails itself.

Both routes go through one function, which claims the order by writing
`orderEmailsAt` into the session's metadata *before* sending. Whoever claims it
first is the one that sends, so a webhook retry, a page reload and a
double-delivery all cost nothing. If nothing goes out, the claim is dropped
again so the next attempt is a real one. No database is involved.

### Setting it up

1. **Resend.** Create an API key and set `RESEND_API_KEY`.
2. **A verified sender.** Until a domain is verified, Resend's shared sender
   only delivers to your own Resend account address — the fulfilment alert will
   arrive and customer confirmations will not. Verify your domain, then set
   `ORDER_FROM` to an address on it. This is the one step that cannot be
   skipped before taking real orders.
3. **The webhook.** In Stripe: Developers → Webhooks → add
   `https://<your-domain>/api/webhook`, subscribed to
   `checkout.session.completed` and `checkout.session.async_payment_succeeded`.
   Copy the signing secret into `STRIPE_WEBHOOK_SECRET`. Test mode and live
   mode have separate endpoints and separate secrets.

`STRIPE_WEBHOOK_SECRET` is required, not optional: an unverified webhook
endpoint is a send button for strangers, so without it every delivery is
refused. The remaining variables are documented in `.env.example`.

Orders also appear in the Stripe dashboard as they always did. Fulfilment
itself is still by hand — a hand-off to a print lab would be the next piece.

## Running locally

The pages work over any static server, with checkout disabled:

```sh
python3 -m http.server 8000
```

For the checkout function too, use the Vercel CLI, which loads `.env.local`
(copy `.env.example` to start):

```sh
npm install
npx vercel dev
```
