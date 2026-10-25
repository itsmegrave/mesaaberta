import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import NetworkLinksFieldHarness from './NetworkLinksFieldHarness.svelte';

const sent = () => {
  const data = new FormData(document.querySelector('form')!);
  return { networks: data.getAll('linkNetwork'), urls: data.getAll('linkUrl') };
};

describe('NetworkLinksField', () => {
  it('sends the rows as the repeated linkNetwork and linkUrl fields, in order', async () => {
    render(NetworkLinksFieldHarness, {
      networks: ['instagram', 'discord'],
      urls: ['https://instagram.com/a', 'https://discord.gg/a'],
    });

    await expect.element(page.getByLabelText('Endereço 2')).toBeVisible();
    expect(sent()).toEqual({
      networks: ['instagram', 'discord'],
      urls: ['https://instagram.com/a', 'https://discord.gg/a'],
    });
  });

  it('reads the hint with the whole list', async () => {
    render(NetworkLinksFieldHarness);

    await expect
      .element(page.getByRole('group', { name: 'Redes' }))
      .toHaveAccessibleDescription('Até três.');
  });

  it('adds a row with the address focused, and stops at the limit', async () => {
    render(NetworkLinksFieldHarness, { max: 1 });

    await page.getByRole('button', { name: 'Adicionar' }).click();
    await expect.element(page.getByLabelText('Endereço 1')).toHaveFocus();
    await expect.poll(() => sent().networks).toEqual(['instagram']);
    await expect.element(page.getByRole('button', { name: 'Adicionar' })).toBeDisabled();
  });

  it('removes a row, keeps the others, says so and keeps the focus in the list', async () => {
    render(NetworkLinksFieldHarness, {
      networks: ['instagram', 'discord'],
      urls: ['https://instagram.com/a', 'https://discord.gg/a'],
    });

    await page.getByRole('button', { name: 'Remover 1' }).click();
    await expect
      .poll(() => sent())
      .toEqual({
        networks: ['discord'],
        urls: ['https://discord.gg/a'],
      });
    await expect.element(page.getByRole('status')).toHaveTextContent('Removido.');
    await expect.element(page.getByRole('button', { name: 'Adicionar' })).toHaveFocus();
  });

  it('offers the up and down buttons only when the list can be reordered', async () => {
    render(NetworkLinksFieldHarness, {
      networks: ['instagram', 'discord'],
      urls: ['a', 'b'],
      reorder: true,
    });

    await page.getByRole('button', { name: 'Descer 1' }).click();
    await expect.poll(() => sent().urls).toEqual(['b', 'a']);
    await expect.element(page.getByRole('status')).toHaveTextContent('1 para 2.');
  });

  it('has no up and down buttons otherwise', async () => {
    render(NetworkLinksFieldHarness, { networks: ['instagram'], urls: ['a'] });

    await expect.element(page.getByRole('button', { name: 'Remover 1' })).toBeVisible();
    await expect.element(page.getByRole('button', { name: 'Subir 1' })).not.toBeInTheDocument();
  });

  it('flags the row with the bad address and says the list problem', async () => {
    render(NetworkLinksFieldHarness, {
      networks: ['instagram', 'discord'],
      urls: ['ok', 'javascript:alert(1)'],
      errors: { list: 'O mesmo link duas vezes.', rows: [{}, { url: 'Endereço inválido.' }] },
    });

    const bad = page.getByLabelText('Endereço 2');
    await expect.element(bad).toHaveAttribute('aria-invalid', 'true');
    await expect.element(bad).toHaveAccessibleDescription('Endereço inválido.');
    await expect.element(page.getByLabelText('Endereço 1')).not.toHaveAttribute('aria-invalid');
    await expect.element(page.getByText('O mesmo link duas vezes.')).toBeVisible();
  });

  it('suggests the address by network', async () => {
    render(NetworkLinksFieldHarness, { networks: ['discord'], urls: [''] });

    await expect
      .element(page.getByLabelText('Endereço 1'))
      .toHaveAttribute('placeholder', 'https://discord.gg/…');
  });
});
