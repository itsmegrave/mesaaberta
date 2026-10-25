import { expect, test } from '@playwright/test';

test('SSR and client navigation retain one canonical and one metadata owner', async ({
  page,
  request,
  baseURL,
}) => {
  const response = await request.get('/t?page=999&utm_source=seo-test');
  expect(response.status()).toBe(200);
  const html = await response.text();
  expect(html).toContain(`rel="canonical" href="${baseURL}/t"`);
  expect(html.match(/name="description"/g)).toHaveLength(1);
  expect(html.match(/property="og:title"/g)).toHaveLength(1);
  for (const path of ['/cf?page=2', '/cf?page=999']) {
    const crowdfunding = await request.get(path);
    expect(crowdfunding.status()).toBe(200);
    expect(await crowdfunding.text()).toContain(`rel="canonical" href="${baseURL}/cf"`);
  }
  await page.goto('/t?system=fate&utm_source=seo-test');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex, follow');
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    'href',
    `${baseURL}/t?system=fate`,
  );
  await page.getByRole('contentinfo').getByRole('link', { name: 'Novidades', exact: true }).click();
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    'href',
    `${baseURL}/changelog`,
  );
  await expect(page.locator('meta[name="description"]')).toHaveCount(1);
  await expect(page.locator('meta[property="og:title"]')).toHaveCount(1);
  await expect(page.locator('meta[name="robots"]')).toHaveCount(0);
  await page.goto('/login');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex, follow');
  await expect(page.locator('link[rel="canonical"]')).toHaveCount(0);
  await expect(page.locator('title')).toHaveCount(1);
});

test('robots declares a working sitemap backed by public API reads', async ({
  request,
  baseURL,
}) => {
  const robots = await request.get('/robots.txt');
  expect(await robots.text()).toContain(`Sitemap: ${baseURL}/sitemap.xml`);
  const response = await request.get('/sitemap.xml');
  expect(response.status()).toBe(200);
  expect(response.headers()['content-type']).toContain('application/xml');
  const xml = await response.text();
  expect(xml).toContain('<sitemapindex');
  expect(xml).toContain(`${baseURL}/sitemap-pages.xml`);
  for (const match of xml.matchAll(/<loc>(.*?)<\/loc>/g)) {
    const sitemap = await request.get(match[1].replaceAll('&amp;', '&'));
    expect(sitemap.status()).toBe(200);
    const body = await sitemap.text();
    expect(body).toContain('<urlset');
    expect(body).not.toContain('/u/profile');
    expect(body).not.toContain('/login');
  }
  expect((await request.get('/sitemap-tables.xml?page=0')).status()).toBe(404);
});
