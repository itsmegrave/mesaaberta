import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import ErrorSummary from './ErrorSummary.svelte';

const errors = [
  { id: 'title', label: 'Título', message: 'Use de 3 a 80 caracteres.' },
  { id: 'startsAtLocal', label: 'Primeira sessão', message: 'Escolha uma data.' },
];

describe('ErrorSummary', () => {
  it('says how many fields need attention, as an alert', async () => {
    render(ErrorSummary, { errors });

    await expect.element(page.getByRole('alert')).toBeVisible();
    expect(page.getByRole('alert').element().textContent).toContain(
      'Corrija 2 campos para continuar',
    );
  });

  it('says it in the singular for one', async () => {
    render(ErrorSummary, { errors: [errors[0]] });

    await expect.element(page.getByRole('alert')).toBeVisible();
    expect(page.getByRole('alert').element().textContent).toContain(
      'Corrija 1 campo para continuar',
    );
  });

  it('draws nothing without errors', async () => {
    render(ErrorSummary, { errors: [] });

    expect(page.getByRole('alert').elements()).toHaveLength(0);
  });

  it('links each field to its control, and the link moves focus there', async () => {
    document.body.insertAdjacentHTML('beforeend', '<input id="title" aria-label="campo título" />');
    render(ErrorSummary, { errors });

    const link = page.getByRole('link', { name: 'Título: Use de 3 a 80 caracteres.' });
    await expect.element(link).toHaveAttribute('href', '#title');
    await link.click();

    expect(document.activeElement?.id).toBe('title');
    document.getElementById('title')?.remove();
  });
});
