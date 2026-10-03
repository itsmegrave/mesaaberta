import '../../layout.css';
import { page } from 'vitest/browser';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import Page from './+page.svelte';

// There is no SvelteKit app around a component test, so the step that hands a result to the router
// has nothing to talk to. What the form shows is the same either way.
vi.mock('$app/forms', async (original) => ({
  ...(await original<typeof import('$app/forms')>()),
  applyAction: vi.fn(),
}));

const row = (over = {}) => ({
  id: '00000000-0000-4000-8000-000000000050',
  name: 'Foundry VTT',
  slug: 'foundry-vtt',
  status: 'approved' as const,
  suggestedBy: null,
  uses: 12,
  ...over,
});
const show = (over = {}) =>
  render(Page, {
    data: {
      kind: 'platform',
      query: '',
      rows: [
        row(),
        row({ id: '2', name: 'Roll20', slug: 'roll20', suggestedBy: 'bruno', uses: 0 }),
      ],
      total: 2,
      page: 1,
      pages: 1,
      approved: [{ id: '2', name: 'Roll20' }],
      ...over,
    } as never,
  });

describe('admin catalog', () => {
  beforeEach(async () => {
    await page.viewport(1280, 900);
  });

  it('lists the entries with their origin and how many tables use them', async () => {
    show();

    await expect.element(page.getByRole('rowheader', { name: /Foundry VTT/ })).toBeVisible();
    await expect.element(page.getByText('Sugerida por @bruno')).toBeVisible();
    await expect.element(page.getByText('Criada por admin')).toBeVisible();
    await expect.element(page.getByText('12', { exact: true })).toBeVisible();
  });

  it('switches between platforms and tags with links, marking the current one', async () => {
    show({ kind: 'tag' });

    await expect
      .element(page.getByRole('link', { name: 'Tags' }))
      .toHaveAttribute('aria-current', 'page');
    await expect
      .element(page.getByRole('link', { name: 'Plataformas' }))
      .not.toHaveAttribute('aria-current');
    await expect.element(page.getByRole('button', { name: 'Nova tag' })).toBeVisible();
  });

  it('offers a new entry through a dialog', async () => {
    show();

    await page.getByRole('button', { name: 'Nova plataforma' }).click();

    await expect.element(page.getByLabelText('Nome', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Adicionar' }).click();
    await expect.element(page.getByText('Use de 2 a 40 caracteres.')).toBeVisible();
  });

  it('keeps a draft during a same-kind reload and replaces defaults when the catalog kind changes', async () => {
    const screen = await show();
    await page.getByRole('button', { name: 'Nova plataforma' }).click();
    await page.getByLabelText('Nome', { exact: true }).fill('Draft');
    const updated = {
      kind: 'platform',
      query: '',
      rows: [],
      total: 0,
      page: 1,
      pages: 1,
      approved: [],
    };
    await screen.rerender({ data: updated as never });
    await expect.element(page.getByLabelText('Nome', { exact: true })).toHaveValue('Draft');
    await screen.rerender({ data: { ...updated, kind: 'tag' } as never });
    await page.getByRole('button', { name: 'Nova tag' }).click();
    await expect
      .element(page.getByRole('dialog').getByText('Nova tag', { exact: true }))
      .toBeVisible();
    await expect.element(page.getByLabelText('Nome', { exact: true })).toHaveValue('');
  });

  it('renames from the row, with the current name filled in', async () => {
    show();

    await page.getByRole('button', { name: 'Mais ações: Foundry VTT' }).click();
    await page.getByRole('menuitem', { name: 'Renomear', exact: true }).click();

    await expect.element(page.getByLabelText('Novo nome')).toHaveValue('Foundry VTT');
  });

  it('keeps Mesclar and Desativar in the row menu, and Desativar asks first', async () => {
    show();

    await page.getByRole('button', { name: 'Mais ações: Foundry VTT' }).click();
    await expect
      .element(page.getByRole('menuitem', { name: 'Mesclar em outra entrada…', exact: true }))
      .toBeVisible();
    await page.getByRole('menuitem', { name: 'Desativar…', exact: true }).click();

    await expect.element(page.getByText('Desativar “Foundry VTT”?')).toBeVisible();
    await expect
      .element(page.getByText(/As mesas que já têm esta entrada continuam com ela/))
      .toBeVisible();
  });

  it('links the neighbouring pages with ?page=N, the first without a parameter', async () => {
    show({ page: 2, pages: 3, query: 'ro' });

    await expect.element(page.getByText('Página 2 de 3')).toBeVisible();
    await expect
      .element(page.getByRole('link', { name: 'Página anterior' }))
      .toHaveAttribute('href', '/admin/catalog?kind=platform&q=ro');
    await expect
      .element(page.getByRole('link', { name: 'Próxima página' }))
      .toHaveAttribute('href', '/admin/catalog?kind=platform&q=ro&page=3');
  });

  it('says so when the search finds nothing', async () => {
    show({ rows: [], total: 0, query: 'zzz' });
    await expect.element(page.getByText('Nenhuma entrada encontrada.')).toBeVisible();
  });
});
