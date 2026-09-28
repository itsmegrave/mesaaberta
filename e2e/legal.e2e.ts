import { expect, test } from '@playwright/test';

for (const [name, path, heading] of [
  ['privacy policy', '/privacy', 'Política de privacidade'],
  ['terms of use', '/terms', 'Termos de uso'],
] as const) {
  test(`the ${name} is served, and names a contact for data requests`, async ({ page }) => {
    await page.goto(path);

    await expect(page.getByRole('heading', { level: 1 })).toHaveText(heading);
    await expect(
      page.getByRole('main').getByRole('link', { name: 'privacidade@mesaaberta.app' }).first(),
    ).toHaveAttribute('href', 'mailto:privacidade@mesaaberta.app');
  });
}

test('the privacy policy says which cookies are used and that no consent banner is needed', async ({
  page,
}) => {
  await page.goto('/privacy');

  await expect(
    page.getByRole('heading', { name: 'Cookies e armazenamento no navegador' }),
  ).toBeVisible();
  await expect(page.getByText(/estritamente necessários/)).toBeVisible();
});

for (const path of ['/signup', '/login']) {
  test(`${path} links to the terms and the privacy policy before an account is made`, async ({
    page,
  }) => {
    await page.goto(path);
    test.skip(
      (await page.getByRole('link', { name: 'Termos de uso' }).count()) === 0 &&
        (await page.getByText('indisponível', { exact: false }).count()) > 0,
      'sign-in is not configured here',
    );

    const main = page.getByRole('main');
    await expect(main.getByRole('link', { name: 'Termos de uso' })).toHaveAttribute(
      'href',
      '/terms',
    );
    await expect(main.getByRole('link', { name: 'Política de privacidade' })).toHaveAttribute(
      'href',
      '/privacy',
    );
  });
}
