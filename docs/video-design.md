# Mixed photo and film gallery

## Final design

The separate film-selection panels have been removed. The Projects page retains its alternating wide and paired gallery layout and category filters. Three wide positions are films: the white kitchen, addition framing, and navy kitchen. Three smaller tiles use the patterned bathroom, fixture, and shower-detail films. The remaining 15 tiles are still photographs. The “More spaces. More details.” section uses six newer supplied photographs reserved for this section, with no repeats from the main Projects gallery. Legacy image files remain in the workspace as references but are not displayed in this section.

The homepage and Services page use a shorter mixed collection with the same visual style. Individual service pages and Our Process retain one relevant inline film. The homepage now uses the approved scroll hero; other page introductions are unchanged.

## Film review and selection

The supplied folder contains 39 H.264 clips at 1280×720, approximately six seconds each, with no audio tracks. The complete collection totals about 139 MB. Review covered media metadata, midpoint frames across the collection, and beginning/middle/end sequences for eight candidates.

Six selected clips balance broad spaces with smaller architectural details. The lateral island and navy kitchen shots show layout and cabinetry; the patterned bath reveals tile and light; framing relates to additions; the faucet pullback and tub surround provide smaller details. The broad framing shot was selected over the larger backyard files. No footage was generated or altered beyond web encoding. The original files and supplied manifests remain intact.

## Playback behavior

- Gallery films have no `src` and use `preload="none"` until needed. Posters are responsive images.
- Desktop hover waits 220 milliseconds before loading, so crossing a tile briefly does not fetch its movie.
- Only one hover preview plays at a time. Pointer leave, leaving the viewport, opening the viewer, or hiding the browser tab stops and unloads it.
- Previews play once, then hold their ending frame while hovered. Leaving restores the still photograph.
- Clicking or pressing Enter opens the native video controls in the existing gallery dialog. Escape closes it and returns focus. Previous/next navigation works across both photos and films.
- Touch devices, reduced-motion preferences, Save-Data, and slow connections receive still posters until explicit playback. Mobile playback uses the 480p version.
- With JavaScript disabled, film anchors open the optimized MP4 directly.
- Inline service/process films retain visible play, pause, and replay controls. Automatic desktop playback is limited to one visible film; mobile and constrained connections require explicit play.

## Transfer and caching

The six files are encoded as 480p and 720p H.264, preserving the six-second duration and stripping unneeded metadata. Each MP4 has its metadata at the beginning for progressive playback. Mobile versions are approximately 233–672 KB; desktop versions approximately 533–1,177 KB. The original source files range from approximately 1.4–7.7 MB for this selection.

Video filenames contain a content hash. The server streams byte ranges, supports HEAD and cache validation, and gives hashed films immutable caching. It does not read entire videos into memory to serve them. Style and script URLs also receive content revisions. HTML, CSS, scripts, robots, and XML have prebuilt Brotli/gzip variants negotiated by the server.

No performance score or real-world hosting latency is claimed. Browser verification checks zero gallery-film requests on initial load/scroll, then explicit hover or tap behavior. All text and ordinary links remain accessible independently of media.

## Files and maintenance

- `src/video-catalog.mjs`: selected sources, labels, descriptions, and service mapping.
- `src/video-assets.mjs`: generated output filenames, dimensions, duration, and bytes.
- `src/photos.mjs`: mixed gallery markup and ordering.
- `src/videos.mjs`: inline service film markup.
- `public/assets/motion.js`: guarded hover and inline playback.
- `public/assets/site.js`: shared image/film dialog and gallery filters.
- `src/media.mjs`: streaming, byte ranges, and film caching.
- `src/encoding.mjs`: text compression negotiation.
- `scripts/prepare-videos.mjs`: optional FFmpeg encoding step (`npm run videos`). Normal builds use prepared media and need no FFmpeg runtime.
- `data/video-assets.json` and `data/transfer-sizes.json`: generated media and text transfer inventory.

Supplied filenames and generation manifests are retained as provenance. Gallery captions describe visible content and do not establish project locations, as-built measurements, or code compliance.
