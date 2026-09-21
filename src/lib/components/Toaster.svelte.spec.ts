import { page } from 'vitest/browser';
import { afterEach, describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import Toaster from './Toaster.svelte';
import { toast } from '$lib/toaster';

afterEach(() => toast.clear());

describe('Toaster', () => {
	it('shows a message until the reader closes it', async () => {
		render(Toaster);

		toast.success('Mesa salva');

		await expect.element(page.getByText('Mesa salva')).toBeVisible();
		await page.getByRole('button', { name: 'Fechar aviso' }).click();
		await expect.element(page.getByText('Mesa salva')).not.toBeInTheDocument();
	});

	it('shows an error and a pending notice', async () => {
		render(Toaster);

		toast.error('Não deu certo');
		toast.pending('Aguardando o mestre');

		await expect.element(page.getByText('Não deu certo')).toBeVisible();
		await expect.element(page.getByText('Aguardando o mestre')).toBeVisible();
	});
});
