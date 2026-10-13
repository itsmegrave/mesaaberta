import '../../routes/layout.css';
import { render } from 'vitest-browser-svelte';
import { describe, expect, it, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import SearchSelect from './SearchSelect.svelte';

const items = [
  { name: 'Daggerheart', slug: 'daggerheart' },
  { name: 'Savage Worlds', slug: 'savage-worlds' },
  { name: 'Ordem Paranormal', slug: 'ordem-paranormal' },
  { name: 'Lobisomem: O Apocalipse', slug: 'lobisomem' },
];
const base = { id: 'system', name: 'system', label: 'Sistema', items, placeholder: 'Buscar' };

const input = () => page.getByRole('combobox', { name: 'Sistema' });
const options = () => page.getByRole('option');
const hiddenValues = () =>
  [...document.querySelectorAll<HTMLInputElement>('input[type="hidden"][name="system"]')].map(
    (field) => field.value,
  );

describe('SearchSelect.svelte', () => {
  it('draws one box: the input and the trigger add no border, fill or offset of their own', async () => {
    render(SearchSelect, base);

    const field = (await input().element()) as HTMLInputElement;
    const button = (await page
      .getByRole('button', { name: /Sistema/ })
      .element()) as HTMLButtonElement;
    const box = field.closest('[data-part="control"]') as HTMLElement;

    expect(getComputedStyle(field).borderTopWidth).toBe('0px');
    expect(getComputedStyle(field).backgroundColor).toBe('rgba(0, 0, 0, 0)');
    expect(getComputedStyle(button).position).toBe('static');
    expect(getComputedStyle(button).backgroundColor).toBe('rgba(0, 0, 0, 0)');
    expect(getComputedStyle(button).transform).toBe('none');
    expect(box.getBoundingClientRect().height).toBe(48);
    expect(button.getBoundingClientRect().height).toBe(box.clientHeight);
  });

  it('narrows the list to what was typed, ignoring case and accents', async () => {
    render(SearchSelect, base);

    await input().fill('ÓRDEM');

    await expect.element(options()).toHaveLength(1);
    await expect.element(page.getByRole('option', { name: 'Ordem Paranormal' })).toBeVisible();
  });

  it('says so when nothing matches', async () => {
    render(SearchSelect, base);

    await input().fill('gurps');

    await expect.element(page.getByText('Nada encontrado com esse nome.')).toBeVisible();
  });

  it('takes several picks, each a hidden input and a removable chip', async () => {
    const onchange = vi.fn();
    render(SearchSelect, { ...base, multiple: true, onchange });

    await input().fill('dagger');
    await page.getByRole('option', { name: 'Daggerheart' }).click();
    await input().fill('savage');
    await page.getByRole('option', { name: 'Savage Worlds' }).click();

    await vi.waitFor(() => expect(hiddenValues()).toEqual(['daggerheart', 'savage-worlds']));
    expect(onchange).toHaveBeenLastCalledWith(['daggerheart', 'savage-worlds']);

    // The list stays open for another pick until Escape.
    await userEvent.keyboard('{Escape}');
    await page.getByRole('button', { name: 'Remover Daggerheart' }).click();

    await vi.waitFor(() => expect(hiddenValues()).toEqual(['savage-worlds']));
    expect(onchange).toHaveBeenLastCalledWith(['savage-worlds']);
  });

  it('shows the one picked by name, and submits its slug', async () => {
    render(SearchSelect, { ...base, value: ['savage-worlds'] });

    await expect.element(input()).toHaveValue('Savage Worlds');
    expect(hiddenValues()).toEqual(['savage-worlds']);
  });

  describe('with suggestions', () => {
    const suggesting = {
      ...base,
      items: [...items, { name: 'Mesa de Bar', slug: 'mesa-de-bar', pending: true as const }],
      multiple: true,
      suggestLabel: (name: string) => `Sugerir “${name}”`,
      pendingLabel: 'em análise',
    };

    it('offers to suggest what was typed when the list does not have it', async () => {
      render(SearchSelect, suggesting);

      await input().fill('  Tormenta  20 ');
      await page.getByRole('option', { name: 'Sugerir “Tormenta 20”' }).click();

      await vi.waitFor(() => expect(hiddenValues()).toEqual(['new:Tormenta 20']));
      await userEvent.keyboard('{Escape}');
      await expect
        .element(page.getByRole('button', { name: 'Remover Tormenta 20 (em análise)' }))
        .toBeVisible();
    });

    it('does not offer to suggest a name the list already has', async () => {
      render(SearchSelect, suggesting);

      await input().fill('savage worlds');

      await expect.element(options()).toHaveLength(1);
      await expect.element(page.getByRole('option', { name: 'Savage Worlds' })).toBeVisible();
    });

    it('marks a pending entry in the list and on its chip', async () => {
      render(SearchSelect, { ...suggesting, value: ['mesa-de-bar'] });

      await expect
        .element(page.getByRole('button', { name: 'Remover Mesa de Bar (em análise)' }))
        .toBeVisible();
      await input().fill('bar');
      await expect
        .element(page.getByRole('option', { name: /^Mesa de Bar\s*em análise$/ }))
        .toBeVisible();
    });

    it('offers nothing to suggest without the label for it', async () => {
      render(SearchSelect, { ...base, multiple: true });

      await input().fill('Tormenta');

      await expect.element(page.getByText('Nada encontrado com esse nome.')).toBeVisible();
    });
  });
});
