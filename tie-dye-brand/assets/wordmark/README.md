## ln-team.png

"LN-team" brush-lettering artwork, supplied by the site owner as a photo
of the lettering over a green/tan paint-splash background. Only the ink
strokes were kept — extracted by keying on luminance (near-black ink vs.
the much brighter splash/paper) with a saturation guard so dark shadow
edges inside the splash don't bleed into the mask — then flattened to
solid black on a transparent background and cropped tight to content.

Used as a `mask-image` in `css/style.css` for all three mark placements:
`.wordmark` (header), `.hero-wordmark`, and `#preloader .preloader-mark`.
Each placement fills the mask with its own color — solid near-black
(`--ink-letter`) for the two on-brand marks, `--paper` for the preloader
mark so it stays visible against the dark preloader background — rather
than baking any one color into the artwork itself.

Supersedes the earlier `smn.png` / `smn-color.png` (SMN brand, retired)
and `ln-team-color.png` (an earlier LN-team draft that still carried the
splash and had visible grain, first added in "Add LN-team wordmark
assets (not yet wired in)").
