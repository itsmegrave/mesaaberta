import '../../../layout.css';
import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import Page from './+page.svelte';

const invitation = (over: Record<string, unknown> = {}, partner: Record<string, unknown> = {}) => ({
  id: '00000000-0000-4000-8000-000000000001',
  status: 'pending',
  expiresAt: new Date(Date.now() + 3 * 86_400_000),
  inviter: 'marina-alves',
  partner: {
    id: '00000000-0000-4000-8000-000000000002',
    name: 'Taverna do Dado Torto',
    types: ['community', 'content'],
    logoUrl: null,
    removed: false,
    ...partner,
  },
  ...over,
});
const show = (over: Record<string, unknown> = {}, partner: Record<string, unknown> = {}) =>
  render(Page, { data: { invitation: invitation(over, partner) } as never });

describe('the partner invitation page', () => {
  it('names the partner and its kinds, says who invited and asks for an answer', async () => {
    show();
    await expect
      .element(page.getByRole('heading', { level: 1, name: 'Taverna do Dado Torto' }))
      .toBeVisible();
    await expect.element(page.getByText('Comunidade')).toBeVisible();
    await expect.element(page.getByText(/@marina-alves convidou você para cuidar/)).toBeVisible();
    await expect.element(page.getByRole('button', { name: 'Aceitar convite' })).toBeVisible();
    await expect.element(page.getByRole('button', { name: 'Recusar convite' })).toBeVisible();
  });

  it('links an accepted invite to the edit page', async () => {
    show({ status: 'accepted' });
    await expect.element(page.getByText('Convite aceito')).toBeVisible();
    await expect
      .element(page.getByRole('link', { name: 'Editar parceiro' }))
      .toHaveAttribute('href', '/p/00000000-0000-4000-8000-000000000002/edit');
  });

  it('shows a lapsed invite as expired', async () => {
    show({ expiresAt: new Date(Date.now() - 1000) });
    await expect.element(page.getByText('Convite expirado')).toBeVisible();
    await expect
      .element(page.getByRole('button', { name: 'Aceitar convite' }))
      .not.toBeInTheDocument();
  });

  it('shows an invite whose partner left the page as cancelled', async () => {
    show({}, { removed: true });
    await expect.element(page.getByText('Convite cancelado')).toBeVisible();
  });
});
