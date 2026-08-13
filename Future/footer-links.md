# Footer Links (removed 2026-08-13)

## What it was

The site footer (`<footer class="footer">` in `index.html`) originally had a
`.footer-left` block with a "Year" link followed by eight placeholder
"Link" anchors, all `href="#"`:

```html
<div class="footer-left">
  <a href="#">Year</a>
  <a href="#">Link</a>
  <a href="#">Link</a>
  <a href="#">Link</a>
  <a href="#">Link</a>
  <a href="#">Link</a>
  <a href="#">Link</a>
  <a href="#">Link</a>
  <a href="#">Link</a>
</div>
```

None of the eight "Link" placeholders had been assigned real destinations or
labels yet (e.g. About, Contact, Privacy, Terms, social links, etc.), so they
were removed rather than left as dead placeholder text. The "Year" link was
kept, relabeled to the current year ("2026"), and wired up to the same
"Coming Soon!" popup used elsewhere in the nav (see below) so it doesn't look
broken while there's nothing behind it yet.

## Intent going forward

When there are real destinations for footer links again:

1. Add new `<a href="...">Label</a>` entries back inside `.footer-left` in
   `index.html`, alongside the `2026` link.
2. Give each a real `href` (or leave it `href="#"` and let it fall into the
   "Coming Soon!" popup handling below if it's not ready yet).
3. The footer layout CSS (`.footer-left { display: flex; gap: 28px; }`) does
   not need to change — it already supports any number of links.

## "Coming Soon!" popup mechanism (for reference)

The site has a small reusable "Coming Soon!" popup that appears directly
below whatever link was clicked. It's implemented once and shared by both
the top nav (`.nav-left a`) and the footer (`.footer-left a`):

- A single toast element:
  ```html
  <div class="toast" id="toast" role="status" aria-live="polite">Coming Soon!</div>
  ```
- Styled as a small, light, italic caption with no background/container
  (`.toast` / `.toast.show` rules in the `<style>` block).
- Positioned under the clicked link via JS on click, using
  `getBoundingClientRect()` to place it just below the link, then faded in
  for ~1.8s:
  ```js
  document.querySelectorAll('.nav-left a, .footer-left a').forEach(function (link) {
    link.addEventListener('click', function (e) {
      e.preventDefault();
      clearTimeout(toastTimeout);
      var rect = link.getBoundingClientRect();
      toast.style.left = (rect.left + rect.width / 2) + 'px';
      toast.style.top = (rect.bottom + 6) + 'px';
      toast.classList.add('show');
      toastTimeout = setTimeout(function () {
        toast.classList.remove('show');
      }, 1800);
    });
  });
  ```

Any new placeholder link (footer or elsewhere) just needs to be included in
that `querySelectorAll` selector to get the same "not broken, just not
ready" popup behavior.
