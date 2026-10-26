import { z } from 'zod';

export const SITEMAP_PAGE_SIZE = 500;
// The resource families plus the static pages stay within the sitemap index's 50,000 URL limit.
export const SITEMAP_MAX_PAGES = 20_000;
export const sitemapResource = z.enum(['tables', 'profiles', 'systems']);
export const sitemapIndexSchema = z.object({
  tables: z.number().int().min(0).max(SITEMAP_MAX_PAGES),
  profiles: z.number().int().min(0).max(SITEMAP_MAX_PAGES),
  // The systems directory (`/s/[slug]`); an api from before it answers without the field.
  systems: z.number().int().min(0).max(SITEMAP_MAX_PAGES).default(0),
});
export const sitemapPageSchema = z.object({
  entries: z
    .array(z.object({ slug: z.string().min(1).max(200), lastmod: z.iso.datetime().optional() }))
    .max(SITEMAP_PAGE_SIZE),
});
export type SitemapResource = z.infer<typeof sitemapResource>;
