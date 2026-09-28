import { page } from 'vitest/browser';
import { afterEach, describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import Toaster from './Toaster.svelte';
import { toast, toaster } from '$lib/toaster';

afterEach(() => toast.clear());

describe('Toaster', () => {
  it('shows a message until the reader closes it', async () => {
    render(Toaster);

    // No timeout: under a loaded test run the default one can close it before the click.
    toaster.success({ title: 'Mesa salva', duration: Infinity });

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
