/* Compostela — the catalog.
 *
 * THE source of truth. The gallery page, the product page, the basket, and
 * the Stripe charge all read this one file. Nothing here is repeated
 * anywhere else in the project, and nothing about a work is ever entered
 * into the Stripe dashboard.
 *
 * To change a price: edit one number below and push.
 * To add a work: append one object to `works`, drop assets/art/<slug>.jpg.
 *
 * Loaded by the browser as a plain <script>, and by the checkout function
 * with require(). No build step either way.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.COMPOSTELA_CATALOG = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {

  /* =========================================================================
   * ⚠ NOT YET CONFIRMED — everything in this block is a placeholder I wrote
   * to make the pages functional. Replace before taking a single order.
   * ======================================================================= */

  // Prices in integer cents. 4500 === $45.00. Never use decimals here.
  var priceLadder = {
    standard: { sm: 4500, md: 9500, lg: 16500 },
    large:    { sm: 5500, md: 11500, lg: 18500 }
  };

  var frames = [
    { id: 'none', label: 'Unframed print', price: 0 },
    { id: 'oak', label: 'Gilded oak frame', price: 8500 },
    { id: 'walnut', label: 'Dark walnut frame', price: 9500 }
  ];

  // Shown in the product page accordions AND used as the Stripe description.
  // Written once, here.
  var policies = {
    details:
      'Archival pigment print on 310gsm cotton rag, matte finish. Printed to ' +
      'order. Borders sized for framing without trimming.',
    framing:
      'Frames are made to the print’s dimensions in gilded oak or dark ' +
      'walnut, glazed with UV-filtering acrylic and delivered wired and ready ' +
      'to hang.',
    shipping: [
      'Prints are made when you order, so allow a few working days before dispatch.',
      'Unframed prints ship rolled in a rigid tube; framed pieces ship boxed and corner-protected.'
    ],
    returns: [
      'If a piece arrives damaged or is not what you expected, write to us and we will replace it or refund it.'
    ],
    // In-stock line on the product page.
    stockNote: 'Printed and dispatched to order.'
  };

  // Stripe reads this at checkout. Rates are in cents, same as prices.
  //
  // `allowedCountries` is deliberately US-only until international duties and
  // rates are settled — an empty international policy is worse than not
  // shipping there yet. Add ISO codes ('CA', 'GB', 'IE', ...) when ready.
  var shipping = {
    allowedCountries: ['US'],
    rates: [
      {
        id: 'standard',
        label: 'Standard shipping',
        price: 0,
        minDays: 3,
        maxDays: 8
      }
    ]
  };

  /* =========================================================================
   * End of the unconfirmed block. Everything below is structure.
   * ======================================================================= */

  var sizes = [
    { id: 'sm', label: 'Small', dimensions: '8 × 10 in' },
    { id: 'md', label: 'Medium', dimensions: '16 × 20 in' },
    { id: 'lg', label: 'Large', dimensions: '24 × 36 in' }
  ];

  var collections = [
    { id: 'marian', label: 'Marian' },
    { id: 'passion', label: 'The Passion' },
    { id: 'saints', label: 'The Saints' },
    { id: 'sacraments', label: 'The Sacraments' }
  ];

  /* Per-work fields:
   *   slug        file name in assets/art/, and the ?work= URL
   *   prices      a price ladder, or an inline { sm, md, lg } of your own
   *   soldOut     array of size ids that are unavailable, e.g. ['lg']
   *   featured    surfaces first under the default gallery sort
   *   blurb       one line, used for the page's meta description
   *   description the paragraph on the product page
   *   details     OPTIONAL — only when a work differs from policies.details
   */
  var works = [
    {
      slug: 'the-annunciation',
      title: 'The Annunciation',
      artist: 'Fra Angelico',
      year: 'c. 1426',
      medium: 'Tempera on panel',
      collection: 'marian',
      prices: priceLadder.standard,
      featured: true,
      blurb: 'The angel and the Virgin under a quiet loggia — the moment the whole story turns on.',
      description: 'Fra Angelico painted the Annunciation more than once, and each time with the same restraint: an empty portico, two figures bent toward one another, gold laid down like light rather than ornament. Printed warm, it reads as morning in a room rather than a scene behind glass.'
    },
    {
      slug: 'madonna-of-the-magnificat',
      title: 'Madonna of the Magnificat',
      artist: 'Sandro Botticelli',
      year: '1481',
      medium: 'Tempera on panel',
      collection: 'marian',
      prices: priceLadder.standard,
      featured: true,
      blurb: 'The Virgin writing her own canticle, circled by angels and a crown of light.',
      description: 'A tondo — a painting in the round — of Our Lady setting down the Magnificat while the Child steadies her hand. Botticelli gives the whole thing a circular pull, so the eye never quite settles. It hangs well over a desk or anywhere writing gets done.'
    },
    {
      slug: 'the-immaculate-conception',
      title: 'The Immaculate Conception',
      artist: 'Bartolomé Esteban Murillo',
      year: 'c. 1678',
      medium: 'Oil on canvas',
      collection: 'marian',
      prices: priceLadder.large,
      blurb: 'Murillo’s Virgin, standing on the moon in a wash of Spanish light.',
      description: 'Murillo returned to this subject for most of his working life. The version printed here is the late one: blue and white against a warm gold ground, the figure lifted on cloud and cherub. It carries a room on its own and needs very little around it.'
    },
    {
      slug: 'the-calling-of-saint-matthew',
      title: 'The Calling of Saint Matthew',
      artist: 'Caravaggio',
      year: '1600',
      medium: 'Oil on canvas',
      collection: 'saints',
      prices: priceLadder.large,
      featured: true,
      blurb: 'A shaft of light across a counting table, and a man asked to leave it.',
      description: 'Caravaggio put the calling in a tax office and lit it like a raid. The gesture at the center is deliberately ambiguous — Matthew may be pointing at himself, or at the man beside him — which is most of the reason the painting has held for four centuries.'
    },
    {
      slug: 'saint-francis-in-meditation',
      title: 'Saint Francis in Meditation',
      artist: 'Francisco de Zurbarán',
      year: 'c. 1635',
      medium: 'Oil on canvas',
      collection: 'saints',
      prices: priceLadder.standard,
      blurb: 'Coarse habit, folded hands, and nearly nothing else.',
      description: 'Zurbarán strips the scene to a kneeling figure and a skull, the habit painted with more attention than the face. It is a picture about attention itself — an argument for the plain room, made in paint.'
    },
    {
      slug: 'saint-jerome-writing',
      title: 'Saint Jerome Writing',
      artist: 'Caravaggio',
      year: 'c. 1605',
      medium: 'Oil on canvas',
      collection: 'saints',
      prices: priceLadder.standard,
      blurb: 'The translator at work, reaching across the table for the next line.',
      description: 'Jerome bent over the Vulgate, arm extended, red cloth falling off the shoulder. Caravaggio paints the labor rather than the halo. A study for anyone whose work is done at a desk.'
    },
    {
      slug: 'christ-crucified',
      title: 'Christ Crucified',
      artist: 'Diego Velázquez',
      year: 'c. 1632',
      medium: 'Oil on canvas',
      collection: 'passion',
      prices: priceLadder.large,
      featured: true,
      blurb: 'The figure alone against black, hair fallen across the face.',
      description: 'Velázquez gives no crowd, no landscape, no weather — only the body and the dark behind it. The restraint is the point. Printed large, it becomes the still center of a hallway or a chapel corner.'
    },
    {
      slug: 'the-transfiguration',
      title: 'The Transfiguration',
      artist: 'Raphael',
      year: '1516–1520',
      medium: 'Oil on wood',
      collection: 'passion',
      prices: priceLadder.large,
      soldOut: ['lg'],
      blurb: 'Raphael’s last painting: glory above, and a crowd below that cannot heal anyone.',
      description: 'Two registers held in one frame — the mountain lit white, the confusion at its foot. Raphael was still working on it when he died, and it hung above him at his funeral. The lower half is why it is a great painting and not merely a beautiful one.'
    },
    {
      slug: 'the-return-of-the-prodigal-son',
      title: 'The Return of the Prodigal Son',
      artist: 'Rembrandt',
      year: 'c. 1668',
      medium: 'Oil on canvas',
      collection: 'sacraments',
      prices: priceLadder.large,
      featured: true,
      blurb: 'Two hands on a ruined son’s back — the whole of confession in one gesture.',
      description: 'Late Rembrandt, painted in the last year or so of his life. The son’s shoes are worn through; the father’s hands are not identical, and generations of writers have argued about why. Whatever the answer, the picture is about being received back.'
    },
    {
      slug: 'the-supper-at-emmaus',
      title: 'The Supper at Emmaus',
      artist: 'Caravaggio',
      year: '1601',
      medium: 'Oil on canvas',
      collection: 'sacraments',
      prices: priceLadder.standard,
      blurb: 'The instant of recognition, at a table set with ordinary supper.',
      description: 'Bread broken at an inn, and two disciples who suddenly know who is sitting with them. Caravaggio pushes the basket to the edge of the table so it seems about to fall into the room — the viewer is meant to be at that table, not looking at it.'
    },
    {
      slug: 'the-disputation-of-the-holy-sacrament',
      title: 'The Disputation of the Holy Sacrament',
      artist: 'Raphael',
      year: '1509–1510',
      medium: 'Fresco',
      collection: 'sacraments',
      prices: priceLadder.large,
      blurb: 'Heaven and the doctors of the Church, arranged around a monstrance.',
      description: 'Painted for the Stanza della Segnatura, opposite the School of Athens. Everything on the wall — saints, popes, theologians, the Trinity in a vertical axis — is organized around the Host on the altar. A picture that argues by composition.'
    },
    {
      slug: 'the-adoration-of-the-magi',
      title: 'The Adoration of the Magi',
      artist: 'Gentile da Fabriano',
      year: '1423',
      medium: 'Tempera on panel',
      collection: 'marian',
      prices: priceLadder.standard,
      blurb: 'Gold ground, a long procession, and the last stretch of a very long road.',
      description: 'The high point of the International Gothic — tooled gold, brocade, animals worked in at the edges, and the whole journey folded into the background hills. Printed warm, the gold reads as candlelight rather than metal.'
    }
  ];

  return {
    currency: 'usd',
    sizes: sizes,
    frames: frames,
    collections: collections,
    policies: policies,
    shipping: shipping,
    works: works
  };
});
