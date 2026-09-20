# Summit Custom Builders SEO launch audit

Audited and remediated September 20, 2026. Target market: residential remodeling and home additions in Denver, Arvada, Wheat Ridge, Lakewood, Morrison, and Golden, Colorado.

## Executive summary

The site has a strong technical and content foundation: 49 substantial indexable pages, preserved legacy URLs, local service coverage, descriptive photography, and a practical homeowner resource library. The launch audit found one critical canonicalization issue—HTTP served duplicate content—which was corrected with one-hop permanent redirects to HTTPS and `www`. Google Search Console ownership was restored, the new sitemap was accepted, the homepage is indexed and queued for a fresh crawl, and Google reports no security issues or manual actions.

The highest-value work remaining is off-site: correct inconsistent phone/address data in contractor directories, keep the Google Business Profile complete and active, and turn completed projects into detailed case studies that earn links and support commercial-intent searches.

## Keyword opportunities

Difficulty and opportunity are qualitative because no Ahrefs, Semrush, or equivalent ranking database was connected.

| Keyword | Difficulty | Opportunity | Current coverage | Intent | Recommended page |
|---|---|---|---|---|---|
| Denver remodeling contractor | Hard | High | Homepage | Transactional | Homepage |
| home remodeling Denver | Hard | High | Whole-home service | Transactional | Service page |
| home addition contractor Denver | Moderate–hard | High | Additions service | Transactional | Service page |
| Denver kitchen remodeling contractor | Hard | High | Kitchen service | Transactional | Service page |
| Denver bathroom remodeling contractor | Hard | High | Bathroom service | Transactional | Service page |
| general contractor Denver CO | Hard | High | General contractor service | Transactional | Service page |
| whole-home remodel Denver | Moderate | High | Whole-home service and guides | Commercial | Service page + guide cluster |
| aging-in-place remodeling Denver | Moderate | High | Aging-in-place service | Commercial | Service page |
| ADA remodeling Denver | Moderate | Medium | ADA/aging service and retained guide | Commercial | Service page + guide |
| home addition cost Denver | Moderate | High | Cost-factors guide | Commercial research | Guide |
| home addition timeline Denver | Moderate | High | Timeline guide | Commercial research | Guide |
| second-story addition Denver | Moderate | High | Build-up-vs-build-out guide | Commercial research | Guide or dedicated service section |
| Denver pop-top contractor | Moderate | High | Addition content; no dedicated page | Transactional | Validate service, then landing page |
| kitchen remodel cost Denver | Moderate–hard | High | Cost-factors guide | Commercial research | Guide |
| bathroom remodel cost Denver | Moderate–hard | High | Cost-factors guide | Commercial research | Guide |
| Arvada home addition contractor | Moderate | High | Local service page | Transactional | Local service page |
| Lakewood kitchen remodeling | Moderate | High | Local service page | Transactional | Local service page |
| Golden bathroom remodeling | Moderate | High | Local service page | Transactional | Local service page |
| Wheat Ridge bathroom remodeling | Moderate | Medium | Local service page | Transactional | Local service page |
| Morrison remodeling contractor | Easy–moderate | Medium | City page | Transactional | City page |
| Denver remodeling permits | Moderate | Medium | Process and planning guides | Informational | Guide cluster |
| Colorado asbestos remodel requirements | Moderate | Medium | Dedicated guide | Informational | Guide |

## Technical SEO checklist

| Check | Status | Details |
|---|---|---|
| HTTPS and preferred host | Pass | HTTP and apex requests permanently redirect in one hop to `https://www.summitcustombuilders.net/`; HSTS enabled. |
| Indexability | Pass | Production pages use `index, follow`; utility/confirmation pages and the `workers.dev` preview remain noindex. |
| Robots.txt | Pass | Crawling allowed, inquiry API disallowed, canonical sitemap declared. |
| XML sitemap | Pass | 49 indexable canonical URLs, accurate last-modified dates, and one primary image per URL. |
| Search Console | Pass | Canonical URL-prefix property verified; sitemap submitted successfully; homepage fresh crawl requested. |
| Manual actions | Pass | Google Search Console reports no issues detected. |
| Security issues | Pass | Google Search Console reports no issues detected. |
| Canonicals | Pass | Every indexable page has one self-referencing HTTPS/`www` canonical. |
| Redirect migration | Pass | 127 legacy sitemap URLs have a documented 200 or direct 301 outcome; redirect chains are prevented by tests. |
| Titles and descriptions | Pass | Unique; indexable titles are 30–60 characters and descriptions are 120–160 characters. |
| Heading structure | Pass | Exactly one H1 per page; content is server-rendered and visible without JavaScript. |
| Internal links | Pass | No broken internal links, redirecting internal links, missing fragments, or orphaned indexable pages. |
| Image SEO | Pass | All images have alt attributes and dimensions; responsive WebP/JPEG sources and image sitemap entries are present. |
| Structured data | Pass | GeneralContractor, Organization identity, WebSite, WebPage, BreadcrumbList, Service, and Article entities are connected in one JSON-LD graph. |
| Social metadata | Pass | Open Graph and Twitter title, description, image, locale, dimensions, and alt text are present. |
| Mobile foundation | Pass | Responsive viewport, responsive images, reserved image dimensions, accessible navigation, and no content dependency on JavaScript. |
| Performance baseline | Pass/monitor | Cloudflare edge test: about 0.14 s TTFB and 5.9 KB compressed homepage HTML. Search Console has no field Core Web Vitals data yet; monitor after traffic accumulates. |
| External references | Pass | Government and safety references resolve; several municipal sites block automated HEAD requests but are browser-accessible. |
| Local citation consistency | Needs work | BuildZoom displays `720-345-8629`; Porch displays the old `395 S Depew St` address. Correct both to the canonical NAP. |

