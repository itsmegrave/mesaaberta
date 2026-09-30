import '../../layout.css';
import { page } from 'vitest/browser';
import { beforeEach, describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import Page from './+page.svelte';

const person = (n: number, name: string) => ({
  playerId: `00000000-0000-4000-8000-00000000000${n}`,
  username: name,
});
const playing = {
  slug: 'mesa-do-dragao',
  title: 'Mesa do Dragão',
  systemName: 'Daggerheart',
  gmName: 'Mestra Ana',
  status: 'confirmed' as const,
  tableStatus: 'active' as const,
  timezone: 'America/Sao_Paulo',
  nextAt: new Date('2026-10-10T22:00:00Z'),
  canRate: false,
  rating: null,
};
const running = {
  slug: 'cronicas',
  title: 'Crônicas de Arton',
  tableStatus: 'active' as const,
  capacity: 4,
  timezone: 'America/Sao_Paulo',
  nextAt: new Date('2026-10-10T22:00:00Z'),
  players: [person(1, 'Bruno')],
  requests: [] as ReturnType<typeof person>[],
};

type Data = { playing: (typeof playing)[]; running: (typeof running)[] };
const show = (data: Data) =>
  // The page's own data; the layout's is not used here.
  render(Page, { data: data as never });

// By text, not by role: a list or tab that is hidden has no role to find it by.
const panel = (name: string) => page.getByText(name, { exact: true });

describe('Minhas mesas', () => {
  describe('on a phone', () => {
    beforeEach(async () => {
      await page.viewport(390, 844);
    });

    it('shows one list at a time, in tabs that count the tables, starting with what I play', async () => {
      show({ playing: [playing], running: [running] });
      const playingTab = page.getByRole('tab', { name: 'Jogando · 1' });
      const runningTab = page.getByRole('tab', { name: 'Mestrando · 1' });

      await expect.element(playingTab).toHaveAttribute('aria-selected', 'true');
      await expect.element(panel('Jogando')).toBeVisible();
      await expect.element(panel('Mestrando')).not.toBeVisible();

      await runningTab.click();

      await expect.element(runningTab).toHaveAttribute('aria-selected', 'true');
      await expect.element(panel('Mestrando')).toBeVisible();
      await expect.element(panel('Jogando')).not.toBeVisible();
    });

    it('opens on the tables I run when I play none', async () => {
      show({ playing: [], running: [running] });

      await expect
        .element(page.getByRole('tab', { name: 'Mestrando · 1' }))
        .toHaveAttribute('aria-selected', 'true');
      await expect.element(page.getByRole('link', { name: 'Crônicas de Arton' })).toBeVisible();
    });

    it("the waiting-request banner takes me to the table, on the GM's tab", async () => {
      show({ playing: [playing], running: [{ ...running, requests: [person(2, 'Caio')] }] });

      await page.getByRole('link', { name: 'Ver o pedido' }).click();

      await expect
        .element(page.getByRole('tab', { name: 'Mestrando · 1' }))
        .toHaveAttribute('aria-selected', 'true');
      await expect.element(page.getByText('@Caio')).toBeVisible();
    });

    it("opens the first table's players and folds the others", async () => {
      show({
        playing: [],
        running: [
          running,
          { ...running, slug: 'outra', title: 'Outra', players: [person(3, 'Dani')] },
        ],
      });

      await expect.element(page.getByText('@Bruno')).toBeVisible();
      await expect.element(page.getByText('@Dani')).not.toBeVisible();
    });
  });

  it('on a wide screen, shows both lists side by side and no tabs', async () => {
    await page.viewport(1280, 800);
    show({ playing: [playing], running: [running] });

    await expect.element(panel('Jogando')).toBeVisible();
    await expect.element(panel('Mestrando')).toBeVisible();
    await expect.element(page.getByText('Jogando · 1')).not.toBeVisible();
    // Each list is still a named region, not a tab panel without tabs.
    await expect.element(page.getByRole('region', { name: 'Jogando' })).toBeVisible();
    await expect.element(page.getByRole('region', { name: 'Mestrando' })).toBeVisible();
  });
});
