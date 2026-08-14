# Compostela

A Catholic press. Static site — plain HTML, CSS and JavaScript, no build step
and no framework — plus two serverless functions that talk to Stripe.

```
index.html            landing page
gallery.html          the shop
product.html          one work, read from ?work=<slug>
checkout.html         Stripe's form, embedded in our own page
thank-you.html        order confirmation, read from ?session_id=<id>

assets/catalog.js     THE source of truth: works, prices, policies, shipping
assets/pricing.js     price + validation logic, shared by browser and server
assets/shop.js        basket, drawer, checkout hand-off
assets/site.css       shop chrome
assets/art/<slug>.jpg artwork, named after the slug

api/checkout.js       creates the Stripe Checkout Session
api/order.js          reads one back, for the confirmation page
```

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
2. Add two environment variables in Project Settings → Environment Variables:
   - **`STRIPE_SECRET_KEY`** (`sk_…`) — only ever read server-side. Never
     commit it, never let it reach a page.
   - **`STRIPE_PUBLISHABLE_KEY`** (`pk_…`) — handed to the browser so the
     embedded form can mount. Public by design.

   Both must be from the same mode. A live secret with a test publishable key
   fails at mount time with a confusing error. Use the test pair first.
3. Deploy. `/api/checkout` and `/api/order` go live with the site.

Optional: set `STRIPE_TAX=1` **only after** enabling Stripe Tax and adding
your registrations in the Stripe dashboard. Until then, leave it unset —
turning it on early makes every checkout session fail.

## How checkout works

1. "Proceed to checkout" sends the customer to `checkout.html`. Nothing is
   passed in the URL — the basket is already in localStorage.
2. That page posts identifiers only — `[{slug, sizeId, frameId, qty}]`. No
   prices leave the page.
3. `api/checkout.js` resolves each line against the catalog, rejecting
   unknown works and unavailable size/frame pairs, and computes the total
   itself.
4. It creates an **embedded** Checkout Session and returns the session's
   client secret plus the publishable key.
5. The page mounts Stripe's form inside itself, next to a read-only order
   summary. The customer never leaves `compostela.press`.
6. Stripe takes payment and sends its receipt, then returns them to
   `thank-you.html?session_id=…`, which asks `api/order.js` what was
   actually bought and shows it back to them.

Because step 3 never trusts a number from the browser, a customer editing
their local storage cannot change what they are charged.

### Why embedded rather than a redirect

The form is an iframe served by Stripe, so card details never touch this
site and it stays in PCI SAQ A scope — the same as the old redirect. What
changed is only where the frame sits.

Its **interior** is styled from Stripe Dashboard → Settings → Branding
(logo, colours, border radius, and a font from Stripe's list), not from
`site.css`. Everything around it is ours.

`checkout.html` fails closed, and never loses a basket:

| what went wrong | what the customer sees |
|---|---|
| basket empty | "Your basket is empty" |
| a line no longer sells | which line, and why |
| `js.stripe.com` blocked by an extension | "Could not load the payment form" |
| keys missing, or Stripe unreachable | "Checkout is unavailable right now" |

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

Orders appear in the Stripe dashboard. Nothing automates fulfilment yet — a
webhook to a print lab would be the next piece.

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
