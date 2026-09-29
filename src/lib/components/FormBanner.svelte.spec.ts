import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import FormBanner from './FormBanner.svelte';

describe('FormBanner', () => {
  it('announces a problem as an alert', async () => {
    render(FormBanner, { text: 'Muitas tentativas. Tente de novo em alguns minutos.' });

    await expect
      .element(page.getByRole('alert'))
      .toHaveTextContent('Muitas tentativas. Tente de novo em alguns minutos.');
  });

  it('announces a success politely, as a status', async () => {
    render(FormBanner, { text: 'Perfil salvo.', tone: 'success' });

    await expect.element(page.getByRole('status')).toHaveTextContent('Perfil salvo.');
    await expect.element(page.getByRole('alert')).not.toBeInTheDocument();
  });

  it('renders nothing without a text', async () => {
    render(FormBanner, { text: null });

    await expect.element(page.getByRole('alert')).not.toBeInTheDocument();
    await expect.element(page.getByRole('status')).not.toBeInTheDocument();
  });
});
