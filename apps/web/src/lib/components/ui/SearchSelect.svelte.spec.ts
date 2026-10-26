import '../../../routes/layout.css';
import { render } from 'vitest-browser-svelte';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import SearchSelect from './SearchSelect.svelte';

const items = [
  { name: 'Daggerheart', slug: 'daggerheart' },
  { name: 'Savage Worlds', slug: 'savage-worlds' },
  { name: 'Ordem Paranormal', slug: 'ordem-paranormal' },
  { name: 'Lobisomem: O Apocalipse', slug: 'lobisomem' },
];
// Four options: a search box only where a spec asks for one.
const base = { id: 'system', name: 'system', label: 'Sistema', items, placeholder: 'Buscar' };
const searching = { ...base, search: true };

const input = () => page.getByRole('combobox', { name: 'Sistema' });
const options = () => page.getByRole('option');
const hiddenValues = () =>
  [...document.querySelectorAll<HTMLInputElement>('input[type="hidden"][name="system"]')].map(
    (field) => field.value,
  );

describe('SearchSelect.svelte on a wide screen, with a search', () => {
  beforeEach(async () => {
    await page.viewport(1280, 900);
  });

  it('draws one box: the input and the trigger add no border, fill or offset of their own', async () => {
    render(SearchSelect, searching);

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
    expect(box.getBoundingClientRect().height).toBe(44);
    expect(button.getBoundingClientRect().height).toBe(box.clientHeight);
  });

  it('narrows the list to what was typed, ignoring case and accents', async () => {
    render(SearchSelect, searching);

    await input().fill('ÓRDEM');

    await expect.element(options()).toHaveLength(1);
    await expect.element(page.getByRole('option', { name: 'Ordem Paranormal' })).toBeVisible();
  });

  it('says so when nothing matches', async () => {
    render(SearchSelect, searching);

    await input().fill('gurps');

    await expect.element(page.getByText('Nada encontrado com esse nome.')).toBeVisible();
  });

  it('takes several picks, each a hidden input and a removable chip', async () => {
    const onchange = vi.fn();
    render(SearchSelect, { ...searching, multiple: true, onchange });

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
    render(SearchSelect, { ...searching, value: ['savage-worlds'] });

    await expect.element(input()).toHaveValue('Savage Worlds');
    expect(hiddenValues()).toEqual(['savage-worlds']);
  });

  describe('with suggestions', () => {
    const suggesting = {
      ...searching,
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
      render(SearchSelect, { ...searching, multiple: true });

      await input().fill('Tormenta');

      await expect.element(page.getByText('Nada encontrado com esse nome.')).toBeVisible();
    });
  });
});

describe('SearchSelect.svelte on a wide screen, a short list', () => {
  beforeEach(async () => {
    await page.viewport(1280, 900);
  });

  const field = () => page.getByRole('button', { name: /^Sistema/ });

  it('is a button over a list with no search, opened and picked from the keyboard', async () => {
    const onchange = vi.fn();
    render(SearchSelect, { ...base, onchange });

    await expect.element(page.getByRole('combobox')).not.toBeInTheDocument();
    (await field().element()).focus();
    await userEvent.keyboard('{ArrowDown}');
    await expect.element(page.getByRole('listbox', { name: 'Sistema' })).toBeVisible();

    // Letters jump to the next option that starts with them.
    await userEvent.keyboard('o');
    await userEvent.keyboard('{Enter}');

    await vi.waitFor(() => expect(hiddenValues()).toEqual(['ordem-paranormal']));
    expect(onchange).toHaveBeenLastCalledWith(['ordem-paranormal']);
    await expect.element(page.getByRole('listbox')).not.toBeInTheDocument();
    await expect.element(field()).toHaveAccessibleName('Sistema Ordem Paranormal');

    // Closed for good: the next click opens it again.
    await field().click();
    await expect.element(page.getByRole('listbox')).toBeVisible();
  });

  it('closes on Escape without changing the pick, back on the field', async () => {
    render(SearchSelect, { ...base, value: ['daggerheart'] });

    await field().click();
    await expect.element(page.getByRole('listbox')).toBeVisible();
    await userEvent.keyboard('{ArrowDown}');
    await userEvent.keyboard('{Escape}');

    await expect.element(page.getByRole('listbox')).not.toBeInTheDocument();
    expect(hiddenValues()).toEqual(['daggerheart']);
    await vi.waitFor(() => expect(document.activeElement).toBe(field().element()));
  });

  it('closes when the option already picked is picked again, with Enter, Space or a click', async () => {
    const onchange = vi.fn();
    render(SearchSelect, { ...base, value: ['daggerheart'], onchange });

    for (const key of ['{Enter}', ' ']) {
      await field().click();
      await expect.element(page.getByRole('listbox')).toBeVisible();
      await userEvent.keyboard(key);
      await expect.element(page.getByRole('listbox')).not.toBeInTheDocument();
    }
    await field().click();
    await page.getByRole('option', { name: 'Daggerheart' }).click();
    await expect.element(page.getByRole('listbox')).not.toBeInTheDocument();
    expect(hiddenValues()).toEqual(['daggerheart']);
    expect(onchange).not.toHaveBeenCalled();
  });
});

