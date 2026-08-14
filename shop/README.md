# Shop Gallery

Static storefront. No server, no build step — the pages are plain HTML and are
served straight from the repo.

```
shop/
  index.html                          gallery listing
  storm-on-the-sea-of-galilee.html    product page (sizes, frame, price, checkout)
  stripe-config.js                    >>> THE STRIPE KEY GOES HERE <<<
  images/
    storm-on-the-sea-of-galilee.jpg         1287x1600, product page
    storm-on-the-sea-of-galilee-thumb.jpg   483x600, gallery card
    originals/
      storm-on-the-sea-of-galilee-original.jpg  3002x3731 master, not served
```

## Where the Stripe key goes

`shop/stripe-config.js`, in the `publishableKey` field. That file is the single
place any Stripe value belongs, and it carries the full instructions inline.

**Only the publishable key (`pk_live_…` / `pk_test_…`) goes there.** It is
served to every visitor's browser, so it is public by design — that is fine,
publishable keys are meant to be public. The secret key (`sk_…`), restricted
keys (`rk_…`) and webhook secrets (`whsec_…`) must never be committed to this
repo; they only ever live on a server you control. If a secret key does get
committed, roll it immediately in Stripe Dashboard → Developers → API keys.

Checkout currently runs on **Stripe Payment Links**, which need no key at all —
each link is a Stripe-hosted URL with the price and shipping already attached.
The `publishableKey` slot is there for when you move to a Buy Button or
Stripe.js, and can stay empty until then.

## Going live

1. In Stripe, create one Payment Link per row below. Set the print price as the
   product price and add the shipping amount as a **shipping rate on that same
   link** — the product page shows print and shipping as separate lines, so
   don't fold shipping into the price.

   | config key     | print  | shipping | customer pays |
   |----------------|--------|----------|---------------|
   | `5x7`          |  $9.99 |    $4.99 |    $14.98     |
   | `8x10`         | $15.99 |    $4.99 |    $20.98     |
   | `8x10-framed`  | $35.99 |   $10.49 |    $46.48     |
   | `18x24`        | $19.99 |    $4.99 |    $24.98     |
   | `18x24-framed` | $59.99 |   $13.99 |    $73.98     |
   | `24x36`        | $29.99 |    $7.99 |    $37.98     |
   | `24x36-framed` | $99.99 |   $29.99 |   $129.98     |

2. On each `*-framed` link, add a custom field: Dropdown, label
   "Frame colour", options Black / White / Red Oak. (Frame colour doesn't
   change the price, so it doesn't need its own link. If you'd rather have one
   link per colour anyway, `stripe-config.js` has commented-out keys for that.)

3. Paste each `https://buy.stripe.com/…` URL into `paymentLinks` in
   `stripe-config.js`.

4. Set delivery expectations on the links to match the page: **7–10 days from
   order to delivery.**

Any SKU left as `''` shows the site's "Coming Soon!" popup instead of sending
the customer to a broken checkout, so you can launch sizes one at a time.

The page always appends `?client_reference_id=storm-<sku>` to the link (e.g.
`storm-24x36-framed-red-oak`), so the exact size, frame and colour the customer
clicked is recorded on the Stripe payment even if the custom field is skipped.

## Adding another print

Copy `storm-on-the-sea-of-galilee.html`, swap the image, title, blurb and the
`SIZES` table in its inline script, add the new SKUs to `stripe-config.js`, and
add a card to the grid in `index.html`.

## Image provenance

Rembrandt van Rijn, *The Storm on the Sea of Galilee*, 1633, oil on canvas,
160 × 128 cm. The painting is in the public domain (the artist died in 1669).
Source file: [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Rembrandt_Christ_in_the_Storm_on_the_Lake_of_Galilee.jpg).

The 3002 × 3731 original is kept in `images/originals/` as the print master —
no page links to it. Fitting it to each sheet without cropping gives roughly
530 DPI at 5" × 7", 375 DPI at 8" × 10", 155 DPI at 18" × 24" and 125 DPI at
24" × 36". The two large sizes fall short of the 300 DPI a printer will ask
for — upscale before sending to fulfilment, or source a higher-resolution scan.

Note that the canvas is 1.24:1 and only the 8" × 10" sheet is close to that
ratio, so the other three sizes print with margins around the image rather than
filling the sheet edge to edge. The product page says as much ("printed to the
painting's own proportions, so nothing is cropped").
