import '../../../../layout.css';
import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import Page from './+page.svelte';

const invitation = (over: Record<string, unknown> = {}) => ({
  id: '00000000-0000-4000-8000-000000000001',
  status: 'pending',
  expiresAt: new Date(Date.now() + 3600000),
  createdAt: new Date(),
  gmId: '00000000-0000-4000-8000-000000000002',
  gmUsername: 'marina-alves',
  table: {
    title: 'A Torre das Marés Mortas',
    slug: 'torre',
    kind: 'campaign',
    startsAt: new Date('2099-09-26T22:00:00Z'),
    timezone: 'America/Sao_Paulo',
  },
  ...over,
});
const show = (over: Record<string, unknown> = {}) =>
  render(Page, { data: { invitation: invitation(over) } as never, form: null as never });

describe('the invitation page', () => {
  it('titles the page with the table, says who invited and when, and asks for an answer', async () => {
    show();
    await expect
      .element(page.getByRole('heading', { level: 1, name: 'A Torre das Marés Mortas' }))
      .toBeVisible();
    await expect.element(page.getByText('Convite para jogar', { exact: true })).toBeVisible();
    await expect
      .element(page.getByText(/@marina-alves convidou você para esta mesa\. Campanha · /))
      .toBeVisible();
    await expect
      .element(page.getByRole('status').getByText('Aguardando sua resposta'))
      .toBeVisible();
    await expect.element(page.getByRole('button', { name: 'Aceitar convite' })).toBeVisible();
    await expect.element(page.getByRole('button', { name: 'Recusar convite' })).toBeVisible();
  });

  it('shows how an answered invite ended, with the way to the table once accepted', async () => {
    show({ status: 'accepted' });
    await expect.element(page.getByText('Convite aceito', { exact: true })).toBeVisible();
    await expect
      .element(page.getByRole('link', { name: 'Ver a página da mesa' }))
      .toHaveAttribute('href', '/t/torre');
    expect(page.getByRole('button', { name: 'Aceitar convite' }).elements()).toHaveLength(0);
  });

  it('reads a pending invite past its deadline as expired', async () => {
    show({ expiresAt: new Date(0) });
    await expect.element(page.getByText('Convite expirado', { exact: true })).toBeVisible();
  });

  it('asks before blocking the person who invited', async () => {
    show();
    await page.getByRole('button', { name: 'Bloquear convites de @marina-alves…' }).click();
    const dialog = page.getByRole('alertdialog');
    await expect.element(dialog.getByRole('button', { name: 'Cancelar' })).toHaveFocus();
    expect(
      dialog
        .getByRole('button', { name: 'Bloquear convites', exact: true })
        .element()
        .closest('form')
        ?.getAttribute('action'),
    ).toBe('?/block');
  });
});
