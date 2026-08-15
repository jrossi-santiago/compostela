# Artwork images

Drop each image in this folder named after the work's `slug` in
`assets/catalog.js`, as a `.jpg`:

```
assets/art/the-annunciation.jpg
assets/art/madonna-of-the-magnificat.jpg
...
```

That is the whole wiring. `gallery.html` and `product.html` both build the
path as `assets/art/<slug>.jpg`, so nothing else needs editing when an image
lands.

Until a file exists, the page draws a labelled placeholder plate in its
place rather than a broken image — so the shop is presentable with a
partially filled folder.

## Specs

- **Format** — JPEG, sRGB, quality ~85.
- **Longest edge** — 1600–2000px. Larger than that only slows the grid down;
  the product page's zoom view is capped by the viewport anyway.
- **Crop** — none. Include the full work; the plate mats the image rather
  than cropping it, so any aspect ratio sits correctly.
- **Background** — if the source has a white border, trim it. The plate
  supplies its own mat.

## Sourcing

The works in the starter catalog are all long out of copyright. Museum open-
access programmes (the Met, the Rijksmuseum, the National Gallery of Art)
publish high-resolution files of many of them for unrestricted use — check
each institution's terms for the specific file before publishing it.

The painting being out of copyright is not the whole question: a photograph
of it can carry its own licence. Several of the best-resolution scans on
Wikimedia Commons are uploaded under CC BY-SA, which would put an
attribution and share-alike condition on prints sold from them. Every file
below is public domain or CC0, so nothing here is owed to a photographer —
which is why a couple of these are not the largest file Commons holds.

## Provenance

Each file was taken from Wikimedia Commons, at the source's own resolution,
and resized to the specs above. `The Storm on the Sea of Galilee` predates
this list; its source was not recorded.

| Slug | Commons file | Licence |
| --- | --- | --- |
| `the-annunciation` | La Anunciación, by Fra Angelico, from Prado in Google Earth - main panel.jpg | Public domain |
| `madonna-of-the-magnificat` | Magnificat Madonna - Botticelli (uffici) b.jpg | Public domain |
| `the-immaculate-conception` | Murillo immaculate conception.jpg | Public domain |
| `the-calling-of-saint-matthew` | Caravaggio — The Calling of Saint Matthew.jpg | CC0 |
| `saint-francis-in-meditation` | Francisco de Zurbarán 053.jpg | Public domain |
| `saint-jerome-writing` | Saint Jerome Writing-Caravaggio (1605-6).jpg | Public domain |
| `christ-crucified` | Cristo crucificado.jpg | Public domain |
| `the-transfiguration` | Transfiguration Raphael.jpg | Public domain |
| `the-return-of-the-prodigal-son` | Rembrandt Harmensz. van Rijn - The Return of the Prodigal Son.jpg | Public domain |
| `the-supper-at-emmaus` | 1602-3 Caravaggio,Supper at Emmaus National Gallery, London.jpg | Public domain |
| `the-disputation-of-the-holy-sacrament` | Raffael 078.jpg | Public domain |
| `the-adoration-of-the-magi` | Gentile da Fabriano - Adorazione dei Magi - Google Art ProjectFXD.jpg | Public domain |

One caveat for the print lab rather than the site: `the-transfiguration` is
1067 × 1608, the largest public-domain scan Commons carries of it. That is
inside the spec for the web, but it is the thinnest file in the folder and
the one most likely to want re-sourcing before a 24 × 36 goes to press.
