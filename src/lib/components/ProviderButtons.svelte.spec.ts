import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import ProviderButtons from './ProviderButtons.svelte';

describe('ProviderButtons', () => {
	it('offers Google and Discord, each named on its button', async () => {
		render(ProviderButtons, { next: '/' });

		await expect.element(page.getByRole('link', { name: 'Continuar com Google' })).toBeVisible();
		await expect.element(page.getByRole('link', { name: 'Continuar com Discord' })).toBeVisible();
	});

	it('offers nobody else', async () => {
		render(ProviderButtons, { next: '/' });

		expect(page.getByRole('link').elements()).toHaveLength(2);
	});

	it("starts the login at the provider's own route, carrying where to go afterwards", async () => {
		render(ProviderButtons, { next: '/tables/new' });

		await expect
			.element(page.getByRole('link', { name: 'Continuar com Google' }))
			.toHaveAttribute('href', '/login/google?next=%2Ftables%2Fnew');
		await expect
			.element(page.getByRole('link', { name: 'Continuar com Discord' }))
			.toHaveAttribute('href', '/login/discord?next=%2Ftables%2Fnew');
	});

	it("shows each provider's mark, hidden from screen readers since the button already says the name", async () => {
		render(ProviderButtons, { next: '/' });

		for (const name of ['Continuar com Google', 'Continuar com Discord']) {
			const link = page.getByRole('link', { name }).element();
			const svg = link.querySelector('svg');

			expect(svg).not.toBeNull();
			expect(svg?.getAttribute('aria-hidden')).toBe('true');
		}
	});

	it('draws the Google mark in its four colours and the Discord one in white on blurple', async () => {
		render(ProviderButtons, { next: '/' });
		const google = page.getByRole('link', { name: 'Continuar com Google' }).element();
		const discord = page.getByRole('link', { name: 'Continuar com Discord' }).element();

		const fills = [...google.querySelectorAll('path')].map((p) => p.getAttribute('fill')).sort();
		expect(fills).toEqual(['#34A853', '#4285F4', '#EA4335', '#FBBC05']);
		expect(discord.querySelector('path')?.getAttribute('fill')).toBe('#ffffff');
	});
});
