## ln-team.png

"LN-team" brush-lettering artwork, supplied by the site owner as a photo
of the lettering over a green/tan paint-splash background. Only the ink
strokes were kept — extracted by keying on luminance (near-black ink vs.
the much brighter splash/paper) with a saturation guard so dark shadow
edges inside the splash don't bleed into the mask — then flattened to
solid black on a transparent background and cropped tight to content.

Used as a `mask-image` in `css/style.css` for two mark placements:
`.hero-wordmark` and `#preloader .preloader-mark`. Each fills the mask
with its own color — solid near-black (`--ink-letter`) for the Hero mark,
`--paper` for the preloader mark so it stays visible against the dark
preloader background — rather than baking any one color into the artwork
itself. Both need a separate legibility treatment for the same reason:
a flat mask fill has no backdrop of its own, so it can blend into
whatever's directly behind it (the Hero mark gets `.hero-wordmark-glow`,
a soft-light-blended lift behind the whole wordmark group; the preloader
mark just sits on the flat `--ink` preloader background).

## ln-team-color.png

A second piece of artwork from the site owner: the same "LN-team"
lettering, this time over a lavender/cyan/sage paint-splash matching the
site's actual palette (the ln-team.png source photo's green/tan splash
was a placeholder/reference, not the brand colors). Background removed
via difference matting against the photo's flat backdrop (not a simple
white-alpha-threshold, since the backdrop was light gray, not pure
white) and cropped tight to content.

Used directly as a plain image (`background-image`, not a mask) for the
header `.wordmark`, since the splash color is part of the artwork itself
rather than something CSS should recolor — and unlike the two mask-based
marks above, it needs no separate glow/shadow treatment for legibility:
the black letters always have the splash's own light backdrop behind
them, regardless of what's on the page underneath the fixed corner
position as it scrolls. Downscaled to 800x500 (from the 1352x845
source) and re-compressed — the header mark never renders past ~136px
wide even at max viewport width, so the source resolution was pure
dead weight (1.6MB for a corner logo).

Supersedes `smn.png` / `smn-color.png` (SMN brand, retired) and the
first version of `ln-team-color.png` (an earlier LN-team draft that
still carried visible grain/noise, first added in "Add LN-team wordmark
assets (not yet wired in)").
