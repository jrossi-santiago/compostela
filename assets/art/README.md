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
