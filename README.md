# Compostela

A Catholic press. Static site — plain HTML, CSS and JavaScript, no build step
and no framework — plus one serverless function that creates Stripe Checkout
sessions.

```
index.html            landing page
gallery.html          the shop
product.html          one work, read from ?work=<slug>
thank-you.html        where Stripe returns the customer

assets/catalog.js     THE source of truth: works, prices, policies, shipping
assets/pricing.js     price + validation logic, shared by browser and server
assets/shop.js        basket, drawer, checkout hand-off
assets/site.css       shop chrome
assets/art/<slug>.jpg artwork, named after the slug

api/checkout.js       creates the Stripe Checkout Session
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

## Still to fill in

`assets/catalog.js` has a block near the top marked `⚠ NOT YET CONFIRMED`.
It holds placeholder values I wrote so the pages would function. Replace all
of it before taking an order:

1. **Prices** — the size ladders and the frame surcharges.
2. **`policies.shipping` / `policies.returns`** — currently deliberately
   vague. Write the real terms.
3. **`shipping.rates`** — what you actually charge, in cents.
4. **`shipping.allowedCountries`** — set to `['US']` only. Add ISO codes once
   international rates and duties are settled.
5. **Artwork** — see `assets/art/README.md` for the naming convention and
   image specs.

## Deploying (Vercel)

1. Import the repository in Vercel. No framework preset, no build command —
   it serves the static files and turns `api/` into functions on its own.
2. Add the environment variable **`STRIPE_SECRET_KEY`** in Project Settings →
   Environment Variables. Use the test key (`sk_test_…`) first. It is only
   ever read server-side; it must never be committed or appear in any page.
3. Deploy. `/api/checkout` goes live with the site.

Optional: set `STRIPE_TAX=1` **only after** enabling Stripe Tax and adding
your registrations in the Stripe dashboard. Until then, leave it unset —
turning it on early makes every checkout session fail.

## How checkout works

1. The browser posts identifiers only — `[{slug, sizeId, frameId, qty}]`. No
   prices leave the page.
2. `api/checkout.js` resolves each line against the catalog, rejecting
   unknown works and sold-out sizes, and computes the total itself.
3. It creates a Stripe Checkout Session with the amounts built on the fly.
4. The customer pays on Stripe's hosted page; Stripe sends the receipt.
5. Stripe returns them to `thank-you.html`, which clears the basket.

Because step 2 never trusts a number from the browser, a customer editing
their local storage cannot change what they are charged.

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
