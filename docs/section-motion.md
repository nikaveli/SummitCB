# Section choreography

The shared shell loads self-hosted GSAP 3.13.0, ScrollTrigger, SplitText, and `public/assets/section-scroll.js` on content pages. Utility pages stay still. All motion assets are cache-versioned and compressed by the normal build. Native scrolling and the homepage hero remain independent; shared section motion starts inside `#home-content` on the homepage.

## Motion direction

The existing service-site structure is retained. Scrollcraft's device vocabulary is adapted to the user's approved GSAP enhancement, rather than replacing the site with its landing-page engine.

- **Services:** the first two service features become short reading chapters. Photographs hold with native CSS sticky while their real headings, descriptions, options, and links move through the page. The images gently open and settle; the second chapter reverses the layout.
- **Selected headings:** SplitText measures and masks complete lines, then reveals them in sequence. It maintains an accessible heading name and resplits on font/width changes. Masks reserve space for descenders. Body copy never splits.
- **Our Process:** a held photographic deck changes with the existing five written stages. A construction line tracks progress. Photo transitions run in either scroll direction and remain fully revealed during reading intervals. These photos illustrate different parts of Summit's work; they are not presented as a single project's before/after sequence. The existing construction film remains available below the stages.
- **Projects:** the six existing lower-gallery photographs travel sideways through one bounded pinned showcase. Its travel is measured from actual overflow, and the last photograph finishes flush with the visible edge. The title stays fixed during the passage. The main filterable photo/video gallery retains its normal behavior.
- **Other sections:** alternate card/prose rows get quieter entrances and still rows provide pauses. Select article photos have contained desktop drift. Contact bands resolve with a once-only grouped entrance.

## Responsive and accessible behavior

Held sequences activate only at widths of at least 1050px, heights of at least 700px, and hover-capable input. Compact screens use the normal service layout, a complete process photo grid, and the existing project grid. There is no scroll hijacking or snapping.

Reduced motion and print revert GSAP contexts, remove pin spacers, restore text markup, and show all content. Keyboard focus and fragment navigation finish relevant entrances immediately. Gallery filters finish affected entrances and trigger a position refresh. FAQ expansion, resized content, and browser restoration refresh measurements. No content is hidden by default CSS: a failed library load or disabled JavaScript leaves the service layouts, five process photos, and six project details accessible. Resource results and forms do not animate.

GSAP pins only the lower project showcase. Services and Process use native sticky positioning inside their content's existing flow. Do not add transforms or overflow containment to their ancestors without verifying sticky positioning. Do not animate the project's rail items with independent vertical-scroll triggers: they are inside a horizontally animated container.

## Verification

```sh
npm run check
PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs CHROME_EXECUTABLE=/path/to/chrome node tests/section-choreography-browser.mjs
PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs CHROME_EXECUTABLE=/path/to/chrome node tests/section-scroll-browser.mjs
PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs CHROME_EXECUTABLE=/path/to/chrome node tests/motion-browser.mjs
```

The choreography suite checks held image positions and release, accessible headline masks, all five process stages and reverse scroll, six horizontal positions and the exact last-photo edge, reduced motion, print, and no-JavaScript fallback. It checks six representative page types at 1440, 1100, 1024, 800, 390, and 320 pixels. The section regression suite checks all 54 pages at 1440, 390, and 320 pixels, plus filters, focus, anchors, print, and failed-library fallback. The media suite covers existing video playback, mobile, reduced motion, data-saving preferences, and keyboard viewing.

Screenshots and a contact sheet are in `artifacts/section-choreography/`. The approved adaptation brief is in `website images/Scrollcraft Sections/builds/summit-sections/BRIEF.md`.

## Dependencies

The vendored GSAP, ScrollTrigger, and SplitText files retain their copyright/license headers. Distribution: https://www.npmjs.com/package/gsap/v/3.13.0. No asset generation or third-party network calls are needed at runtime.