describe('SearchSelect.svelte on a phone', () => {
  beforeEach(async () => {
    await page.viewport(390, 844);
  });

  const field = () => page.getByRole('button', { name: /^Sistema/ });
  const sheet = () => page.getByRole('dialog', { name: 'Sistema' });

  it('opens a sheet from a button, so the keyboard does not come up, and closes on a pick', async () => {
    const onchange = vi.fn();
    render(SearchSelect, { ...searching, onchange });

    await expect.element(page.getByRole('combobox')).not.toBeInTheDocument();
    await field().click();
    await expect.element(sheet()).toBeVisible();

    // The search is there, but nothing is typed into it until it is tapped.
    const search = page.getByRole('searchbox', { name: 'Buscar: Sistema' });
    await expect.element(search).toBeVisible();
    expect(document.activeElement).not.toBe(search.element());

    await page.getByRole('option', { name: 'Savage Worlds' }).click();

    await expect.element(sheet()).not.toBeInTheDocument();
    await vi.waitFor(() => expect(hiddenValues()).toEqual(['savage-worlds']));
    expect(onchange).toHaveBeenLastCalledWith(['savage-worlds']);
    await expect.element(field()).toHaveAccessibleName('Sistema Savage Worlds');
  });

  it('narrows the list as the search is typed into', async () => {
    render(SearchSelect, searching);

    await field().click();
    await page.getByRole('searchbox', { name: 'Buscar: Sistema' }).fill('ÓRDEM');

    await expect.element(page.getByRole('option')).toHaveLength(1);
    await page.getByRole('searchbox', { name: 'Buscar: Sistema' }).fill('gurps');
    await expect.element(sheet().getByText('Nada encontrado com esse nome.').first()).toBeVisible();
  });

  it('closes when the option already picked is tapped again, keeping it', async () => {
    render(SearchSelect, { ...base, value: ['daggerheart'] });

    await field().click();
    await page.getByRole('option', { name: 'Daggerheart' }).click();

    await expect.element(sheet()).not.toBeInTheDocument();
    expect(hiddenValues()).toEqual(['daggerheart']);
  });

  it('has no search box for a short list', async () => {
    render(SearchSelect, base);

    await field().click();
    await expect.element(sheet()).toBeVisible();
    await expect.element(page.getByRole('combobox')).not.toBeInTheDocument();
    await expect.element(page.getByRole('option')).toHaveLength(4);
  });

  it('takes several picks, lists them first, and closes on "Pronto"', async () => {
    const onchange = vi.fn();
    render(SearchSelect, { ...base, multiple: true, value: ['lobisomem'], onchange });

    await field().click();
    await expect.element(page.getByText('Sua escolha')).toBeVisible();
    await expect
      .element(page.getByRole('option').first())
      .toHaveAccessibleName('Lobisomem: O Apocalipse');

    await page.getByRole('option', { name: 'Daggerheart' }).click();
    await vi.waitFor(() => expect(hiddenValues()).toEqual(['lobisomem', 'daggerheart']));
    expect(onchange).toHaveBeenLastCalledWith(['lobisomem', 'daggerheart']);
    await expect.element(sheet()).toBeVisible();

    await page.getByRole('button', { name: 'Pronto (2)' }).click();
    await expect.element(sheet()).not.toBeInTheDocument();
    await expect.element(page.getByRole('button', { name: 'Remover Daggerheart' })).toBeVisible();
  });

  it('suggests what was typed when the list does not have it', async () => {
    render(SearchSelect, {
      ...base,
      multiple: true,
      suggestLabel: (name: string) => `Sugerir “${name}”`,
      pendingLabel: 'em análise',
    });

    await field().click();
    await page.getByRole('searchbox', { name: 'Buscar: Sistema' }).fill('Tormenta 20');
    await page.getByRole('option', { name: 'Sugerir “Tormenta 20”' }).click();

    await vi.waitFor(() => expect(hiddenValues()).toEqual(['new:Tormenta 20']));
  });
});
