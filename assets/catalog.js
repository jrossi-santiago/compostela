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
   * ⚠ NOT YET CONFIRMED — `standard` and `large` below are placeholders.
   * `confirmed` is the real ladder, settled for The Storm on the Sea of
   * Galilee and since applied to every work added after it. Replace the
   * other two before taking an order for anything still on them.
   * ======================================================================= */

  // Prices in integer cents. 4500 === $45.00. Never use decimals here.
  var priceLadder = {
    // Framed totals come out at $35.99 / $59.99 / $99.99 once framePrices
    // is added on.
    confirmed: { '5x7': 999, '8x10': 1599, '18x24': 1999, '24x36': 2999 },
    standard:  { '5x7': 2500, '8x10': 4500, '18x24': 9500, '24x36': 16500 },
    large:     { '5x7': 3000, '8x10': 5500, '18x24': 11500, '24x36': 18500 }
  };

  /* =========================================================================
   * End of the unconfirmed block. Everything below is confirmed or structure.
   * ======================================================================= */

  /* Framing add-on, in cents, by size. It is charged on top of the print
   * price, so a framed 8 × 10 of a $15.99 print comes to $35.99.
   *
   * A size missing from this map is not offered framed at all — that is how
   * 5 × 7 ends up print-only, rather than by a flag somewhere else.
   */
  var framePrices = {
    '8x10': 2000,
    '18x24': 4000,
    '24x36': 7000
  };

  /* Frame colours. The add-on above is the same whichever colour is chosen,
   * so colour carries no price of its own. A frame may set `price` to a
   * per-size map of its own if one ever costs more than the others. */
  var frames = [
    { id: 'none', label: 'Unframed print' },
    { id: 'black', label: 'Black', swatch: '#1c1a17' },
    { id: 'white', label: 'White', swatch: '#f4f1ea' },
    { id: 'red-oak', label: 'Red oak', swatch: '#b5703c' }
  ];

  // Shown in the product page accordions AND used as the Stripe description.
  // Written once, here.
  var policies = {
    details:
      'Archival pigment print on 310gsm cotton rag, matte finish. Printed to ' +
      'order. Borders sized for framing without trimming.',
    framing:
      'Frames are made to the print’s dimensions in black, white or red oak, ' +
      'glazed with UV-filtering acrylic and delivered wired and ready to ' +
      'hang. The smallest size is sold as a print only.',
    shipping: [
      'Seven to ten days from order to delivery. Prints are made when you order, so the first few of those days are spent at the press.',
      'Unframed prints ship rolled in a rigid tube; framed pieces ship boxed and corner-protected.',
      'Shipping is charged by size, and framed pieces cost more to send than rolled prints. The rate for what you have selected is shown with the price.'
    ],
    returns: [
      'If a piece arrives damaged or is not what you expected, write to us and we will replace it or refund it.'
    ],
    // In-stock line on the product page.
    stockNote: 'Printed and dispatched to order.'
  };

  /* Shipping, in cents, by size and by whether the piece is framed. Stripe
   * reads this at checkout.
   *
   * A basket pays the single highest rate it contains rather than the sum —
   * two prints in one order still ship as one order. `framed: null` marks a
   * size that is never framed, and should agree with `framePrices` above.
   *
   * `allowedCountries` is deliberately US-only until international duties and
   * rates are settled — an empty international policy is worse than not
   * shipping there yet. Add ISO codes ('CA', 'GB', 'IE', ...) when ready.
   */
  var shipping = {
    allowedCountries: ['US'],
    label: 'Standard shipping',
    // 7–10 days from order to delivery, calendar days rather than working
    // days — this is what the product page promises.
    minDays: 7,
    maxDays: 10,
    rates: {
      '5x7':   { unframed: 499, framed: null },
      '8x10':  { unframed: 499, framed: 1049 },
      '18x24': { unframed: 499, framed: 1399 },
      '24x36': { unframed: 799, framed: 2999 }
    }
  };

  /* Size ids are the dimensions themselves, so a price ladder, a shipping
   * rate and a ?size= parameter all read the same and cannot be mixed up. */
  var sizes = [
    { id: '5x7', label: 'Small', dimensions: '5 × 7 in' },
    { id: '8x10', label: 'Medium', dimensions: '8 × 10 in' },
    { id: '18x24', label: 'Large', dimensions: '18 × 24 in' },
    { id: '24x36', label: 'Extra large', dimensions: '24 × 36 in' }
  ];

  var collections = [
    { id: 'gospels', label: 'The Gospels' },
    { id: 'marian', label: 'Marian' },
    { id: 'passion', label: 'The Passion' },
    { id: 'saints', label: 'The Saints' },
    { id: 'sacraments', label: 'The Sacraments' }
  ];

  /* Per-work fields:
   *   slug        file name in assets/art/, and the ?work= URL
   *   prices      a price ladder, or an inline { sm, md, lg } of your own
   *   soldOut     array of size ids that are unavailable, e.g. ['24x36']
   *   featured    surfaces first under the default gallery sort
   *   blurb       one line, used for the page's meta description
   *   description the paragraph on the product page
   *   details     OPTIONAL — only when a work differs from policies.details
   */
  var works = [
    {
      slug: 'the-storm-on-the-sea-of-galilee',
      title: 'The Storm on the Sea of Galilee',
      artist: 'Rembrandt',
      year: '1633',
      medium: 'Oil on canvas',
      collection: 'gospels',
      prices: priceLadder.confirmed,
      featured: true,
      blurb: 'Rembrandt’s only seascape, and the most famous painting nobody can see.',
      description: 'Mark 4 verses 35 to 41, painted when Rembrandt was twenty-seven: the boat pitched almost vertical, the sail already splitting, and Christ at the stern being woken by men who have run out of nerve. Count the figures and there are fourteen aboard where the Gospel has thirteen — the one gripping a rope and looking straight out at you is Rembrandt himself. The canvas was cut from its frame at the Isabella Stewart Gardner Museum in 1990 and has never been recovered. The empty frame still hangs in the room it was taken from.'
    },
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
      slug: 'landscape-with-the-rest-on-the-flight-into-egypt',
      title: 'Landscape with the Rest on the Flight into Egypt',
      artist: 'Claude Lorrain',
      year: '1647',
      medium: 'Oil on canvas',
      collection: 'gospels',
      prices: priceLadder.confirmed,
      featured: true,
      blurb: 'The Holy Family stopped by a river, in the last hour of afternoon light.',
      description: 'Claude painted the sun itself more convincingly than anyone before him, and here he spends it on a rest stop: the family halted at the water, the road still ahead, the whole of Egypt somewhere past the hills. The figures are small on purpose. The subject is the light they are sitting in.'
    },
    {
      slug: 'landscape-with-saint-george-and-the-dragon',
      title: 'Landscape with Saint George and the Dragon',
      artist: 'Claude Lorrain',
      year: 'c. 1643',
      medium: 'Oil on canvas',
      collection: 'saints',
      prices: priceLadder.confirmed,
      blurb: 'The dragon fought at the far end of a valley, most of the picture given to the weather.',
      description: 'The saint is on his horse in the middle distance and the dragon is barely larger than the horse. Claude keeps the trees, the river and the mountain at full scale and lets the legend happen somewhere inside them. Hung wide, it reads as a room with a view rather than a battle.'
    },
    {
      slug: 'saint-francis-in-the-desert',
      title: 'Saint Francis in the Desert',
      artist: 'Giovanni Bellini',
      year: 'c. 1480',
      medium: 'Tempera and oil on panel',
      collection: 'saints',
      prices: priceLadder.confirmed,
      featured: true,
      blurb: 'Francis steps out of his study into the light, and every object in the picture is watching.',
      description: 'A desk, a skull, a pair of sandals set down, a donkey, a heron, a rabbit in the wall — Bellini fills the panel with things and gives each one its full attention. The saint has come out barefoot with his arms open. Nothing in the picture is explained, which is why it holds.'
    },
    {
      slug: 'saint-catherine-of-alexandria',
      title: 'Saint Catherine of Alexandria',
      artist: 'Raphael',
      year: 'c. 1507',
      medium: 'Oil on panel',
      collection: 'saints',
      prices: priceLadder.confirmed,
      blurb: 'Leaning on the wheel she was to be broken on, looking up at the light instead.',
      description: 'Raphael gives Catherine the contrapposto of a classical statue and the wheel of her martyrdom to rest an arm on, then turns her face up and away from both. The landscape behind her is doing almost nothing, deliberately. Everything is in the twist of the body and the direction of the gaze.'
    },
    {
      slug: 'saint-joseph-and-the-christ-child',
      title: 'Saint Joseph and the Christ Child',
      artist: 'Guido Reni',
      year: 'c. 1640',
      medium: 'Oil on canvas',
      collection: 'saints',
      prices: priceLadder.confirmed,
      featured: true,
      blurb: 'An old man holding a baby, and neither of them looking anywhere else.',
      description: 'Reni paints Joseph as elderly and weathered against a gold-brown cloak, the child bright against him, the two of them locked in a look. There is no throne, no symbol, nothing to read. It is the most ordinary picture of fatherhood the tradition produced.'
    },
    {
      slug: 'salus-populi-romani',
      title: 'Salus Populi Romani',
      artist: 'Unknown, Rome',
      year: 'before 1200',
      medium: 'Tempera on cedar panel',
      collection: 'marian',
      prices: priceLadder.confirmed,
      blurb: 'The Roman Marian icon, cleaned in 2018 and back to its gold.',
      description: 'Kept at Santa Maria Maggiore and carried through Rome in plague and war for as long as anyone has records. The Vatican Museums finished a restoration in 2018 that took off centuries of overpaint; the gold and the blue of the mantle in this file are what came back out. Its date is still argued over, which is part of its character.'
    },
    {
      slug: 'the-apostle-paul',
      title: 'The Apostle Paul',
      artist: 'Rembrandt',
      year: '1659',
      medium: 'Oil on canvas',
      collection: 'saints',
      prices: priceLadder.confirmed,
      blurb: 'The letter-writer late in life, hands folded over the work.',
      description: 'Rembrandt returned to Paul repeatedly and painted him old every time — a heavy face over a fur collar, a sword just visible in the dark at the left. The hands at the bottom edge are doing the work of the picture. Printed dark, it wants a wall with some light on it.'
    },
    {
      slug: 'saint-bartholomew',
      title: 'Saint Bartholomew',
      artist: 'Rembrandt',
      year: '1661',
      medium: 'Oil on canvas',
      collection: 'saints',
      prices: priceLadder.confirmed,
      blurb: 'A hand at the chin, a knife held low, and the man deciding not to say it yet.',
      description: 'Bartholomew is identified by the knife he was flayed with, and Rembrandt puts it half out of frame at the bottom so the eye finds it second. What it finds first is a face caught mid-thought. Painted eight years before his death, and among the best of the late single figures.'
    },
    {
      slug: 'head-of-christ',
      title: 'Head of Christ',
      artist: 'Rembrandt',
      year: 'c. 1648',
      medium: 'Oil on oak panel',
      collection: 'gospels',
      prices: priceLadder.confirmed,
      featured: true,
      blurb: 'A study from life, and the first Christ in Western painting who looks like a man from the neighbourhood.',
      description: 'Twenty-five centimetres tall — smaller than the print you would hang of it. Rembrandt worked from a young Jewish model from his own Amsterdam street rather than from the inherited icon type, which had not really been done. The result is quiet, unidealised and close to modern.'
    },
    {
      slug: 'saint-casilda',
      title: 'Saint Casilda',
      artist: 'Francisco de Zurbarán',
      year: 'c. 1635',
      medium: 'Oil on canvas',
      collection: 'saints',
      prices: priceLadder.confirmed,
      blurb: 'A saint painted as a Spanish noblewoman, in the dress of Zurbarán’s own decade.',
      description: 'Zurbarán painted his female saints in contemporary court clothes, and the brocade gets the same seriousness as the face — the roses in the folded skirt are the only thing marking her as a saint at all. Tall and narrow, so it suits a stretch of wall where nothing else fits.'
    },
    {
      slug: 'saint-andrew',
      title: 'Saint Andrew',
      artist: 'José de Ribera',
      year: 'c. 1631',
      medium: 'Oil on canvas',
      collection: 'saints',
      prices: priceLadder.confirmed,
      blurb: 'An old body painted honestly, with the cross he is named for at his shoulder.',
      description: 'Ribera painted apostles as labourers and did not soften the anatomy — the ribs, the slack skin, the working hands. The X-shaped cross leans in from the right. It is a picture with no interest in flattering anybody, which is what makes it bearable to live with.'
    },
    {
      slug: 'saint-joseph-the-carpenter',
      title: 'Saint Joseph the Carpenter',
      artist: 'Georges de La Tour',
      year: 'c. 1642',
      medium: 'Oil on canvas',
      collection: 'saints',
      prices: priceLadder.confirmed,
      featured: true,
      blurb: 'One candle, held by a child, while his father drills a beam.',
      description: 'The boy’s hand glows red where the flame shines through it — La Tour’s whole reputation rests on effects like that. Joseph is boring a hole in a piece of wood that is shaped, unmistakably, like a cross. Test this one small before going large: the dark carries most of the canvas.'
    }
  ];

  return {
    currency: 'usd',
    sizes: sizes,
    frames: frames,
    framePrices: framePrices,
    collections: collections,
    policies: policies,
    shipping: shipping,
    works: works
  };
});
