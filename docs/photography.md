# Website photography

The 27 final JPEGs supplied in `website images/Website Images Assets/` are now used across all 54 pages. The homepage now uses the approved scroll hero; other page introductions are unchanged. The lower “More spaces. More details.” section now uses six newer supplied photographs instead of legacy website images.

## Art direction

The existing Summit palette carries through: brown `#81411c`, rust `#a1451b`, orange `#cc5f28`, ink `#272c29`, sage `#e7ece5`, and paper `#fafbf8`. Existing display and body typography remains intact. Larger construction/finished-room pairings lead the Services page; a composition of a room detail, faucet, and vanity gives the lower section a more intimate scale. Service and guide cards use photography. Editorial pages interleave images with their existing text; utility pages use a quiet decorative strip below their content.

Initial review replaced a repeated kitchen overview with a distinct sink detail, so the composition adds another view instead of repeating a service-card image. No fabricated before/after labels, case-study descriptions, named customer projects, or city claims were introduced. Geographic filenames are inherited asset names and do not establish a project location.

## Sources and outputs

- `src/photos.mjs`: source catalog, descriptive alt text, captions, service/topic mapping, picture markup, and gallery.
- `scripts/prepare-photos.mjs`: optional authoring step using Sharp; originals are never changed.
- `data/photo-assets.json`: source path, byte sizes, and output inventory.
- `public/assets/`: four responsive WebP sizes (480, 800, 1280, 1920 pixels) plus a 1280px JPEG fallback per photo.

Responsive WebP images average approximately 15 KB at 480px, 36 KB at 800px, 77 KB at 1280px, and 156 KB at 1920px. All image slots reserve space and use lazy loading. Social previews and Article structured data reference relevant photos.

Normal builds use the prepared image files and require no image library. To regenerate them, use a Node installation with Sharp available, or set `SHARP_MODULE` to an installed module path and run `npm run photos`, then rebuild. The Node runtime and Sharp native binary must have matching CPU architectures.

The supplied manifest identifies Runway processing and links original filenames to final assets. That provenance is retained in the source folder. Captions describe visible content; the photos are not presented as independent verification of dimensions, site conditions, credentials, or code compliance.

## Gallery behavior

The main Projects gallery combines 15 still images and six films, with kitchens, bathrooms, and construction filters. Six additional supplied photos are reserved for “More spaces. More details.” so none repeat within the page. See [video design](video-design.md) for hover playback and performance behavior. Full-image anchors work without JavaScript. With JavaScript, a native dialog adds next/previous navigation, arrow keys, Escape dismissal, and focus return. Motion is limited to subtle photo hover scaling and is disabled for reduced-motion preferences.
