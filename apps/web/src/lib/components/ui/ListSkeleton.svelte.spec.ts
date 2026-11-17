import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import ListSkeleton from './ListSkeleton.svelte';

const region = () => page.getByRole('status');
const shapes = () => region().element().querySelectorAll('[data-skeleton-item]');

describe('ListSkeleton', () => {
  it('is one busy region that says it is loading, its shapes hidden from screen readers', async () => {
    render(ListSkeleton, { kind: 'rows' });

    await expect.element(region()).toHaveAttribute('aria-busy', 'true');
    await expect.element(region()).toHaveTextContent('Carregando…');
    for (const shape of shapes()) expect(shape.closest('[aria-hidden="true"]')).not.toBeNull();
  });

  it('draws table cards for the table lists', async () => {
    render(ListSkeleton, { kind: 'cards' });
    expect(shapes()).toHaveLength(6);
  });

  it('draws two columns of cards for the dashboard', async () => {
    render(ListSkeleton, { kind: 'columns' });
    expect(shapes()).toHaveLength(4);
  });

  it('draws notification rows', async () => {
    render(ListSkeleton, { kind: 'rows' });
    expect(shapes()).toHaveLength(5);
  });

  it('draws an item page: the cover and the side panel', async () => {
    render(ListSkeleton, { kind: 'detail' });
    expect(shapes()).toHaveLength(2);
    expect(region().element().querySelector('.aspect-5\\/2')).not.toBeNull();
  });

  it('draws a profile: the 4:1 cover and three stat tiles', async () => {
    render(ListSkeleton, { kind: 'profile' });
    expect(shapes()).toHaveLength(4);
    expect(region().element().querySelector('.aspect-4\\/1')).not.toBeNull();
  });

  it('draws the signed-in Início: four folding cards and a row of cards', async () => {
    render(ListSkeleton, { kind: 'home' });
    expect(shapes()).toHaveLength(7);
  });

  it('draws an Admin section as a table of rows, beside the real nav', async () => {
    render(ListSkeleton, { kind: 'admin' });
    expect(shapes()).toHaveLength(8);
    expect(region().element().querySelector('[data-skeleton-nav]')).toBeNull();
  });

  it('holds the place of the Admin nav when arriving from outside Admin', async () => {
    render(ListSkeleton, { kind: 'admin', nav: true });
    expect(region().element().querySelector('[data-skeleton-nav]')).not.toBeNull();
  });

  it('draws no extra title over an item page, which has its own', async () => {
    render(ListSkeleton, { kind: 'detail', heading: true });
    expect(region().element().querySelector('[data-skeleton-heading]')).toBeNull();
  });

  it('draws a title placeholder only when asked (a whole page loading, not a filter)', async () => {
    render(ListSkeleton, { kind: 'rows', heading: true });
    expect(region().element().querySelector('[data-skeleton-heading]')).not.toBeNull();
  });
});
