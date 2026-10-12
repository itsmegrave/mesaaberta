import { expect, test } from '@playwright/test';

test('the footer directs feedback and release notes to Canny', async ({ page }) => {
  await page.goto('/');
  const footer = page.getByRole('contentinfo');
  await expect(footer.getByRole('link', { name: 'novidades' })).toHaveAttribute(
    'href',
    'https://feedback.example.test/changelog',
  );
  await expect(footer.getByRole('link', { name: 'Reporte aqui' })).toHaveAttribute(
    'href',
    'https://feedback.example.test/feedback',
  );
});
