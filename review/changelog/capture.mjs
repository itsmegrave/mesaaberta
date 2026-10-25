import { chromium } from 'playwright';
import { expect } from '@playwright/test';
const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 1440, height: 1100 },
  deviceScaleFactor: 1,
});
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
for (const size of ['desktop', 'mobile']) {
  await page.setViewportSize(
    size === 'desktop' ? { width: 1440, height: 1100 } : { width: 390, height: 844 },
  );
  for (const mode of ['light', 'dark']) {
    await page.goto('http://127.0.0.1:5191/novidades');
    await page.evaluate((mode) => {
      document.documentElement.dataset.mode = mode;
      document.documentElement.style.colorScheme = mode;
    }, mode);
    await page.getByRole('heading', { name: 'Novidades', exact: true }).waitFor();
    await expect(page.getByRole('button', { name: 'Próximo destaque', exact: true })).toBeEnabled();
    await page.screenshot({ path: `review/changelog/${size}-${mode}.png` });
    await page.screenshot({ path: `review/changelog/${size}-${mode}-full.png`, fullPage: true });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
    if (overflow) throw new Error(`${size}-${mode} overflows`);
  }
}
await page.goto('http://127.0.0.1:5191/novidades');
await expect(async () => {
  await page.getByRole('button', { name: 'Próximo destaque', exact: true }).click();
  await expect(page.getByText('2 de 3', { exact: true })).toBeVisible({ timeout: 1000 });
}).toPass({ timeout: 15000 });
await page.getByRole('link', { name: /^Correções/ }).click();
await page.waitForURL('**/novidades?tipo=fixed');
if ((await page.locator('article').count()) !== 2) throw new Error('Wrong filtered days');
await page.goto('http://127.0.0.1:5191/novidades?page=2#2026-09-29');
await page.getByRole('heading', { name: 'A Mesa Aberta está no ar', exact: true }).waitFor();
await page.goto('http://127.0.0.1:5191/changelog');
await page.waitForURL('**/novidades');
if (errors.length) throw new Error(errors.join('\n'));
console.log(
  'Captured desktop/mobile in both themes; carousel, filtering, older-day link and redirect passed.',
);
await browser.close();