## Competitive and content-gap summary

| Dimension | Summit Custom Builders | Observed competitors | Priority |
|---|---|---|---|
| Local landing pages | Strong coverage of six cities and nine city/service combinations | Mixed | Maintain and expand only where service is real |
| Planning content | Strong guide cluster covering cost factors, timelines, permits, soil, asbestos, radon, and older homes | Generally lighter | Promote and earn links to these guides |
| Project proof | Photo gallery, but no individual case-study URLs | Strong competitors publish detailed project case studies | High |
| Reviews and trust | Strong third-party reputation exists, but little review proof is surfaced on-site | Competitors prominently show verified reviews, licensing, and years in business | High, after claim verification |
| Interactive tools | None | Some competitors offer cost calculators/site-planning tools | Medium; only build if estimates can be responsible |
| Service breadth | Core additions/remodeling/kitchen/bath/ADA coverage | Competitors often target basements and ADUs | Validate actual offerings before creating pages |
| Technical depth | Strong canonical, migration, schema, image, and crawl controls | Varies | Summit advantage |

## On-page findings addressed

| Issue | Severity | Resolution |
|---|---|---|
| HTTP served duplicate content | Critical | Added permanent HTTP/apex to HTTPS/`www` canonical redirects. |
| Search Console ownership unavailable | High | Restored with a persistent HTML verification tag. |
| Stale 127-URL sitemap in Search Console | High | Submitted the curated 49-URL production sitemap. |
| Structured data lacked identity/detail fields | Medium | Added description, contact point, image, service details, language, connected breadcrumbs, and verified BBB identity URL. |
| Sitemap omitted images | Medium | Added the primary image for every indexable URL. |
| Social previews were incomplete | Low | Added locale and complete Twitter metadata. |
| Several snippets were short | Low | Expanded project and retained/local article descriptions. |

## Prioritized action plan

### Quick wins

1. Claim or update BuildZoom so the phone number is `720-431-1056`. Impact: high; effort: under one hour if account access is available.
2. Claim or update Porch so the address is `825 S Yates St, Denver, CO 80219`. Impact: high; effort: under one hour if account access is available.
3. Audit the Google Business Profile for exact NAP, primary/secondary categories, service areas, hours, services, appointment link, and current project photos. Impact: high; effort: 1–2 hours; requires Business Profile access and confirmation of business details.
4. Add truthful license/insurance/accreditation details and verified review links to the visible site after the business owner confirms wording and identifiers. Impact: medium–high; effort: 1–2 hours.
5. Monitor Search Console weekly during the migration for indexing, redirect, canonical, and Core Web Vitals changes. Impact: high; effort: 15 minutes per week.

### Strategic investments

1. Publish 6–10 individual project case studies with city, project type, constraints, scope, timeline, construction decisions, and original photos. Impact: high; effort: substantial; dependency: approved project details and photography.
2. Earn local links from architects, designers, suppliers, neighborhood organizations, trade associations, and project partners. Impact: high; effort: ongoing; dependency: relationships and link-worthy case studies.
3. Expand local/service combinations only where real completed work and unique local detail support the page. Impact: medium–high; avoid templated doorway pages.
4. Validate whether Summit actively wants basement, ADU, pop-top, and custom-home leads before creating dedicated pages. Impact: potentially high; dependency: business scope and portfolio proof.
5. Build a quarterly content cycle from Search Console query data: refresh pages receiving impressions in positions 5–20 and add supporting guides around genuine homeowner questions. Impact: high; effort: ongoing.

## Evidence and sources

- Google Search Central: canonicalization, permanent redirects, sitemaps, LocalBusiness structured data, and Core Web Vitals.
- Live site and Cloudflare edge responses, generated manifest, sitemap, automated crawl checks, and Google Search Console reports.
- Competitive observations from current search results for Denver remodeling, additions, kitchens, and bathrooms.
- Public local citations, including the BBB, BuildZoom, Porch, and search-result business profiles.
