import { expect, test } from '@playwright/test';

for (const [name, path] of [
	['the home page', '/'],
	['a page that does not exist', '/nao-existe']
]) {
	test(`shows the credits footer on ${name}`, async ({ page }) => {
		await page.goto(path);

		const footer = page.getByRole('contentinfo');
		await expect(footer.getByRole('link', { name: 'GitHub' })).toBeVisible();
		await expect(footer.getByRole('link', { name: 'Lenindragons' })).toBeVisible();
	});
}
