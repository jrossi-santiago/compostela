/* =====================================================================
   STRIPE CONFIGURATION  —  this is the file where the Stripe keys go.
   =====================================================================

   ONLY put PUBLIC values in this file. It is served to every visitor's
   browser, so treat everything in here as public information.

   SAFE to put here          NEVER put here
   ----------------------    ------------------------------------------
   pk_live_... / pk_test_    sk_live_... / sk_test_  (secret API key)
   Payment Link URLs         rk_live_...             (restricted key)
   Buy Button IDs            whsec_...               (webhook secret)

   A secret key committed to this repo is compromised the moment it is
   pushed. If that happens: Stripe Dashboard > Developers > API keys >
   roll the key immediately.

   ---------------------------------------------------------------------
   HOW THE STORE WORKS RIGHT NOW
   ---------------------------------------------------------------------
   This is a static site (no server), so checkout runs on Stripe Payment
   Links. A Payment Link is a full URL that Stripe hosts and that already
   has the price, the shipping rate and the tax behaviour baked into it,
   so the browser never needs a key at all. That is why `publishableKey`
   below is optional today.

   Create one Payment Link per row of the table below in
   Stripe Dashboard > Payment Links > "+ New", then paste the resulting
   https://buy.stripe.com/... URL into `paymentLinks`.

     key                 print price   shipping   customer pays
     -----------------   -----------   --------   -------------
     5x7                     $9.99       $4.99       $14.98
     8x10                   $15.99       $4.99       $20.98
     8x10-framed            $35.99      $10.49       $46.48
     18x24                  $19.99       $4.99       $24.98
     18x24-framed           $59.99      $13.99       $73.98
     24x36                  $29.99       $7.99       $37.98
     24x36-framed           $99.99      $29.99      $129.98

   Set the print price as the Payment Link's product price, and add the
   shipping amount as a Shipping Rate on that same link (Payment Link
   settings > Shipping > add a fixed-amount rate). Do not fold shipping
   into the product price — the product page shows the two separately.

   ---------------------------------------------------------------------
   FRAME COLOUR (black / white / red oak)
   ---------------------------------------------------------------------
   Frame colour does not change the price, so it does not need its own
   Payment Link. Two ways to capture it, pick one:

   A. ONE LINK PER SIZE (7 links total) — recommended.
      On each *-framed Payment Link, add a custom field:
      Payment Link settings > "Custom fields" > Add > Dropdown,
      label "Frame colour", options: Black, White, Red Oak.
      The customer picks the colour on Stripe's checkout page, and it
      shows up on the payment in the Dashboard.

   B. ONE LINK PER COLOUR (13 links total).
      If you would rather have a separate link per colour, add the
      optional per-colour keys shown commented out below. The product
      page prefers a per-colour key when one is present and falls back
      to the plain "-framed" key when it is not.

   Either way the page always appends ?client_reference_id=<sku> to the
   link, so the exact size/frame/colour the customer clicked is recorded
   on the Stripe payment even if a custom field is missed.

   ---------------------------------------------------------------------
   IF YOU LATER MOVE OFF PAYMENT LINKS
   ---------------------------------------------------------------------
   Stripe Buy Buttons and Stripe.js both need the PUBLISHABLE key. That
   is the one value that belongs in `publishableKey` below — it starts
   with pk_ and is safe in public source. The secret key (sk_) is only
   ever used from a server you control, never from this repo.
   ===================================================================== */

window.COMPOSTELA_STRIPE = {

  // ---- PUT THE PUBLISHABLE KEY HERE (pk_live_... or pk_test_...) ----
  // Optional while checkout runs on Payment Links. Leave as '' until a
  // Buy Button or Stripe.js checkout is added.
  publishableKey: '',

  // ---- PUT THE PAYMENT LINK URLs HERE ----
  // Paste the https://buy.stripe.com/... URL for each SKU.
  // An empty string means "not on sale yet" — the product page shows
  // "Coming Soon!" for that option instead of a broken checkout button.
  paymentLinks: {
    '5x7': '',

    '8x10': '',
    '8x10-framed': '',

    '18x24': '',
    '18x24-framed': '',

    '24x36': '',
    '24x36-framed': ''

    // Optional per-colour links (option B above). Uncomment and fill in
    // only if you are not using a Stripe custom field for frame colour.
    // ,
    // '8x10-framed-black': '',
    // '8x10-framed-white': '',
    // '8x10-framed-red-oak': '',
    // '18x24-framed-black': '',
    // '18x24-framed-white': '',
    // '18x24-framed-red-oak': '',
    // '24x36-framed-black': '',
    // '24x36-framed-white': '',
    // '24x36-framed-red-oak': ''
  }
};
