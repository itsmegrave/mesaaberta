import { expect, test } from '@playwright/test';

test('the footer directs feedback and release notes to Canny', async ({ page }) => {
  await page.goto('/');
  const footer = page.getByRole('contentinfo');
  await expect(footer.getByRole('link', { name: 'novidades' })).toHaveAttribute(
    'href',
    'https://mesaaberta.canny.io/changelog',
  );
  await expect(footer.getByRole('link', { name: 'Reporte aqui' })).toHaveAttribute(
    'href',
    'https://mesaaberta.canny.io/feedback',
  );
});
