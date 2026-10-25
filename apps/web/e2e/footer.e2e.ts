import { expect, test } from '@playwright/test';

for (const [name, path] of [
  ['the home page', '/'],
  ['a page that does not exist', '/nao-existe'],
]) {
  test(`shows the credits footer on ${name}`, async ({ page }) => {
    await page.goto(path);

    const footer = page.getByRole('contentinfo');
    await expect(footer.getByRole('link', { name: 'itsmegrave' })).toBeVisible();
    await expect(footer.getByRole('link', { name: 'GitHub' })).toHaveAttribute(
      'href',
      'https://github.com/itsmegrave/mesaaberta',
    );
    await expect(footer.getByRole('link', { name: 'contato@example.test' })).toHaveAttribute(
      'href',
      'mailto:contato@example.test',
    );
    await expect(
      footer.getByRole('link', { name: 'Instagram da Mesa Aberta, @mesaaberta.test' }),
    ).toHaveAttribute('href', 'https://www.instagram.com/mesaaberta.test/');
    await expect(footer.getByRole('link', { name: 'Parceiros' })).toHaveAttribute('href', '/p');
  });
}
