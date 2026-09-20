import { createRawSnippet } from 'svelte';
import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import Layout from './+layout.svelte';

const children = createRawSnippet(() => ({ render: () => '<p>Page content</p>' }));
const signedOut = { authEnabled: false, released: false, account: null };

describe('+layout.svelte', () => {
	it('skip link targets the id of the main region', async () => {
		render(Layout, { children, data: signedOut });

		const mainId = page.getByRole('main').element().id;
		const skipHref = page.getByRole('link', { name: /pular/i }).element().getAttribute('href');

		expect(mainId).not.toBe('');
		expect(skipHref).toBe(`#${mainId}`);
	});

	it('renders page content inside the main region', async () => {
		render(Layout, { children, data: signedOut });

		await expect.element(page.getByRole('main')).toHaveTextContent('Page content');
	});

	it('links the header brand to the home page', async () => {
		render(Layout, { children, data: signedOut });

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
			render(Layout, { children, data: signedOut });

			await expect
				.element(page.getByRole('contentinfo').getByRole('link', { name }))
				.toHaveAttribute('href', href);
		});
	});

	describe('tables link', () => {
		it('is hidden until the platform is released, so nobody is sent to an unfinished page', async () => {
			render(Layout, { children, data: signedOut });

			await expect
				.element(page.getByRole('banner').getByRole('link', { name: 'Mesas' }))
				.not.toBeInTheDocument();
		});

		it('appears once it is released', async () => {
			render(Layout, { children, data: { ...signedOut, released: true } });

			await expect
				.element(page.getByRole('banner').getByRole('link', { name: 'Mesas' }))
				.toHaveAttribute('href', '/tables');
		});
	});

	describe('account area', () => {
		const banner = () => page.getByRole('banner');

		it('has no sign-in link while login is not configured, so nobody is sent to a dead end', async () => {
			render(Layout, { children, data: signedOut });

			await expect.element(banner().getByRole('link', { name: 'Entrar' })).not.toBeInTheDocument();
		});

		it('keeps sign-in hidden until the platform is released', async () => {
			render(Layout, { children, data: { authEnabled: true, released: false, account: null } });

			await expect.element(banner().getByRole('link', { name: 'Entrar' })).not.toBeInTheDocument();
		});

		it('offers sign-in to an anonymous visitor once login and the platform are enabled', async () => {
			render(Layout, { children, data: { authEnabled: true, released: true, account: null } });

			await expect
				.element(banner().getByRole('link', { name: 'Entrar' }))
				.toHaveAttribute('href', '/login');
		});

		it('shows the signed-in name, and reveals sign-out only when the menu is opened', async () => {
			render(Layout, {
				children,
				data: {
					authEnabled: true,
					released: false,
					account: { displayName: 'Ana Souza', avatarUrl: null }
				}
			});

			const menu = banner().getByText('Ana Souza');
			await expect.element(menu).toBeVisible();
			await expect.element(page.getByRole('button', { name: 'Sair' })).not.toBeInTheDocument();

			await menu.click();

			await expect.element(page.getByRole('button', { name: 'Sair' })).toBeVisible();
		});

		it('links to the dashboard from the account menu', async () => {
			render(Layout, {
				children,
				data: {
					authEnabled: true,
					released: false,
					account: { displayName: 'Ana Souza', avatarUrl: null }
				}
			});
			await banner().getByText('Ana Souza').click();

			await expect
				.element(page.getByRole('link', { name: 'Minhas mesas' }))
				.toHaveAttribute('href', '/account/tables');
		});

		it('signs out with a POST to /logout, never a link', async () => {
			render(Layout, {
				children,
				data: {
					authEnabled: true,
					released: false,
					account: { displayName: 'Ana Souza', avatarUrl: null }
				}
			});
			await banner().getByText('Ana Souza').click();

			const form = page.getByRole('button', { name: 'Sair' }).element().closest('form');

			expect(form?.method).toBe('post');
			expect(form?.getAttribute('action')).toBe('/logout');
		});
	});
});
