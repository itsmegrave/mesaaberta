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

  it('draws a title placeholder only when asked (a whole page loading, not a filter)', async () => {
    render(ListSkeleton, { kind: 'rows', heading: true });
    expect(region().element().querySelector('[data-skeleton-heading]')).not.toBeNull();
  });
});
