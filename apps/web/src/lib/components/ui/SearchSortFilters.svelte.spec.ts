import { page, userEvent } from 'vitest/browser';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import SearchSortFilters from './SearchSortFilters.svelte';

const props = (onapply = vi.fn()) => ({
  id: 'partner',
  query: 'dados',
  sort: 'newest' as 'newest' | 'name',
  sorts: [
    { slug: 'newest' as const, name: 'Mais novos' },
    { slug: 'name' as const, name: 'Nome' },
  ],
  fallback: 'newest' as const,
  searchLabel: 'Buscar',
  searchPlaceholder: 'Nome da loja',
  sortLabel: 'Ordenar',
  onapply,
});

describe('SearchSortFilters', () => {
  it('starts from the list’s current search', async () => {
    await render(SearchSortFilters, props());
    await expect.element(page.getByRole('searchbox', { name: 'Buscar' })).toHaveValue('dados');
    expect(document.getElementById('partner-search')).not.toBeNull();
    expect(document.getElementById('partner-sort')).not.toBeNull();
  });

  it('applies the search, trimmed, only when it is sent', async () => {
    const onapply = vi.fn();
    await render(SearchSortFilters, props(onapply));

    const search = page.getByRole('searchbox', { name: 'Buscar' });
    await search.clear();
    await search.fill('  meeple ');
    expect(onapply).not.toHaveBeenCalled();
    await userEvent.keyboard('{Enter}');
    expect(onapply).toHaveBeenCalledWith({ query: 'meeple' });
  });
});
