import { page } from 'vitest/browser';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { goto } from '$app/navigation';
import TablesFilters from './TablesFilters.svelte';

vi.mock('$app/navigation', () => ({ goto: vi.fn() }));

const catalog = {
  platforms: [
    { name: 'Discord', slug: 'discord' },
    { name: 'Roll20', slug: 'roll20' },
  ],
  tags: [{ name: 'Terror', slug: 'terror' }],
  moreTags: [{ name: 'Gore', slug: 'gore' }],
};
const none = { systems: [], modality: null, platforms: [], tags: [] };
const props = {
  systems: [{ name: 'Daggerheart', slug: 'daggerheart' }],
  catalog,
  picked: none,
  count: 12,
};
const lastUrl = () => String(vi.mocked(goto).mock.calls.at(-1)?.[0]);

beforeEach(() => vi.mocked(goto).mockClear());

describe('TablesFilters.svelte', () => {
  it('changes the modality at once, keeping the other filters in the address', async () => {
    render(TablesFilters, { ...props, picked: { ...none, platforms: ['discord'] } });

    await page.getByRole('button', { name: 'Online' }).click();

    expect(lastUrl()).toBe('/tables?modality=online&platform=discord');
  });

  it('marks the modality in use', async () => {
    render(TablesFilters, { ...props, picked: { ...none, modality: 'in_person' } });

    await expect
      .element(page.getByRole('button', { name: 'Presencial' }))
      .toHaveAttribute('aria-pressed', 'true');
    await expect
      .element(page.getByRole('button', { name: 'Todas' }))
      .toHaveAttribute('aria-pressed', 'false');
  });

  it('shows each pick as a chip that removes itself, and a way to clear them all', async () => {
    render(TablesFilters, {
      ...props,
      picked: { ...none, platforms: ['discord', 'roll20'], tags: ['gore'] },
    });

    await expect.element(page.getByRole('button', { name: 'Tirar o filtro Gore' })).toBeVisible();
    await page.getByRole('button', { name: 'Tirar o filtro Discord' }).click();
    expect(lastUrl()).toBe('/tables?platform=roll20&tag=gore');

    await page.getByRole('button', { name: 'Limpar filtros' }).click();
    expect(lastUrl()).toBe('/tables');
  });

  it('draws no chips without picks', async () => {
    render(TablesFilters, props);

    expect(page.getByRole('button', { name: 'Limpar filtros' }).elements()).toHaveLength(0);
  });

  // The wide viewport is set on the page, and Playwright's pointer lands off the controls then:
  // these tests click the elements themselves.
  const press = (locator: { element: () => Element }) => (locator.element() as HTMLElement).click();

  it('adds a platform from its popover', async () => {
    await page.viewport(1280, 800);
    render(TablesFilters, props);

    const open = page.getByRole('button', { name: 'Plataformas' });
    press(open);
    await expect.element(open).toHaveAttribute('aria-expanded', 'true');
    await expect
      .element(
        page.getByRole('group', { name: 'Plataformas' }).getByRole('checkbox', { name: 'Roll20' }),
      )
      .toBeInTheDocument();
    press(
      page.getByRole('group', { name: 'Plataformas' }).getByRole('checkbox', { name: 'Roll20' }),
    );

    expect(lastUrl()).toBe('/tables?platform=roll20');
  });

  it('counts the picks on the button that opens a group', async () => {
    render(TablesFilters, { ...props, picked: { ...none, platforms: ['discord', 'roll20'] } });
    await page.viewport(1280, 800);

    await expect.element(page.getByRole('button', { name: /^Plataformas\s*2$/ })).toBeVisible();
  });

  it('keeps the tags past the featured ones behind "Mostrar todas as 2 tags"', async () => {
    await page.viewport(1280, 800);
    render(TablesFilters, props);

    press(page.getByRole('button', { name: 'Tags' }));
    await expect
      .element(page.getByRole('group', { name: 'Tags' }).getByRole('checkbox', { name: 'Terror' }))
      .toBeInTheDocument();
    expect(page.getByRole('checkbox', { name: 'Gore' }).elements()).toHaveLength(0);
    press(page.getByRole('button', { name: 'Mostrar todas as 2 tags' }));
    await expect.element(page.getByRole('checkbox', { name: 'Gore' })).toBeInTheDocument();
  });

  it('on a phone, opens all the filters in a sheet with the count of tables', async () => {
    render(TablesFilters, { ...props, picked: { ...none, platforms: ['discord'] } });
    await page.viewport(390, 844);

    await page.getByRole('button', { name: /^Filtros\s*1$/ }).click();

    await expect.element(page.getByRole('dialog', { name: 'Filtros' })).toBeVisible();
    await expect.element(page.getByRole('button', { name: 'Mostrar 12 mesas' })).toBeVisible();
    await page.getByRole('button', { name: 'Limpar tudo' }).click();
    expect(lastUrl()).toBe('/tables');
  });
});
