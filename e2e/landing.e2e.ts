import { expect, test } from '@playwright/test';

test('declares the page language as Brazilian Portuguese', async ({ page }) => {
	await page.goto('/');

	await expect(page.locator('html')).toHaveAttribute('lang', 'pt-BR');
});

test('describes the hero table illustration, including the empty chair', async ({ page }) => {
	await page.goto('/');

	await expect(page.getByRole('img', { name: /cadeira vazia/i })).toBeVisible();
});

test('presents how it works as an ordered list of three steps', async ({ page }) => {
	await page.goto('/');

	const region = page.getByRole('region', { name: /como funciona/i });

	await expect(region.getByRole('list')).toHaveCount(1);
	await expect(region.getByRole('listitem')).toHaveCount(3);
});

test('offers distinct paths for players and game masters before showing open tables', async ({
	page
}) => {
	await page.goto('/');

	const roles = page.locator('section[aria-labelledby="roles"]');
	await expect(roles.getByRole('heading', { name: 'Para quem joga' })).toBeVisible();
	await expect(roles.getByRole('heading', { name: 'Para quem mestra' })).toBeVisible();
	await expect(roles.getByRole('link', { name: 'Ver mesas abertas' })).toHaveAttribute(
		'href',
		'/tables'
	);
	await expect(roles.getByRole('link', { name: 'Abrir uma mesa' })).toHaveAttribute(
		'href',
		'/tables/new'
	);

	await expect(page.locator('section[aria-labelledby="open-tables"]')).toBeVisible();
});

test('says the project is open source and links to its repository', async ({ page }) => {
	await page.goto('/');

	await expect(page.getByRole('main').getByText(/código aberto/i)).toBeVisible();
	await expect(page.getByRole('link', { name: /código/i })).toHaveAttribute(
		'href',
		'https://github.com/itsmegrave/mesaaberta'
	);
});

test('sections are reachable through English anchors', async ({ page }) => {
	for (const anchor of ['how-it-works', 'for-game-masters']) {
		await page.goto(`/#${anchor}`);

		await expect(page.locator(`section[aria-labelledby="${anchor}"] > #${anchor}`)).toBeVisible();
	}
});

test.describe('seats', () => {
	const seats = '[data-seat]';

	test('are all fully visible once the intro animation has played', async ({ page }) => {
		await page.goto('/');
		const all = page.locator(seats);
		await expect(all).toHaveCount(6);

		await expect
			.poll(() => all.evaluateAll((els) => els.map((el) => getComputedStyle(el).opacity)))
			.toEqual(Array(6).fill('1'));
	});

	test.describe('with reduced motion', () => {
		test.use({ reducedMotion: 'reduce' });

		test('are visible immediately, with no animation', async ({ page }) => {
			await page.goto('/');

			const state = await page
				.locator(seats)
				.evaluateAll((els) =>
					els.map((el) => [getComputedStyle(el).opacity, getComputedStyle(el).animationName])
				);

			expect(state).toEqual(Array(6).fill(['1', 'none']));
		});
	});
});
