import { createRawSnippet } from 'svelte';
import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import ActionForm from './ActionForm.svelte';

const button = createRawSnippet(() => ({
  render: () => '<button type="submit">Sair da mesa</button>',
}));
const formOf = () => page.getByRole('button', { name: 'Sair da mesa' }).element().closest('form')!;

describe('ActionForm', () => {
  it('is a plain POST to its action, so it works without JavaScript', async () => {
    render(ActionForm, { action: '/tables/mesa?/leave', children: button });

    expect(formOf().method).toBe('post');
    expect(formOf().getAttribute('action')).toBe('/tables/mesa?/leave');
  });

  it('carries the player and where to come back to in hidden fields', async () => {
    render(ActionForm, {
      action: '?/remove',
      playerId: '11111111-1111-4111-8111-111111111111',
      next: '/account/tables',
      children: button,
    });

    const field = (name: string) => formOf().querySelector<HTMLInputElement>(`input[name=${name}]`);
    expect(field('playerId')?.value).toBe('11111111-1111-4111-8111-111111111111');
    expect(field('next')?.value).toBe('/account/tables');
  });

  it('sends no hidden field it was not given', async () => {
    render(ActionForm, { action: '?/leave', children: button });

    expect(formOf().querySelector('input[name=playerId]')).toBeNull();
    expect(formOf().querySelector('input[name=next]')).toBeNull();
  });
});

describe('ActionForm with a label', () => {
  it('renders its own submit button, with the classes it is given', async () => {
    render(ActionForm, {
      action: '/tables/mesa?/leave',
      label: 'Sair da mesa',
      buttonClass: 'btn h-12 border-2',
    });

    const submit = page.getByRole('button', { name: 'Sair da mesa' });
    await expect.element(submit).toHaveAttribute('type', 'submit');
    await expect.element(submit).toHaveClass('btn', 'h-12', 'border-2');
    expect(formOf().getAttribute('action')).toBe('/tables/mesa?/leave');
  });

  it('is not busy until it is submitted', async () => {
    render(ActionForm, { action: '?/leave', label: 'Sair da mesa' });

    await expect
      .element(page.getByRole('button', { name: 'Sair da mesa' }))
      .not.toHaveAttribute('aria-busy');
  });
});
