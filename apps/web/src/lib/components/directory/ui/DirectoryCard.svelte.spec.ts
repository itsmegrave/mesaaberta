import { createRawSnippet } from 'svelte';
import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import AvatarStack from './AvatarStack.svelte';
import DirectoryCard from './DirectoryCard.svelte';

const mark = createRawSnippet(() => ({ render: () => '<span>TT</span>' }));
const card = (active: boolean) => ({
  href: '/s/tormenta-20',
  name: 'Tormenta 20',
  facts: '9 mesas na Mesa Aberta · 2 pessoas mestram',
  status: active ? '3 mesas abertas' : 'Nenhuma mesa aberta agora',
  active,
  mark,
});

describe('DirectoryCard', () => {
  it('is one link, named by the entry, to its page', async () => {
    await render(DirectoryCard, card(true));
    const link = page.getByRole('link', { name: 'Tormenta 20' });
    await expect.element(link).toHaveAttribute('href', '/s/tormenta-20');
    expect(page.getByRole('link').all()).toHaveLength(1);
    await expect.element(page.getByRole('heading', { level: 3 })).toHaveTextContent('Tormenta 20');
  });

  it('draws what is open now in the lamp colour and nothing open in muted text', async () => {
    await render(DirectoryCard, card(true));
    expect(page.getByText('3 mesas abertas').element().classList.contains('text-lamp')).toBe(true);
    await render(DirectoryCard, card(false));
    expect(
      page.getByText('Nenhuma mesa aberta agora').element().classList.contains('text-muted'),
    ).toBe(true);
  });
});

describe('AvatarStack', () => {
  const people = [
    { username: 'ana', avatarUrl: null },
    { username: 'bia', avatarUrl: null },
  ];

  it('says how many more people there are than the pictures shown', async () => {
    await render(AvatarStack, { people, total: 12, label: 'Quem mestra' });
    await expect.element(page.getByText('+10')).toBeInTheDocument();
    await expect.element(page.getByText('Quem mestra')).toBeInTheDocument();
  });

  it('draws nothing when nobody runs it yet', async () => {
    const { container } = await render(AvatarStack, { people: [], total: 0, label: 'Quem mestra' });
    expect(container.textContent?.trim()).toBe('');
  });
});
