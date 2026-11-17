import '../layout.css';
import { page, type Locator } from 'vitest/browser';
import { afterEach, describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import Page from './+page.svelte';

const tool = (id: string, name: string, kinds: string[]) => ({
  id,
  slug: id,
  name,
  kinds,
  siteUrl: `https://${id}.example`,
  description: `${name}, uma ferramenta.`,
  logoUrl: null,
  platformSlug: null,
  openTables: 0,
  pending: false,
});
const oldDragon = tool('old-dragon-online', 'Old Dragon Online', ['vtt', 'helper']);
const data = {
  query: '',
  pending: [],
  groups: [
    { kind: 'vtt', tools: [tool('roll20', 'Roll20', ['vtt']), oldDragon] },
    { kind: 'chat', tools: [tool('discord', 'Discord', ['chat'])] },
    { kind: 'helper', tools: [oldDragon] },
  ],
  signedIn: true,
  sent: false,
};
const show = () => render(Page, { data: data as never });
const trigger = (name: RegExp) => page.getByRole('heading', { level: 2, name }).getByRole('button');
// A folded section's cards leave the page or hide; either way nobody sees them.
const unseen = (locator: Locator) =>
  expect.poll(() => locator.elements().every((element) => !element.checkVisibility())).toBe(true);
const hidden = (name: string) => unseen(page.getByRole('heading', { name, includeHidden: true }));

afterEach(() => page.viewport(1280, 900));

describe('Ferramentas', () => {
  it('opens every section on a wide screen, each folding on its own', async () => {
    await page.viewport(1280, 900);
    show();
    await expect.element(page.getByRole('heading', { name: 'Roll20' })).toBeVisible();
    await expect.element(page.getByRole('heading', { name: 'Discord' })).toBeVisible();
    // A tool with two kinds is in both sections.
    expect(page.getByRole('heading', { name: 'Old Dragon Online' }).elements()).toHaveLength(2);
    expect(page.getByRole('navigation', { name: 'Seções' }).elements()).toHaveLength(0);

    await trigger(/^Mesas virtuais/).click();
    await hidden('Roll20');
    await expect.element(page.getByRole('heading', { name: 'Discord' })).toBeVisible();
  });

  it('pages through the sections on a phone, one open at a time', async () => {
    await page.viewport(390, 844);
    show();
    const sections = page.getByRole('navigation', { name: 'Seções' });
    await expect.element(sections).toBeVisible();
    await expect.element(page.getByRole('heading', { name: 'Roll20' })).toBeVisible();
    await hidden('Discord');
    await expect.element(page.getByText('1 de 3')).toBeVisible();

    await page.getByRole('button', { name: 'Próxima seção: Chat e comunidade' }).click();
    await expect.element(page.getByRole('heading', { name: 'Discord' })).toBeVisible();
    await hidden('Roll20');
    await expect.element(page.getByText('2 de 3')).toBeVisible();

    await sections.getByRole('button', { name: /Fichas e apoio/ }).click();
    await expect
      .element(sections.getByRole('button', { name: /Fichas e apoio/ }))
      .toHaveAttribute('aria-current', 'true');
    await expect.element(page.getByText('3 de 3')).toBeVisible();
    await hidden('Discord');

    // Opening a section from its own heading folds the one that was open.
    await trigger(/^Mesas virtuais/).click();
    await expect.element(page.getByRole('heading', { name: 'Roll20' })).toBeVisible();
    await unseen(page.getByText('3 de 3'));
  });
});
