import '../../layout.css';
import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import Page from './+page.svelte';

const form = { valid: false, data: { authorizationId: 'auth-123' }, errors: {} };
const show = (data: Record<string, unknown>, result: unknown = null) =>
  render(Page, { data: data as never, form: result as never });

describe('the OAuth consent page', () => {
  it('names the client, the account, what it can see and that it changes nothing', async () => {
    show({ request: { client: 'Claude', returnsTo: 'claude.ai', username: 'grave' }, form });
    await expect
      .element(page.getByRole('heading', { level: 1, name: 'Conectar Claude à sua conta' }))
      .toBeVisible();
    await expect.element(page.getByText('Claude vai ver o Mesa Aberta como @grave.')).toBeVisible();
    await expect.element(page.getByText(/Claude não muda nada no site/)).toBeVisible();
    await expect.element(page.getByText('Depois, você volta para claude.ai.')).toBeVisible();
    await expect.element(page.getByRole('button', { name: 'Permitir' })).toBeVisible();
    await expect.element(page.getByRole('button', { name: 'Não permitir' })).toBeVisible();
  });

  it('says a request that no longer holds expired, with nothing to approve', async () => {
    show({ request: null });
    await expect.element(page.getByRole('alert').getByText(/Volte ao app/)).toBeVisible();
    expect(page.getByRole('button', { name: 'Permitir' }).elements()).toHaveLength(0);
  });

  it('turns the page into the expired notice when a decision comes back refused', async () => {
    show(
      { request: { client: 'Claude', returnsTo: 'claude.ai', username: 'grave' }, form },
      { form: { ...form, message: { code: 'expired' } } },
    );
    await expect.element(page.getByRole('alert').getByText(/Volte ao app/)).toBeVisible();
  });
});
