/* Compostela — gallery catalog.
 *
 * Single source of truth for both gallery.html and product.html.
 * Prices are integer cents so no arithmetic ever lands on a float.
 *
 * To add a work: append to `works` below, drop the image at
 * assets/art/<slug>.jpg, and both pages pick it up. Nothing else to wire.
 * Until the image exists the pages fall back to a labelled plate.
 */
window.COMPOSTELA_CATALOG = (function () {
  var sizes = [
    { id: 'sm', label: 'Small', dimensions: '8 × 10 in' },
    { id: 'md', label: 'Medium', dimensions: '16 × 20 in' },
    { id: 'lg', label: 'Large', dimensions: '24 × 36 in' }
  ];

  var frames = [
    { id: 'none', label: 'Unframed print', price: 0 },
    { id: 'oak', label: 'Gilded oak frame', price: 8500 },
    { id: 'walnut', label: 'Dark walnut frame', price: 9500 }
  ];

  var collections = [
    { id: 'marian', label: 'Marian' },
    { id: 'passion', label: 'The Passion' },
    { id: 'saints', label: 'The Saints' },
    { id: 'sacraments', label: 'The Sacraments' }
  ];

  var standard = { sm: 4500, md: 9500, lg: 16500 };
  var large = { sm: 5500, md: 11500, lg: 18500 };

  var works = [
    {
      slug: 'the-annunciation',
      title: 'The Annunciation',
      artist: 'Fra Angelico',
      year: 'c. 1426',
      medium: 'Tempera on panel',
      collection: 'marian',
      prices: standard,
      featured: true,
      blurb: 'The angel and the Virgin under a quiet loggia — the moment the whole story turns on.',
      description: 'Fra Angelico painted the Annunciation more than once, and each time with the same restraint: an empty portico, two figures bent toward one another, gold laid down like light rather than ornament. Printed warm, it reads as morning in a room rather than a scene behind glass.',
      details: 'Archival pigment print on 310gsm cotton rag, matte finish. Printed to order in the United States. Borders sized for framing without trimming. Each print is inspected by hand and signed on the reverse with the Compostela mark.'
    },
    {
      slug: 'madonna-of-the-magnificat',
      title: 'Madonna of the Magnificat',
      artist: 'Sandro Botticelli',
      year: '1481',
      medium: 'Tempera on panel',
      collection: 'marian',
      prices: standard,
      featured: true,
      blurb: 'The Virgin writing her own canticle, circled by angels and a crown of light.',
      description: 'A tondo — a painting in the round — of Our Lady setting down the Magnificat while the Child steadies her hand. Botticelli gives the whole thing a circular pull, so the eye never quite settles. It hangs well over a desk or anywhere writing gets done.',
      details: 'Archival pigment print on 310gsm cotton rag, matte finish. Printed to order in the United States. Borders sized for framing without trimming. Each print is inspected by hand and signed on the reverse with the Compostela mark.'
    },
    {
      slug: 'the-immaculate-conception',
      title: 'The Immaculate Conception',
      artist: 'Bartolomé Esteban Murillo',
      year: 'c. 1678',
      medium: 'Oil on canvas',
      collection: 'marian',
      prices: large,
      blurb: 'Murillo\'s Virgin, standing on the moon in a wash of Spanish light.',
      description: 'Murillo returned to this subject for most of his working life. The version printed here is the late one: blue and white against a warm gold ground, the figure lifted on cloud and cherub. It carries a room on its own and needs very little around it.',
      details: 'Archival pigment print on 310gsm cotton rag, matte finish. Printed to order in the United States. Borders sized for framing without trimming. Each print is inspected by hand and signed on the reverse with the Compostela mark.'
    },
    {
      slug: 'the-calling-of-saint-matthew',
      title: 'The Calling of Saint Matthew',
      artist: 'Caravaggio',
      year: '1600',
      medium: 'Oil on canvas',
      collection: 'saints',
      prices: large,
      featured: true,
      blurb: 'A shaft of light across a counting table, and a man asked to leave it.',
      description: 'Caravaggio put the calling in a tax office and lit it like a raid. The gesture at the center is deliberately ambiguous — Matthew may be pointing at himself, or at the man beside him — which is most of the reason the painting has held for four centuries.',
      details: 'Archival pigment print on 310gsm cotton rag, matte finish. Printed to order in the United States. Borders sized for framing without trimming. Each print is inspected by hand and signed on the reverse with the Compostela mark.'
    },
    {
      slug: 'saint-francis-in-meditation',
      title: 'Saint Francis in Meditation',
      artist: 'Francisco de Zurbarán',
      year: 'c. 1635',
      medium: 'Oil on canvas',
      collection: 'saints',
      prices: standard,
      blurb: 'Coarse habit, folded hands, and nearly nothing else.',
      description: 'Zurbarán strips the scene to a kneeling figure and a skull, the habit painted with more attention than the face. It is a picture about attention itself — an argument for the plain room, made in paint.',
      details: 'Archival pigment print on 310gsm cotton rag, matte finish. Printed to order in the United States. Borders sized for framing without trimming. Each print is inspected by hand and signed on the reverse with the Compostela mark.'
    },
    {
      slug: 'saint-jerome-writing',
      title: 'Saint Jerome Writing',
      artist: 'Caravaggio',
      year: 'c. 1605',
      medium: 'Oil on canvas',
      collection: 'saints',
      prices: standard,
      blurb: 'The translator at work, reaching across the table for the next line.',
      description: 'Jerome bent over the Vulgate, arm extended, red cloth falling off the shoulder. Caravaggio paints the labor rather than the halo. A study for anyone whose work is done at a desk.',
      details: 'Archival pigment print on 310gsm cotton rag, matte finish. Printed to order in the United States. Borders sized for framing without trimming. Each print is inspected by hand and signed on the reverse with the Compostela mark.'
    },
    {
      slug: 'christ-crucified',
      title: 'Christ Crucified',
      artist: 'Diego Velázquez',
      year: 'c. 1632',
      medium: 'Oil on canvas',
      collection: 'passion',
      prices: large,
      featured: true,
      blurb: 'The figure alone against black, hair fallen across the face.',
      description: 'Velázquez gives no crowd, no landscape, no weather — only the body and the dark behind it. The restraint is the point. Printed large, it becomes the still center of a hallway or a chapel corner.',
      details: 'Archival pigment print on 310gsm cotton rag, matte finish. Printed to order in the United States. Borders sized for framing without trimming. Each print is inspected by hand and signed on the reverse with the Compostela mark.'
    },
    {
      slug: 'the-transfiguration',
      title: 'The Transfiguration',
      artist: 'Raphael',
      year: '1516–1520',
      medium: 'Oil on wood',
      collection: 'passion',
      prices: large,
      soldOut: ['lg'],
      blurb: 'Raphael\'s last painting: glory above, and a crowd below that cannot heal anyone.',
      description: 'Two registers held in one frame — the mountain lit white, the confusion at its foot. Raphael was still working on it when he died, and it hung above him at his funeral. The lower half is why it is a great painting and not merely a beautiful one.',
      details: 'Archival pigment print on 310gsm cotton rag, matte finish. Printed to order in the United States. Borders sized for framing without trimming. Each print is inspected by hand and signed on the reverse with the Compostela mark.'
    },
    {
      slug: 'the-return-of-the-prodigal-son',
      title: 'The Return of the Prodigal Son',
      artist: 'Rembrandt',
      year: 'c. 1668',
      medium: 'Oil on canvas',
      collection: 'sacraments',
      prices: large,
      featured: true,
      blurb: 'Two hands on a ruined son\'s back — the whole of confession in one gesture.',
      description: 'Late Rembrandt, painted in the last year or so of his life. The son\'s shoes are worn through; the father\'s hands are not identical, and generations of writers have argued about why. Whatever the answer, the picture is about being received back.',
      details: 'Archival pigment print on 310gsm cotton rag, matte finish. Printed to order in the United States. Borders sized for framing without trimming. Each print is inspected by hand and signed on the reverse with the Compostela mark.'
    },
    {
      slug: 'the-supper-at-emmaus',
      title: 'The Supper at Emmaus',
      artist: 'Caravaggio',
      year: '1601',
      medium: 'Oil on canvas',
      collection: 'sacraments',
      prices: standard,
      blurb: 'The instant of recognition, at a table set with ordinary supper.',
      description: 'Bread broken at an inn, and two disciples who suddenly know who is sitting with them. Caravaggio pushes the basket to the edge of the table so it seems about to fall into the room — the viewer is meant to be at that table, not looking at it.',
      details: 'Archival pigment print on 310gsm cotton rag, matte finish. Printed to order in the United States. Borders sized for framing without trimming. Each print is inspected by hand and signed on the reverse with the Compostela mark.'
    },
    {
      slug: 'the-disputation-of-the-holy-sacrament',
      title: 'The Disputation of the Holy Sacrament',
      artist: 'Raphael',
      year: '1509–1510',
      medium: 'Fresco',
      collection: 'sacraments',
      prices: large,
      blurb: 'Heaven and the doctors of the Church, arranged around a monstrance.',
      description: 'Painted for the Stanza della Segnatura, opposite the School of Athens. Everything on the wall — saints, popes, theologians, the Trinity in a vertical axis — is organized around the Host on the altar. A picture that argues by composition.',
      details: 'Archival pigment print on 310gsm cotton rag, matte finish. Printed to order in the United States. Borders sized for framing without trimming. Each print is inspected by hand and signed on the reverse with the Compostela mark.'
    },
    {
      slug: 'the-adoration-of-the-magi',
      title: 'The Adoration of the Magi',
      artist: 'Gentile da Fabriano',
      year: '1423',
      medium: 'Tempera on panel',
      collection: 'marian',
      prices: standard,
      blurb: 'Gold ground, a long procession, and the last stretch of a very long road.',
      description: 'The high point of the International Gothic — tooled gold, brocade, animals worked in at the edges, and the whole journey folded into the background hills. Printed warm, the gold reads as candlelight rather than metal.',
      details: 'Archival pigment print on 310gsm cotton rag, matte finish. Printed to order in the United States. Borders sized for framing without trimming. Each print is inspected by hand and signed on the reverse with the Compostela mark.'
    }
  ];

  return {
    currency: 'USD',
    sizes: sizes,
    frames: frames,
    collections: collections,
    works: works
  };
})();
