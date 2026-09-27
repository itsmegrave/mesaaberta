import { render } from 'vitest-browser-svelte';
import { describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';
import BottomTabBar from './BottomTabBar.svelte';

describe('BottomTabBar.svelte', () => {
	const nav = () => page.getByRole('navigation', { name: 'Navegação móvel' });

	it('renders base tabs for standard member', async () => {
		render(BottomTabBar, { isAdmin: false });

		await expect.element(nav()).toBeVisible();
		await expect
			.element(nav().getByRole('link', { name: 'Mesas' }))
			.toHaveAttribute('href', '/tables');
		await expect
			.element(nav().getByRole('link', { name: 'Abrir mesa' }))
			.toHaveAttribute('href', '/tables/new');
		await expect
			.element(nav().getByRole('link', { name: 'Minhas mesas' }))
			.toHaveAttribute('href', '/account/tables');
		await expect.element(nav().getByRole('link', { name: 'Admin' })).not.toBeInTheDocument();
	});

	it('renders Admin tab when role is admin', async () => {
		render(BottomTabBar, { isAdmin: true });

		await expect.element(nav()).toBeVisible();
		await expect
			.element(nav().getByRole('link', { name: 'Admin' }))
			.toHaveAttribute('href', '/admin');
	});
});
