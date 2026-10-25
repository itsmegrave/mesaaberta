import '../../../routes/layout.css';
import { page } from 'vitest/browser';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import Harness from './DataTableHarness.svelte';

// The lists keep their filters in the address, so the test says where it is.
const location = vi.hoisted(() => ({ search: '' }));
vi.mock('$app/state', () => ({
  navigating: { to: null },
  page: {
    get url() {
      return new URL(`http://localhost/admin/things${location.search}`);
    },
  },
}));
const goto = vi.hoisted(() => vi.fn());
vi.mock('$app/navigation', async () =>
  (await import('#lib/test/navigation-mock.js')).navigationMock({ goto }),
);

const rows = [
  { id: '1', name: 'Primeiro' },
  { id: '2', name: 'Segundo' },
];

describe('admin DataTable', () => {
  beforeEach(async () => {
    location.search = '';
    goto.mockClear();
    await page.viewport(1280, 900);
  });

  it('is a table with its header, the rows and "1–20 de N" in the footer', async () => {
    render(Harness, { rows, total: 45 });

    await expect.element(page.getByRole('table', { name: 'Itens' })).toBeVisible();
    await expect.element(page.getByRole('columnheader', { name: 'Nome' })).toBeVisible();
    await expect.element(page.getByRole('cell', { name: 'Primeiro' })).toBeVisible();
    await expect.element(page.getByText('1–20 de 45 itens')).toBeVisible();
  });

  it('truncates a long name instead of widening the table and scrolling the card sideways', async () => {
    render(Harness, { rows: [{ id: '1', name: 'Descrição muito longa '.repeat(30) }] });

    const table = page.getByRole('table', { name: 'Itens' }).element();
    const card = table.parentElement as HTMLElement;

    expect(card.scrollWidth).toBeLessThanOrEqual(card.clientWidth);
    await expect.element(page.getByRole('columnheader', { name: 'Ações' })).toBeInTheDocument();
  });

  it('marks the sorted column and turns the order when its header is pressed', async () => {
    location.search = '?sort=name&dir=asc';
    render(Harness, { rows, sort: { id: 'name', dir: 'asc' } });

    await expect
      .element(page.getByRole('columnheader', { name: 'Nome' }))
      .toHaveAttribute('aria-sort', 'ascending');
    await page.getByRole('button', { name: 'Nome' }).click();

    expect(goto).toHaveBeenCalledWith('/admin/things?sort=name&dir=desc', expect.anything());
  });

  it('links the pages, the first without a parameter', async () => {
    location.search = '?page=2';
    render(Harness, { rows, total: 45, page: 2 });

    await expect
      .element(page.getByRole('link', { name: 'Página anterior' }))
      .toHaveAttribute('href', '/admin/things');
    await expect
      .element(page.getByRole('link', { name: 'Próxima página' }))
      .toHaveAttribute('href', '/admin/things?page=3');
  });

  it('says so when the list is empty and offers "Limpar filtros" when a filter is on', async () => {
    location.search = '?q=zzz';
    render(Harness, { rows: [], filtered: true });

    await expect.element(page.getByText('Nenhum item.').first()).toBeVisible();
    await expect
      .element(page.getByRole('link', { name: 'Limpar filtros' }).first())
      .toHaveAttribute('href', '/admin/things');
  });

  it('applies a segment at once, keeping the other filters', async () => {
    location.search = '?q=abc';
    render(Harness, { rows });

    // The radio is visually hidden; its label is what a person presses.
    await expect.element(page.getByRole('radiogroup', { name: 'Status' }).first()).toBeVisible();
    const radio = [...document.querySelectorAll<HTMLInputElement>('input[type="radio"]')].find(
      (input) => input.value === 'on',
    );
    expect(radio).not.toBeNull();
    radio!.click();
    await vi.waitFor(() => expect(goto).toHaveBeenCalled());

    expect(goto).toHaveBeenCalledWith('/admin/things?q=abc&status=on', expect.anything());
  });

  it('is a list of cards, with "Mostrar mais", on a phone', async () => {
    await page.viewport(390, 800);
    location.search = '';
    render(Harness, { rows, total: 45 });

    await expect.element(page.getByRole('table')).not.toBeInTheDocument();
    await expect.element(page.getByRole('listitem').first()).toBeVisible();
    // The segmented filter sits under the search; a person presses its label.
    await expect.element(page.getByRole('radiogroup', { name: 'Status' })).toBeVisible();
    const labels = [...document.querySelectorAll('label')].filter((label) =>
      label.textContent?.trim().startsWith('Ligados'),
    );
    expect(labels.map((label) => label.getBoundingClientRect().width > 0)).toEqual([false, true]);
    await expect
      .element(page.getByRole('link', { name: /Mostrar mais/ }))
      .toHaveAttribute('href', '/admin/things?size=50');
  });
  it('adds the row menu as the last, unnamed column, and a spinner while the row is busy', async () => {
    render(Harness, { rows, withMenu: true, busyRow: '2' });

    await expect.element(page.getByRole('columnheader', { name: 'Ações' })).toBeInTheDocument();
    await expect
      .element(page.getByRole('button', { name: /Ações de Primeiro/ }).first())
      .toBeVisible();
    // The busy row has no menu to open while its action runs.
    await expect
      .element(page.getByRole('button', { name: /Ações de Segundo/ }))
      .not.toBeInTheDocument();
  });

  it('puts the row menu at the end of each card on a phone', async () => {
    await page.viewport(390, 800);
    render(Harness, { rows, withMenu: true });

    const card = page.getByRole('listitem').first();
    await expect.element(card.getByRole('button', { name: /Ações de Primeiro/ })).toBeVisible();
  });

  it('draws one filter snippet in the toolbar on a desktop and in the "Filtros" sheet on a phone', async () => {
    render(Harness, { rows, withSelect: true, sheet: true });
    expect(document.getElementById('kind-filter')).not.toBeNull();

    await page.viewport(390, 800);
    // On a phone the segments leave the page for the sheet.
    await expect.element(page.getByRole('radiogroup', { name: 'Status' })).not.toBeInTheDocument();
    await page.getByRole('button', { name: /Filtros/ }).click();

    const sheet = page.getByRole('dialog');
    await expect.element(sheet.getByRole('radiogroup', { name: 'Status' })).toBeVisible();
    expect(document.getElementById('kind-filter-sheet')).not.toBeNull();
  });
});
