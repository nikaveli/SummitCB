# Summit Custom Builders

A content-first, server-rendered HTML website for Denver Metro remodeling and additions. No production packages, client framework, external fonts, or third-party tracking scripts are required. Node 22.9 or newer builds the site and runs its consultation endpoint.

## Run locally

```sh
npm run build
npm start
```

Open http://127.0.0.1:3000. `npm run dev` rebuilds once and watches server source changes. After editing content or CSS, run `npm run build` again; restart the server when routes or redirects change because it loads the manifest at startup.

The default build is a preview: HTML and HTTP headers are noindex, and robots.txt disallows crawling. All core content, navigation, FAQs, and the inquiry form work without JavaScript. JavaScript adds guide filtering, compact mobile navigation, referral attribution, form feedback, and optional city/service prefilling.

## What is implemented

- 8 company/navigation pages, 6 core services, 6 city pages, and 9 existing local-service pages.
- 12 planned guides plus 5 research guides. Three planned guides refresh matching existing article URLs.
- 4 additional existing articles retained and edited at their old URLs.
- Privacy, accessibility, HTML sitemap, and noindex confirmation pages: **54 pages total**, plus a proper 404 response.
- Brotli/gzip text compression, versioned scripts/styles, and streamed, cached video responses.
- Unique titles, descriptions, canonical URLs, breadcrumbs, Organization/GeneralContractor, Service and Article JSON-LD, XML sitemap, and production/preview robots controls.
- The complete public sitemap was crawled: **127 entries** with a migration outcome recorded. Existing service and city-service URLs remain intact. Duplicate articles and empty media attachment pages have direct redirects.
- Consultation validation, private durable storage, optional HTTPS webhook delivery, retry support, and aggregate inquiries by service/city/referral channel.

See [page inventory](docs/page-inventory.md), [migration outcomes](data/migration-map.json), and [research integration](docs/research-integration.md).

## Editing

- `src/content/`: services, cities, local-service pages, guides, and retained articles. Section arrays contain a heading followed by plain-text paragraphs; HTML is escaped by the renderer.
- `src/render.mjs`: reusable layouts, company pages, navigation, structured data, and page templates. `public/assets/` contains CSS, progressive enhancements, the original logo, 27 supplied photos in responsive sizes, with the lower Projects photo section also using the newer assets. Legacy image files remain in the workspace as references. Selected gallery tiles play short films on hover, with tap-to-play on mobile. See [video design and performance](docs/video-design.md) and [photography notes](docs/photography.md) for placement and image preparation.
- `src/config.mjs`: business details, retained URLs, and external resources.

Build outputs are in `dist/`. Do not edit them directly. The build also updates `data/page-inventory.json`, `data/migration-map.json`, and `docs/page-inventory.md`. Private brand research and raw crawl data are not served by the HTTP server.

## Consultation inbox and delivery

Requests POST to `/api/inquiries` as URL-encoded form data. The API returns success only after writing and syncing a unique JSON record, with private file permissions. Native forms receive a 303 to `/thank-you/`; enhanced forms receive JSON. Failures preserve the form values and never claim success. There is no public inbox endpoint.

```sh
npm run inquiries
npm run inquiries -- --details
npm run inquiries -- --retry
```

The first command reports counts without personal details. `--details` explicitly opens the private local inbox in terminal output. `--retry` resends undelivered records using the record ID as an idempotency key. The receiving service should honor that key. Retry delivery after an outage using this command; retries are not scheduled automatically.

Without a webhook, requests remain in `.data/inquiries`. A webhook failure does not lose a lead: the private record retains failed/pending delivery status. **Configure a real destination and verify receipt before public launch.** No email address or CRM was supplied, so the implementation does not invent one or send test mail to the business.

The HTTP process uses its direct peer address for an in-memory abuse limit. If deployed behind a reverse proxy, configure an appropriate upstream per-client rate limit and use `INQUIRY_RATE_LIMIT` to set the application's shared fallback limit. It deliberately does not trust arbitrary forwarded-IP headers.

## Production configuration

Copy `.env.example` to `.env` and set values; npm build/start/inquiry commands load it. Set:

- `SITE_URL` to the final HTTPS domain (defaults to the existing Summit domain).
- `PUBLIC_INDEXING=true` for the final production build only.
- `HOST=0.0.0.0` when the hosting environment requires it; terminate HTTPS at a trusted reverse proxy.
- `INQUIRY_DATA_DIR` to a **persistent private directory outside `dist/`**. Back it up and establish a retention/deletion procedure.
- `INQUIRY_WEBHOOK_URL` and optionally `INQUIRY_WEBHOOK_TOKEN` for the chosen inquiry destination.
- Optionally `GOOGLE_SITE_VERIFICATION` for a real Search Console token; rebuild to include it.

Deploy the Node application with `dist/`, `src/`, `server.mjs`, and `package.json`. A static-only file upload does **not** implement form processing or redirects. The Node server handles the redirect manifest and serves only public pages/assets. Do not deploy `data/`, `docs/`, `brand-info/`, `.env`, or `.data/` as a public static directory.

