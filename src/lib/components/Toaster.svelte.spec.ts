import { page } from 'vitest/browser';
import { describe, expect, it, beforeEach } from 'vitest';
import { render } from 'vitest-browser-svelte';
import Toaster from './Toaster.svelte';
import { toast } from '$lib/stores/toast.svelte';

describe('Toaster.svelte', () => {
	beforeEach(() => {
		toast.clear();
	});

	it('renders active toasts with role="status"', async () => {
		render(Toaster);

		toast.success('Vaga confirmada! O convite está no seu e-mail.');

		const status = page.getByRole('status');
		await expect.element(status).toBeVisible();
		await expect
			.element(status)
			.toHaveTextContent('Vaga confirmada! O convite está no seu e-mail.');
	});

	it('dismisses a toast when clicking the close button', async () => {
		render(Toaster);

		toast.error('A mesa lotou.');

		const status = page.getByRole('status');
		await expect.element(status).toBeVisible();

		const closeBtn = page.getByRole('button', { name: 'Fechar aviso' });
		await closeBtn.click();

		await expect.element(page.getByRole('status')).not.toBeInTheDocument();
	});
});
