import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import GmCard from './GmCard.svelte';

const gm = (values = {}) => ({
  username: 'ana',
  name: 'Ana Lúcia' as string | null,
  avatarUrl: null,
  bio: 'Mestro terror investigativo.',
  tableRole: 'gm' as const,
  rating: { score: 4.8, count: 12, isNew: false },
  badges: null,
  openTables: 2,
  systems: [
    { name: 'Call of Cthulhu', slug: 'call-of-cthulhu', tables: 4 },
    { name: 'Vampiro', slug: 'vampiro', tables: 1 },
  ],
  moreSystems: 3,
  ...values,
});

describe('GmCard', () => {
  it('is one link to the profile, named by the name, with the @usuário, systems and facts', async () => {
    await render(GmCard, { gm: gm(), facts: '5 mesas mestradas · Recife' });
    const link = page.getByRole('link', { name: 'Ana Lúcia' });
    await expect.element(link).toHaveAttribute('href', '/u/ana');
    expect(page.getByRole('link').all()).toHaveLength(1);
    await expect.element(page.getByText('@ana')).toBeVisible();
    await expect.element(page.getByText('Mestra', { exact: true })).toBeVisible();
    const systems = page.getByRole('list', { name: 'Sistemas que mestra' }).getByRole('listitem');
    expect(
      systems.all().map((item) => item.element().textContent?.replace(/\s+/g, ' ').trim()),
    ).toEqual(['Call of Cthulhu · 4', 'Vampiro · 1', '+3']);
    await expect.element(page.getByText('5 mesas mestradas · Recife')).toBeVisible();
    expect(page.getByText('2 mesas abertas agora').element().classList.contains('text-lamp')).toBe(
      true,
    );
  });

  it('names the card by the @usuário when the name is not public', async () => {
    await render(GmCard, { gm: gm({ name: null, openTables: 0, systems: [] }), facts: '' });
    await expect.element(page.getByRole('link', { name: '@ana' })).toBeVisible();
    await expect
      .element(page.getByRole('list', { name: 'Sistemas que mestra' }))
      .not.toBeInTheDocument();
    expect(
      page.getByText('Nenhuma mesa aberta agora').element().classList.contains('text-muted'),
    ).toBe(true);
  });
});
