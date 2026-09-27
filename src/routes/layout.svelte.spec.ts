import { createRawSnippet } from 'svelte';
import { page } from 'vitest/browser';
import { describe, expect, it, beforeEach } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { toast } from '$lib/toaster';
import Layout from './+layout.svelte';

const children = createRawSnippet(() => ({ render: () => '<p>Page content</p>' }));
const signedOut = { authEnabled: false, released: false, account: null };
const memberAccount = {
	displayName: 'Ana Souza',
	avatarUrl: null,
	isAdmin: false,
	pendingSuggestionsCount: 0
};
const adminAccount = {
	displayName: 'Mestre Silva',
	avatarUrl: null,
	isAdmin: true,
	pendingSuggestionsCount: 3
};

describe('+layout.svelte', () => {
	beforeEach(async () => {
		await page.viewport(1280, 800);
	});

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

		it('appears once it is released on desktop', async () => {
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

		it('shows the account trigger, and reveals sign-out only when the menu is opened', async () => {
			render(Layout, {
				children,
				data: {
					authEnabled: true,
					released: false,
					account: memberAccount
				}
			});

			const menu = banner().getByRole('button', { name: /Ana Souza/i });
			await expect.element(menu).toBeVisible();
			await expect.element(page.getByRole('button', { name: 'Sair' })).not.toBeInTheDocument();

			await menu.click();

			await expect.element(page.getByRole('button', { name: 'Sair' })).toBeVisible();
		});

		const accountMenu = () => page.getByRole('navigation', { name: 'Menu da conta' });

		it('links to the dashboard and profile from the account menu', async () => {
			render(Layout, {
				children,
				data: {
					authEnabled: true,
					released: false,
					account: memberAccount
				}
			});
			await banner()
				.getByRole('button', { name: /Ana Souza/i })
				.click();

			await expect
				.element(accountMenu().getByRole('link', { name: 'Perfil' }))
				.toHaveAttribute('href', '/perfil');
			await expect
				.element(accountMenu().getByRole('link', { name: 'Minhas mesas' }))
				.toHaveAttribute('href', '/account/tables');
		});

		it('shows admin link and suggestion count badge for admins', async () => {
			render(Layout, {
				children,
				data: {
					authEnabled: true,
					released: false,
					account: adminAccount
				}
			});
			await banner()
				.getByRole('button', { name: /Mestre Silva/i })
				.click();

			const adminLink = accountMenu().getByRole('link', { name: /Admin/i });
			await expect.element(adminLink).toBeVisible();
			await expect.element(adminLink).toHaveAttribute('href', '/admin');
			await expect.element(adminLink).toHaveTextContent('Admin 3');
		});

		it('signs out with a POST to /logout, never a link', async () => {
			render(Layout, {
				children,
				data: {
					authEnabled: true,
					released: false,
					account: memberAccount
				}
			});
			await banner()
				.getByRole('button', { name: /Ana Souza/i })
				.click();

			const form = accountMenu().getByRole('button', { name: 'Sair' }).element().closest('form');

			expect(form?.method).toBe('post');
			expect(form?.getAttribute('action')).toBe('/logout');
		});

		it('shows open table button in header on desktop when released and signed in', async () => {
			render(Layout, {
				children,
				data: {
					authEnabled: true,
					released: true,
					account: memberAccount
				}
			});

			await expect
				.element(banner().getByRole('link', { name: 'Abrir uma mesa' }))
				.toHaveAttribute('href', '/tables/new');
		});
	});

	describe('mobile bottom tab bar', () => {
		beforeEach(async () => {
			await page.viewport(390, 844);
		});

		it('renders bottom tab bar when released', async () => {
			render(Layout, {
				children,
				data: {
					authEnabled: true,
					released: true,
					account: memberAccount
				}
			});

			const nav = page.getByRole('navigation', { name: 'Navegação móvel' });
			await expect.element(nav).toBeVisible();
			await expect
				.element(nav.getByRole('link', { name: 'Mesas' }))
				.toHaveAttribute('href', '/tables');
			await expect
				.element(nav.getByRole('link', { name: 'Abrir mesa' }))
				.toHaveAttribute('href', '/tables/new');
			await expect
				.element(nav.getByRole('link', { name: 'Minhas mesas' }))
				.toHaveAttribute('href', '/account/tables');
		});

		it('includes Admin tab on bottom tab bar for admins', async () => {
			render(Layout, {
				children,
				data: {
					authEnabled: true,
					released: true,
					account: adminAccount
				}
			});

			const nav = page.getByRole('navigation', { name: 'Navegação móvel' });
			await expect
				.element(nav.getByRole('link', { name: 'Admin' }))
				.toHaveAttribute('href', '/admin');
		});
	});

	describe('toaster', () => {
		it('renders toasts triggered in the application', async () => {
			toast.clear();
			render(Layout, { children, data: signedOut });

			toast.success('Vaga confirmada!');

			await expect.element(page.getByText('Vaga confirmada!')).toBeVisible();
		});
	});
});
