import '../../layout.css';
import { page } from 'vitest/browser';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import Page from './+page.svelte';

vi.mock('$app/state', () => ({
  page: { url: new URL('http://localhost/u/ana'), params: { username: 'ana' } },
}));

const show = (links: { network: string; text: string; href: string | null }[], name?: string) =>
  render(Page, {
    data: {
      profile: {
        username: 'ana',
        name: name ?? null,
        avatarUrl: null,
        links,
        totals: { played: 0, hosted: 0 },
        rating: { score: null, count: 0, isNew: true },
      },
      tables: [],
      page: 1,
      pages: 1,
      total: 0,
      isOwner: false,
      previewing: false,
      canonical: 'http://localhost/u/ana',
    } as never,
  });

describe('public profile social links', () => {
  beforeEach(async () => {
    await page.viewport(390, 800);
  });

  it('shows each network with its icon and the handle beside it, opening the profile', async () => {
    show([
      { network: 'instagram', text: '@ana', href: 'https://instagram.com/ana' },
      { network: 'website', text: 'ana.example', href: 'https://ana.example/' },
    ]);

    const instagram = page.getByRole('link', { name: 'Abrir Instagram em nova aba' });
    await expect.element(instagram).toHaveAttribute('href', 'https://instagram.com/ana');
    await expect.element(instagram).toHaveTextContent('@ana');
    await expect.element(instagram).toHaveAttribute('title', 'Instagram');
    await expect.element(page.getByText('ana.example')).toBeVisible();
  });

  it('shows a Discord handle with the network as a tooltip and no link', async () => {
    show([{ network: 'discord', text: '@ana_rpg', href: null }]);

    await expect.element(page.getByText('@ana_rpg')).toBeVisible();
    await expect.element(page.getByTitle('Discord')).toBeVisible();
    await expect
      .element(page.getByRole('link', { name: 'Abrir Discord em nova aba' }))
      .not.toBeInTheDocument();
  });
});

describe('public profile title', () => {
  it('is the @usuário, with the name under it only when there is one to show', async () => {
    show([], 'Ana Souza');

    await expect.element(page.getByRole('heading', { level: 1 })).toHaveTextContent('@ana');
    await expect.element(page.getByText('Ana Souza')).toBeVisible();
  });

  it('has no name line when the person keeps the name private', async () => {
    show([]);

    await expect.element(page.getByRole('heading', { level: 1 })).toHaveTextContent('@ana');
    await expect.element(page.getByText('Ana Souza')).not.toBeInTheDocument();
  });
});
