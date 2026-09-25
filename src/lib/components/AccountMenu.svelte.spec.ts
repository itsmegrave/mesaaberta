import { render } from 'vitest-browser-svelte';
import { describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';
import AccountMenu from './AccountMenu.svelte';

describe('AccountMenu.svelte', () => {
	const trigger = (name = 'Marina Alves') =>
		page.getByRole('button', { name: new RegExp(name, 'i') });
	const menu = () => page.getByRole('navigation', { name: 'Menu da conta' });

	it('renders trigger with user name and aria-label', async () => {
		render(AccountMenu, { name: 'Marina Alves', avatarUrl: null });

		await expect.element(trigger()).toBeVisible();
		await expect.element(menu()).not.toBeInTheDocument();
	});

	it('opens the popover on click and shows user details and navigation links', async () => {
		render(AccountMenu, { name: 'Marina Alves', avatarUrl: null });

		await trigger().click();

		await expect.element(menu()).toBeVisible();
		await expect.element(page.getByTestId('account-user-name')).toHaveTextContent('Marina Alves');
		await expect
			.element(menu().getByRole('link', { name: 'Perfil' }))
			.toHaveAttribute('href', '/perfil');
		await expect
			.element(menu().getByRole('link', { name: 'Minhas mesas' }))
			.toHaveAttribute('href', '/account/tables');
		await expect.element(menu().getByRole('button', { name: 'Sair' })).toBeVisible();
	});

	it('renders Admin link with pending suggestion count badge for admins', async () => {
		render(AccountMenu, {
			name: 'Admin User',
			avatarUrl: null,
			isAdmin: true,
			pendingSuggestionsCount: 5
		});

		await trigger('Admin User').click();

		const adminLink = menu().getByRole('link', { name: /Admin/i });
		await expect.element(adminLink).toBeVisible();
		await expect.element(adminLink).toHaveAttribute('href', '/admin');
		await expect.element(adminLink).toHaveTextContent('Admin 5');
	});

	it('does not render Admin link for non-admin members', async () => {
		render(AccountMenu, {
			name: 'Regular Player',
			avatarUrl: null,
			isAdmin: false
		});

		await trigger('Regular Player').click();

		await expect.element(menu().getByRole('link', { name: /Admin/i })).not.toBeInTheDocument();
	});
});
