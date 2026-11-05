# Mesa Aberta SEO spike — 25 October 2026

## Findings in brief

- Public pages return useful server-rendered HTML. The sampled pages are not blocked by a site-wide `noindex` or `robots.txt` rule. There is no demonstrated blanket indexing blocker.
- Discovery is incomplete: the conventional sitemap endpoints return 404, robots advertises no sitemap, and the public table lists stop linking a table once its first session starts.
- URL policy is inconsistent: most public pages have no canonical. `/t`, `/t?page=1`, `/t?page=2`, `/t?page=999` and a tracking-parameter variant returned the same visible text, all with HTTP 200.
- Auth screens and internal search/filter results are left indexable. Table search snippets contain only the game system and remaining seats; most public routes also lack social sharing metadata.
- These are confirmed implementation gaps, not proof of why traffic is low. Search Console coverage, Google-selected canonicals, actual search demand and field performance were not available in this session.

The first investment should be a shared canonical/indexing policy and a public sitemap, followed by better page metadata. A frontend rewrite, broad server-rendering migration or mass production of SEO pages is not supported by this evidence.

## Scope and evidence

Reviewed the anonymous live site at `https://mesaaberta.app` and source commit [`440e4603`](https://github.com/itsmegrave/mesaaberta/tree/440e460363d44a5814b560f4cd01a90d642f526b). Production observations were captured on 25 October 2026 UTC. The deployed revision was not identified; live and source evidence are not assumed to be identical. Source findings are labelled separately where the live sample cannot demonstrate them.

The initial probe covered 47 requests: home, listings, details, public profiles, auth screens, filters, query variants, redirects, real 404s, robots and sitemap candidates. The follow-up collector captured 42 selected requests; it is a reproduction set, not a raw dump of the initial 47. A reproducible bounded collector and its separate snapshot are included:

- [`collect.py`](collect.py): standard-library Python; read-only GET requests, three concurrent workers, bounded detail discovery, explicit redirect chains and no authentication.
- [`evidence.json`](evidence.json): the collector's capture. HTML bodies, session cookies, image URLs and rendered account payloads are not stored.
- [`supplemental.json`](supplemental.json): the earlier transport samples, Googlebot User-Agent comparison, DNS observation and unsuccessful PageSpeed request.

To reproduce without overwriting the original evidence:

```sh
python3 docs/spikes/2026-10-25-seo/collect.py > /tmp/mesaaberta-seo-new.json
```

Visible-text hashes exclude scripts/styles, normalize whitespace and include ordinary page text, including navigation. They establish equivalence in this capture; they do not establish what Google has indexed.

The research browser could not fetch the domain, but direct HTTP probes succeeded. That tool limitation is not evidence that Google cannot access the site. The Googlebot User-Agent comparison also returned public HTML; a spoofed User-Agent is not verified Googlebot or Search Console URL Inspection.

## Technical findings

| ID | Priority / confidence | Problem and impact | Evidence | Recommended correction |
| --- | --- | --- | --- | --- |
| SEO-01 | P1 / confirmed | No sitemap discovery path. New public content has to be found through links alone; less-connected pages are harder to discover. A sitemap is an aid, not a requirement or indexing guarantee. | `/sitemap.xml` and `/sitemap-index.xml` returned 404. [`robots.txt`](https://mesaaberta.app/robots.txt) contains `User-agent: *` and an empty `Disallow`, with no `Sitemap:` declaration. No sitemap route exists in the reviewed tree. | Publish a sitemap of canonical, public, eligible pages and advertise its absolute URL in robots. Submit it in Search Console. Exclude drafts, disabled tables, inactive profiles and private account routes. |
| SEO-02 | P1 / confirmed | No consistent canonical policy. Equivalent URLs can split discovery and leave Google to choose a representative without our signal. This is not a penalty or proof of duplicate indexing. | No canonical on `/`, `/t`, `/p`, `/cf`, `/changelog` or the three table-detail samples. Five `/t` variants have the same visible-text hash and HTTP 200. Public profiles are the positive exception. | Emit exactly one absolute canonical using the configured public origin. Clean tracking and ignored parameters from canonical URLs; normalize supported filters. Do not redirect away campaign attribution before analytics records it. |
| SEO-03 | P1 / confirmed | Auth and internal search states have no explicit indexing policy. This permits low-value landing pages and many query variants to compete for discovery. | `/login`, `/signup`, `/forgot`, `/login?next=%2Fm`, empty table filters and empty crowdfunding/partner searches return 200 without robots meta or an `X-Robots-Tag: noindex`. | Add `noindex` to auth/recovery screens and internal search/filter states that are not deliberate search landing pages. Keep them crawlable so Google can read the directive. Authentication remains the access control. |
| SEO-04 | P1 / source-confirmed risk | Discovery depends on short-lived inventory. Public tables can lose incoming listing links while their detail URLs still exist. We have not established how many production pages are orphaned. | [`listUpcomingTables`](https://github.com/itsmegrave/mesaaberta/blob/440e4603/packages/core/src/server/tables/queries.ts#L76) selects active tables with `startsAt > now`; the home preview and public GM lists use upcoming tables too. `findTableBySlug` continues to resolve non-disabled older tables. No public archive or sitemap was found. | Decide which historical pages remain valuable. Keep useful pages linked through an appropriate archive/system hub and sitemap, with accurate lifecycle messaging. Deliberately exclude low-value or private material; do not index every historical table automatically. |
| SEO-05 | P2 / source-confirmed; not reproduced live | Public-profile canonicals drop all query parameters, including real pagination. If a profile has multiple pages of upcoming tables, later pages point to page 1 despite different contents. | [`/u/[username]/+page.server.ts`](https://github.com/itsmegrave/mesaaberta/blob/440e4603/apps/web/src/routes/u/%5Busername%5D/+page.server.ts#L21) accepts `page` but sets canonical from `path` alone. The sampled profiles did not expose a second page. | For genuine pagination, use self-canonicals that preserve a valid page number. Keep `?as=visitor` and tracking parameters out. Do not solve this by canonicalizing all pages to the first. |
| SEO-06 | P3 / confirmed | No structured-data layer in the sample. This limits explicit machine-readable site/breadcrumb information; it is not a demonstrated ranking blocker. | No `application/ld+json` block was found in sampled successful HTML or the relevant source templates. | Add truthful `WebSite`/organization and breadcrumb information after canonical policy is settled. Assess eligibility before adding rich-result types. Never invent ratings or expose private table locations. |

### URL behavior that is already correct

- Public table titles, descriptions, links and headings are in the initial HTML. [`pageQuery`](https://github.com/itsmegrave/mesaaberta/blob/440e4603/apps/web/src/lib/query/page.svelte.ts) seeds the client from the authorized server load; it is not evidence of client-only content.
- Real missing pages and missing table slugs returned 404. `/cf?status=ended&page=999` also returned 404. Do not replace those responses with a 200 error screen.
- Legacy `/tables`, locale aliases and trailing slashes return permanent 308 redirects to their canonical paths. HTTP upgrades to HTTPS. Their `Location` headers were checked separately with curl.
- The current table feed is **not paginated**: its loader does not consume `page`. Therefore `/t?page=999` is an ignored-parameter duplicate, not evidence that an implemented page 999 is missing its 404 handling.
- Public profiles have canonical and Open Graph tags. Anonymous visits to `/m`, `/u/tables` and `/t/new` go to login; private content was not exposed by the probe.
- The HTML language is `pt-BR`. The app currently serves one language. `hreflang` and locale-prefix pages are not missing requirements for this one-language deployment.
- Table-card images lack intrinsic width/height attributes, but their source reserves a fixed-height cover container. This alone does **not** prove layout shift or justify a CLS finding.

### Avoid these fixes

Do not add `Disallow: /u/`: public profiles live there. Do not block a page in robots and expect Google to read its `noindex`. Do not treat missing Open Graph metadata as a crawl blocker. Do not remove descriptive URLs or add thin pages merely to satisfy an audit score.

The public config already disables `workers_dev` and preview URLs in `wrangler.jsonc`. Duplicate preview deployments are not established by this spike. `www.mesaaberta.app` failed DNS resolution in the probe; redirect support is an optional branding/access improvement, not an observed duplicate-content problem.

## On-page and content findings

| ID | Priority / confidence | Problem and impact | Evidence | Recommended correction |
| --- | --- | --- | --- | --- |
| SEO-07 | P2 / confirmed | Listing titles are generic and unbranded; table titles omit system/context/brand. Snippets can do a better job explaining which result is useful. Lower CTR has not been measured. | `/t`: `Mesas abertas`; `/cf`: `Financiamentos coletivos`; `/p`: `Parceiros`. The table template renders `<title>{table.title}</title>`. | Use concise, accurate templates such as `Mesas de RPG com vagas abertas · Mesa Aberta` and `{title} — {system} · Mesa Aberta`, with sensible length handling. Keep the product's existing voice and headings. |
| SEO-08 | P2 / confirmed | Table descriptions contain too little useful context and depend on volatile seat counts. | The template is `{system}. {seats}.`; examples include `FATE. 4 vagas restantes.` and `Daggerheart. Mesa cheia.` There is much more useful public description in the body. | Build a plain-text excerpt from the public description plus useful modality/system context. Handle completed/closed tables accurately. Do not put private join instructions, contacts or addresses into metadata. Google may choose a different snippet. |
| SEO-09 | P2 / confirmed | Sharing metadata is implemented for profiles but absent on home/listings/table details. This is a sharing/distribution issue, not a direct organic-ranking fix. | Profiles expose `og:title`, `og:description`, `og:url`, `og:type`, sometimes `og:image`. The sampled other public templates do not. | Add per-page Open Graph and appropriate social-card defaults from public data. Use a real shared image with dimensions and an absolute URL. Avoid a generic root canonical being copied onto all pages. |
| SEO-10 | P2 / opportunity, demand unverified | Search discovery depends heavily on changing table inventory. There are no durable game-system landing pages in the reviewed route tree, despite the catalog already carrying system information. | Current system links point to `/t?system=...`, with the same listing title/description. Search-console query demand is unavailable. Related system-page plans already exist in Trello. | Validate demand for topics such as online RPG tables and specific game systems, then build a few useful landing pages with real inventory and authored guidance. Do not create every system × platform × city combination or revive parked work without a product decision. |

The public table pages in the sample contain approximately 267–467 visible words **including navigation**. That is not a useful universal quality score. Their original descriptions are present in HTML; the recommendation is to expose useful context better, not replace community descriptions with generated filler.

Related planning context, found read-only: [short language-independent URLs #205](https://trello.com/c/uxMv9VfY), [system list](https://trello.com/c/UjIqkzlJ), [system detail pages](https://trello.com/c/Fqj1BE69), and [blog #124](https://trello.com/c/RUpTRiDl). These are references, not newly approved implementation scope.

### Structured-data eligibility matters for this product

Google's current Event guidelines exclude purely virtual experiences and require a real physical location. They also exclude events requiring membership or an invitation before attending. An `Event` object on every RPG table is therefore not a defensible quick win for a largely online platform. Schema.org vocabulary availability is different from Google rich-result eligibility. A public in-person event would need a separate eligibility/privacy assessment; a private residential address must not be published for SEO.

## Proposed indexing policy

| Route/state | Intended treatment |
| --- | --- |
| `/`, `/t`, `/p`, `/cf`, `/changelog` | Indexable by default; absolute self-canonical; reviewed sitemap inclusion. |
| Eligible `/t/[slug]` and active public `/u/[username]` | Indexable with stable canonical; include only publicly accessible records in sitemap. Respect table lifecycle and profile visibility. |
| Tracking/ignored parameters on otherwise identical pages | Canonical to the clean equivalent. Redirect ignored parameters only where it preserves attribution and navigation behavior. |
| Internal `q` searches and non-curated filter combinations | `noindex`; omit from sitemap. Keep the existing search UX initially; separately decide whether invalid combinations should return 404. |
| Genuine pagination, e.g. public-profile page 2 or ended crowdfunding | Self-canonical per valid page; crawlable links. Do not point different pages at page 1. Decide index eligibility per page purpose. |
| Login, signup, recovery and account flows | `noindex` on accessible auth screens; authenticated resources remain protected. No sitemap entries. |
| Missing/disabled resources and unauthorized drafts | Preserve existing 404/refusal behavior. Do not reveal their existence through sitemap output. |

`/changelog` currently marks filtered views and page 2+ `noindex, follow`. That may be intentional for an updates feed. If individual releases are meant to rank, use durable release-detail URLs rather than relying on fragment anchors inside noindexed archive pages. This is a product decision, not a blanket instruction to remove the current rule.

## Implementation boundaries and acceptance criteria

This spike changes no production code, flags, Cloudflare resources, DNS or indexing settings.

A follow-up implementation should be split into reviewable PRs:

1. **SEO policy and head metadata.** Shared pure URL/indexing rules and one owner of head tags. Use the configured public origin, not arbitrary request hosts. Migrate the profile's existing canonical rather than introducing two tags. Keep visible copy in Paraglide and preserve pt-BR, sentence case and neutral roles.
2. **Public sitemap.** Follow the current API-ownership rule: a new dynamic domain read belongs in `apps/api`, backed by `packages/core`; the web route serializes the authenticated service-binding response as XML. Static public URLs need no domain endpoint. Cache the public result, escape XML, paginate/bound enumeration, and derive `lastmod` from real significant updates. Filter eligibility in the domain service so drafts/private data cannot leak. Do not scan the entire database on each crawler request.
3. **Durable landing pages and structured data.** Start only after query-demand and product decisions. This is separate from repairing technical discovery and duplicate handling.

Acceptance checks for those PRs:

- Anonymous HTML for root, a listing, a public table and a public profile contains useful text, one title, a description and exactly one correct canonical before JavaScript runs.
- Equivalent ignored/tracking variants consolidate correctly; canonical filters have stable ordering and deduplicate repeated values. Genuine page 2 remains distinct.
- Login and search states contain readable `noindex`; robots does not prevent the directive from being seen. Public `/u/[username]` remains crawlable.
- Sitemap returns 200 XML, robots advertises it, every sampled sitemap URL resolves to the intended public 200 page, and private/draft/disabled fixtures never enter it.
- Existing legacy redirects and true 404s remain correct. A failure to retrieve sitemap data must not masquerade as a successful empty snapshot.
- Search Console URL Inspection confirms Google can fetch/render representative pages and sees the intended declared canonical. Track Google-selected canonicals after recrawl; a declaration is a signal, not a guarantee.

## Measurement gaps

No authenticated Search Console property, search-performance export, verified crawler log sample or first-party organic conversion baseline was available. No assertion is made that the property is unverified: DNS-based verification would not appear in the app source.

The public PageSpeed API returned HTTP 429 because its anonymous quota was exhausted. No Lighthouse score or Core Web Vitals result is claimed. The earlier HTTP transport samples were roughly 0.4 seconds for `/t`, 1.1 seconds for home and 2.7 seconds for `/cf` end-to-end from this machine. They are individual uncached/edge-dependent requests, not field p75 LCP/INP/CLS or a representative speed baseline. The HTML bodies were roughly 126–167 KB uncompressed; this is a measurement lead, not a diagnosed ranking cause.

A `site:mesaaberta.app` query returned no results in this research tool. Broader searches found third-party references to the site. Neither proves Google's indexed URL count, rankings, backlink quality or a penalty.

To establish causes, obtain Search Console Page Indexing, Sitemaps, Crawl Stats and representative URL Inspection results; compare 28-day branded/non-branded impressions and clicks by landing page. Measure anonymous mobile field performance where there is sufficient traffic, with lab measurements as a diagnostic supplement. Set up organic visit → table view → account/seat-request measurement using aggregate reporting. Keep raw account exports out of this public repository.

## Primary references

- [Google: sitemap purpose and limitations](https://developers.google.com/search/docs/crawling-indexing/sitemaps/overview) and [building a sitemap, including accurate lastmod](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap).
- [Google: canonicalization](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls) and [pagination](https://developers.google.com/search/docs/specialty/ecommerce/pagination-and-incremental-page-loading).
- [Google: faceted navigation](https://developers.google.com/crawling/docs/faceted-navigation) and [noindex must remain crawlable](https://developers.google.com/search/docs/crawling-indexing/block-indexing).
- [Google: titles](https://developers.google.com/search/docs/appearance/title-link) and [snippets](https://developers.google.com/search/docs/appearance/snippet).
- [Google: structured data](https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data) and [Event eligibility](https://developers.google.com/search/docs/appearance/structured-data/event).
- [Google: Search Console](https://developers.google.com/search/docs/monitor-debug/search-console-start) and [Core Web Vitals](https://developers.google.com/search/docs/appearance/core-web-vitals).

## Prioritized action plan

1. **Confirm any critical blocker with Search Console.** Live-test root, `/t`, a table and a profile. Check indexing exclusions and verified crawler access. No production-wide blocker was demonstrated by this spike, so do not diagnose one from a search operator or spoofed User-Agent.
2. **P1 — centralize canonical and indexing policy.** Address proven duplicate parameter URLs and noindex auth/internal search states. Define pagination explicitly. Small implementation; high confidence in the technical correction, unmeasured traffic impact.
3. **P1 — publish and submit the public sitemap.** Include only deliberate canonical pages and eligible records. Add coverage and privacy tests. Medium implementation because current architecture requires an API-backed dynamic domain read.
4. **Quick wins / P2 — improve title, description and share templates.** Reuse the existing public data and design/copy conventions. Measure search CTR after recrawl rather than promising a lift.
5. **P2 — decide durable discovery and content.** Choose whether useful historical tables stay indexed and whether the planned system pages should proceed. Validate demand and inventory before building landing pages or a blog for SEO.
6. **P3 — add eligible structured data and assess optional www support.** Avoid promising Event results for online-only or invitation-gated sessions. Measure field performance and fix demonstrated bottlenecks rather than optimizing for an invented score.
