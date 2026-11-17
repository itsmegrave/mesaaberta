import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import PlaceCard from './PlaceCard.svelte';

const place = (values = {}) => ({
  slug: 'taverna-do-dado',
  name: 'Taverna do Dado',
  kind: 'game_cafe' as const,
  neighbourhood: 'Boa Viagem' as string | null,
  city: 'Recife',
  state: 'PE',
  description: 'Mesas toda sexta' as string | null,
  features: [
    { name: 'Acessível', slug: 'accessible' },
    { name: 'RPG de mesa', slug: 'rpg' },
    { name: 'Torneios', slug: 'tournaments' },
  ],
  imageUrl: null,
  openTables: 2,
  ...values,
});

describe('PlaceCard', () => {
  it('is one link to the page, with the kind, area, two of its tags and the open tables', async () => {
    await render(PlaceCard, { place: place() });
    const link = page.getByRole('link', { name: 'Taverna do Dado' });
    await expect.element(link).toHaveAttribute('href', '/pp/taverna-do-dado');
    expect(page.getByRole('link').all()).toHaveLength(1);
    await expect.element(page.getByText('Luderia')).toBeVisible();
    await expect.element(page.getByText('Boa Viagem, Recife · PE')).toBeVisible();
    expect(page.getByRole('listitem').all()).toHaveLength(2);
    await expect.element(page.getByText('RPG de mesa')).toBeVisible();
    await expect.element(page.getByText('2 mesas abertas')).toBeVisible();
  });

  it('says the city alone when the CEP has no neighbourhood, and when no table is open', async () => {
    await render(PlaceCard, {
      place: place({ neighbourhood: null, openTables: 0, features: [], description: null }),
    });
    await expect.element(page.getByText('Recife · PE')).toBeVisible();
    expect(page.getByRole('list').all()).toHaveLength(0);
    await expect.element(page.getByText('2 mesas abertas')).not.toBeInTheDocument();
  });
});
