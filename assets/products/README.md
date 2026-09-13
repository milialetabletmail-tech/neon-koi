## tee-01-blue-gold.png / tee-02-amber-teal.png / tee-03-berry-navy.png

Product photos supplied by the site owner as flat-lay shots on a solid
black backdrop. Background removed by flood-filling from the image
border across near-black pixels (max channel < 10) rather than a flat
luminance threshold — a plain "anything dark is background" cut would
have also eaten the tee's own dark dye patches (navy, plum), since
those are darker than the surrounding fabric too. Flood-filling from
the border only removes the backdrop itself; any dark pixel not
connected to the edge (a dye fleck fully inside the garment's
silhouette) stays part of the cutout. Edges feathered with a 1px
gaussian blur on the resulting alpha mask to avoid a hard-pixelated
outline, then cropped tight to content.

Used directly (`object-fit: contain`, no card background) in the
catalog grid, the homepage carousel, and the cart line items — see
`.catalog-card-media.has-photo`, `.collection-preview-media.has-photo`,
`.cart-item-media` in css/style.css.
