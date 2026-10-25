import '../../../routes/layout.css';
import { createRawSnippet } from 'svelte';
import { page } from 'vitest/browser';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import ListPanel from './ListPanel.svelte';

// The pages keep their filters in the address, so the test says where it is.
vi.mock('$app/state', () => ({
  page: {
    get url() {
      return new URL('http://localhost/admin/things?kind=big&page=2');
    },
  },
}));

const children = createRawSnippet(() => ({ render: () => '<ol><li>Primeiro</li></ol>' }));
const toolbar = createRawSnippet(() => ({ render: () => '<p>Busca</p>' }));
const base = { label: 'Itens', totalLabel: '45 itens', total: 45, page: 2, pageSize: 20, children };

describe('admin ListPanel', () => {
  it('shows the toolbar, the rows and "21–40 de N" with page links that keep the filters', async () => {
    render(ListPanel, { ...base, toolbar });

    await expect.element(page.getByRole('region', { name: 'Itens' })).toBeVisible();
    await expect.element(page.getByText('Busca')).toBeVisible();
    await expect.element(page.getByText('Primeiro')).toBeVisible();
    await expect.element(page.getByText('21–40 de 45 itens')).toBeVisible();
    await expect
      .element(page.getByRole('link', { name: 'Página anterior' }))
      .toHaveAttribute('href', '/admin/things?kind=big');
    await expect
      .element(page.getByRole('link', { name: 'Próxima página' }))
      .toHaveAttribute('href', '/admin/things?kind=big&page=3');
  });

  const emptyList = { ...base, total: 0, totalLabel: '0 itens', page: 1, empty: 'Nenhum item.' };

  it('says the list is empty instead of the rows, without "Limpar filtros" when no filter is on', async () => {
    render(ListPanel, emptyList);

    await expect.element(page.getByText('Nenhum item.')).toBeVisible();
    await expect.element(page.getByText('Primeiro')).not.toBeInTheDocument();
    await expect
      .element(page.getByRole('link', { name: 'Limpar filtros' }))
      .not.toBeInTheDocument();
    // The empty state already says so; the footer does not repeat "0 itens".
    await expect.element(page.getByText('0 itens')).not.toBeInTheDocument();
  });

  it('offers "Limpar filtros" on an empty filtered list', async () => {
    render(ListPanel, { ...emptyList, filtered: true });

    await expect
      .element(page.getByRole('link', { name: 'Limpar filtros' }))
      .toHaveAttribute('href', '/admin/things');
  });

  it('keeps the rows and the count when it has no empty state of its own (a table)', async () => {
    render(ListPanel, { ...base, total: 0, totalLabel: '0 itens', page: 1 });

    await expect.element(page.getByText('Primeiro')).toBeVisible();
    await expect.element(page.getByText('0 itens')).toBeVisible();
  });
});
