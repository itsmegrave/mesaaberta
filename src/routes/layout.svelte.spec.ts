import { createRawSnippet } from 'svelte';
import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import Layout from './+layout.svelte';

const children = createRawSnippet(() => ({ render: () => '<p>Page content</p>' }));

describe('+layout.svelte', () => {
	it('skip link targets the id of the main region', async () => {
		render(Layout, { children });

		const mainId = page.getByRole('main').element().id;
		const skipHref = page.getByRole('link', { name: /pular/i }).element().getAttribute('href');

		expect(mainId).not.toBe('');
		expect(skipHref).toBe(`#${mainId}`);
	});

	it('renders page content inside the main region', async () => {
		render(Layout, { children });

		await expect.element(page.getByRole('main')).toHaveTextContent('Page content');
	});

	it('links the header brand to the home page', async () => {
		render(Layout, { children });

		await expect
			.element(page.getByRole('banner').getByRole('link', { name: 'Mesa Aberta' }))
			.toHaveAttribute('href', '/');
	});

	describe('footer credits', () => {
		it.each([
			['itsmegrave', 'https://github.com/itsmegrave'],
			['GitHub', 'https://github.com/itsmegrave/mesaaberta'],
			['Lenindragons', 'https://linktr.ee/lenindragonsrpg']
		])('links %s to %s', async (name, href) => {
			render(Layout, { children });

			await expect
				.element(page.getByRole('contentinfo').getByRole('link', { name }))
				.toHaveAttribute('href', href);
		});
	});
});
