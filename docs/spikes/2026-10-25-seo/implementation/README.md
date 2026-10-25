# SEO foundations

Implements the first three actions from spike PR #396, without adding dependencies.

- One shared head component owns public titles, descriptions, canonical links, Open Graph and Twitter tags. URLs use the deployment's validated `APP_ORIGIN`; tracking parameters remain available to analytics but do not enter canonical URLs. Real profile, partner and crowdfunding pagination stays self-canonical. Account flows, internal search/filter states, drafts, errors and maintenance are noindex.
- `robots.txt` declares `/sitemap.xml`. The index points to root-level static, table and profile shards, with at most 500 entries per dynamic shard. New reads are required API routes under `/v1/seo`, with no feature flag or web database fallback. HTTP deployments retain their existing internal-token guard; Workers retain their Service Binding.
- Only public table statuses with approved systems and active owners, plus active named profiles outside reserved namespaces, enter the sitemap. Only slugs and actual table modification dates leave the domain reader. Profile lastmod is omitted because badges and ratings do not have one authoritative modification timestamp. Successful XML is cached for five minutes; API errors are uncached 503s rather than an apparently complete empty sitemap.
- Table metadata uses its public title, system and plain-text description. Profiles use the public handle and bio. The existing square brand image is the default sharing image. No Event schema or additional landing pages are included.

Deployment: keep `APP_ORIGIN` set to the site's public origin, and deploy the API route before or alongside web. Submit `/sitemap.xml` in Search Console after release. Sitemap submission does not guarantee indexing; Search Console is needed to assess the result.

Reference: [Google's sitemap guidance](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap), [pagination guidance](https://developers.google.com/search/docs/specialty/ecommerce/pagination-and-incremental-page-loading).

The screenshot shows the existing changelog on desktop after moving metadata ownership. This change adds no visible redesign.