After configuring production, build and restart. Confirm real inquiry delivery, persistent storage, canonical hostname handling at the proxy, and indexing settings. The application reports saved inquiries; it does not guarantee notification delivery if an external service fails. Do not use ephemeral serverless storage for the inbox.

### Cloudflare production deployment

The production site runs as a Cloudflare Worker with Static Assets. `wrangler.jsonc` attaches the Worker to both `summitcustombuilders.net/*` and `www.summitcustombuilders.net/*`; the `workers.dev` hostname remains noindex even when the production build is indexable. Contact inquiries are stored in the bound D1 database before a success response is shown.

```sh
npm run deploy:production
```

Wrangler must be authenticated to the correct Cloudflare account. Before the first deployment, create the D1 database, apply `cloudflare/schema.sql`, update its ID in `wrangler.jsonc`, and add a `RATE_LIMIT_SALT` Worker secret. Configure `INQUIRY_WEBHOOK_URL` and `INQUIRY_WEBHOOK_TOKEN` as Worker secrets only after choosing and testing a real notification destination. Keep the old hosting and DNS records intact until the Cloudflare preview, routes, and nameserver cutover have been verified.

## Checks

```sh
npm run check
```

The suite tests page inventory, metadata/schema, internal links and anchors, every legacy sitemap entry, noindex behavior, native and enhanced form responses, storage failure, remote delivery failure, validation, rate limits, and private-file protection. HTTP tests need permission to bind a local port.

Optional browser coverage uses Playwright from an available installation:

```sh
PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs CHROME_EXECUTABLE=/path/to/chrome node tests/browser.mjs
```

It checks all 54 pages at desktop, 390px, and 320px; verifies every image loads, gallery filtering and keyboard navigation, keyboard menu dismissal, and form submissions with and without JavaScript; and saves screenshots in `artifacts/`. Browser-test inquiries are stored in an isolated temporary directory and removed afterward.

## Before publishing content

The build is reviewable locally; it has not replaced the live website. Confirm Summit's current business/owner information, material-purchasing and process wording, privacy/contact workflow, and authorization for the inherited gallery assets. The existing photos have source provenance but no city/project-specific permission records; they are not presented as named case studies. Numeric license claims, review ratings, invented project stories, price ranges, code-edition tables, and permit-duration promises are intentionally absent.

Connect Search Console and review impressions, clicks, and indexation after migration. The local inquiry report tracks services, cities, and referring hosts for submissions, including a basic organic classification. It is not a traffic analytics replacement. Recheck time-sensitive official sources before launch and during content maintenance; see the research log for claims still requiring verification.

For video-specific browser verification, use the same Playwright/Chrome environment variables with `node tests/motion-browser.mjs`. This covers hover, touch playback, reduced motion, constrained connections, gallery layout, and the installed homepage hero. Regenerate web films with `npm run videos` when FFmpeg and ffprobe are installed; original footage is preserved.

## Homepage scroll hero

The approved Light → Detail → Retreat hero replaces the former homepage intro. Its source markup is in `src/scroll-hero.mjs`; live configuration, scoped styles, engine and selected assets are in `public/assets/scroll-hero/`. The original creative preview remains in `website images/Summit Scroll Hero/`.

The homepage retains one server-rendered H1 and a static fallback, a native Menu that works without JavaScript, and a keyboard link to skip the visual tour. The pinned viewport releases into the existing services, gallery and planning sections. The final logo is transparent and uses the approved size and corner position. Mobile uses 720p clips; reduced motion uses corrected stills without loading video. Physical-phone verification remains pending.

Hero scripts and styles are external, compressed and versioned by the build. The server permits the dedicated asset subdirectory and enables Blob video decoding only on the homepage. A static hosting deployment must likewise allow `blob:` in the homepage `media-src` policy.

Run `npm run check` and the browser checks above. The additional integration check is `node "website images/Summit Scroll Hero/production/homepage-qa.cjs"` while the local preview runs on port 3000. Its report and screenshots are saved alongside the script.

## GitHub Pages preview

Live preview: https://nikaveli.github.io/SummitCB/

Pushing `main` runs `.github/workflows/pages.yml`: validate the Node site, build the static preview, check its links and media, and deploy to GitHub Pages. Run `npm run build:pages && npm run check:pages` to validate that output locally. `PAGES_URL` can override the default preview URL and project path.

The preview lives in `dist-pages/`, uses project-relative navigation and assets, and stays `noindex`. It provides telephone contact instead of a form because GitHub Pages cannot run the Node inquiry endpoint. The ordinary `npm run build` and `npm start` deployment retains the complete server-backed form. The production domain is not changed by this workflow.

Optimized website media is committed under `public/`. Original photo/video folders, the standalone creative workspace, private inquiry records, `.env` files, and generated builds are excluded from Git.
