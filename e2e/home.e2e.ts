import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
	await page.goto('/');
});

test('has a document title and exactly one top-level heading', async ({ page }) => {
	await expect(page).toHaveTitle(/.+/);
	await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
});

test('does not scroll horizontally', async ({ page }) => {
	const overflow = await page.evaluate(
		() => document.documentElement.scrollWidth - document.documentElement.clientWidth
	);

	expect(overflow).toBeLessThanOrEqual(0);
});

test('skip link is the first tab stop and moves to the main region', async ({ page }) => {
	await page.keyboard.press('Tab');
	const skipLink = page.getByRole('link', { name: /skip/i });
	await expect(skipLink).toBeFocused();
	await expect(skipLink).toBeInViewport();

	await page.keyboard.press('Enter');

	await expect(page).toHaveURL(/#main$/);
	await expect(page.getByRole('main')).toHaveAttribute('id', 'main');
});
