import '../../layout.css';
import { page } from 'vitest/browser';
import { beforeEach, describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import Page from './+page.svelte';

const entry = (over = {}) => ({
  kind: 'platform' as const,
  id: '00000000-0000-4000-8000-000000000001',
  name: 'Foundry',
  slug: 'foundry',
  suggestedBy: 'bruno',
  createdAt: new Date('2026-09-28T15:00:00Z'),
  tables: [{ title: 'A Cripta', slug: 'a-cripta' }],
  duplicateOf: null,
  ...over,
});
const approved = {
  platform: [
    { id: '00000000-0000-4000-8000-000000000050', name: 'Foundry VTT' },
    { id: '00000000-0000-4000-8000-000000000051', name: 'Discord' },
  ],
  tag: [],
};
const show = (data: { queue?: unknown[]; decisions?: unknown[] }) =>
  render(Page, { data: { queue: [], decisions: [], approved, ...data } as never });

describe('admin approval queue', () => {
  beforeEach(async () => {
    await page.viewport(1280, 900);
  });

  it('says so when nothing is waiting', async () => {
    show({});
    await expect.element(page.getByText('Nenhuma sugestão esperando por você.')).toBeVisible();
    await expect.element(page.getByText('Nenhuma decisão ainda.')).toBeVisible();
  });

  it('shows who suggested it, on which tables, and the three actions', async () => {
    show({ queue: [entry()] });

    await expect.element(page.getByRole('heading', { name: 'Foundry' })).toBeVisible();
    await expect.element(page.getByText(/Sugerida por @bruno/)).toBeVisible();
    await expect.element(page.getByRole('link', { name: 'A Cripta' })).toBeVisible();
    await expect.element(page.getByRole('button', { name: /Aprovar/ })).toBeVisible();
    await expect.element(page.getByRole('button', { name: 'Renomear: Foundry' })).toBeVisible();
    await expect.element(page.getByRole('button', { name: 'Recusar: Foundry' })).toBeVisible();
  });

  it('warns about a near-duplicate and makes merging the main action', async () => {
    show({ queue: [entry({ duplicateOf: approved.platform[0] })] });

    await expect
      .element(page.getByText('Parece com “Foundry VTT”, que já está no catálogo.'))
      .toBeVisible();
    await expect
      .element(page.getByRole('button', { name: 'Mesclar com Foundry VTT' }))
      .toBeVisible();
  });

  it('asks before rejecting, saying what happens to the tables', async () => {
    show({ queue: [entry()] });

    await page.getByRole('button', { name: 'Recusar: Foundry' }).click();

    await expect.element(page.getByText('Recusar “Foundry”?')).toBeVisible();
    await expect
      .element(page.getByText(/As mesas que usam “Foundry” perdem esta entrada/))
      .toBeVisible();
  });

  it('renames through a dialog whose field is checked by the same schema', async () => {
    show({ queue: [entry()] });

    await page.getByRole('button', { name: 'Renomear: Foundry' }).click();
    const field = page.getByLabelText('Novo nome');
    await expect.element(field).toHaveValue('Foundry');
    await field.fill('Foundry VTT 13');
    await expect.element(page.getByText(/Endereço: foundry-vtt-13/)).toBeVisible();

    await field.fill('a');
    await page.getByRole('button', { name: 'Salvar nome' }).click();
    await expect.element(page.getByText('Use de 2 a 40 caracteres.')).toBeVisible();
  });

  it('merges into an entry picked from the approved ones, starting on the near-duplicate', async () => {
    show({ queue: [entry({ duplicateOf: approved.platform[0] })] });

    await page.getByRole('button', { name: 'Mesclar com Foundry VTT' }).click();

    const select = page.getByLabelText('Mesclar com');
    await expect.element(select).toHaveValue(approved.platform[0].id);
    await expect.element(page.getByRole('option', { name: 'Discord' })).toBeInTheDocument();
  });

  it('lists the recent decisions from the log', async () => {
    show({
      decisions: [
        {
          id: 'e1',
          type: 'CatalogEntryMerged',
          kind: 'tag',
          name: 'Terror',
          into: 'Horror',
          from: null,
          by: 'ana',
          at: new Date('2026-09-29T12:00:00Z'),
        },
      ],
    });

    await expect.element(page.getByText('Mesclagem de Terror em Horror (tag)')).toBeVisible();
    await expect.element(page.getByText(/por @ana/)).toBeVisible();
  });
});
