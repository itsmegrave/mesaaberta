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

type Running = typeof running;
type Data = { playing: (typeof playing)[]; running: Running[]; page?: number; pages?: number };
/** The page's own data, worked out as the server read does; the layout's is not used here. */
const show = ({ page = 1, pages = 1, ...data }: Data) => {
  const waiting = data.running.filter((table) => table.requests.length > 0);
  return render(Page, {
    data: {
      ...data,
      page,
      pages,
      totals: { playing: data.playing.length, running: data.running.length },
      waiting: waiting.length
        ? {
            requests: waiting.reduce((sum, table) => sum + table.requests.length, 0),
            tables: waiting.length,
            first: { slug: waiting[0].slug, title: waiting[0].title, page: 1 },
          }
        : null,
    } as never,
  });
};

// By text, not by role: a list or tab that is hidden has no role to find it by.
const panel = (name: string) => page.getByText(name, { exact: true });

describe('Minhas mesas', () => {
  // The banner's link leaves `#mesa-...` in the address, and that hash opens the GM's tab: clear it
  // so a test does not start where the one before it ended.
  beforeEach(() => {
    history.replaceState(null, '', location.pathname + location.search);
  });

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

  it('pages through the tables, with no previous link on the first page', async () => {
    await page.viewport(1280, 800);
    show({ playing: [playing], running: [running], page: 1, pages: 3 });

    const pages = page.getByRole('navigation', { name: 'Páginas' });
    await expect.element(pages.getByText('Página 1 de 3')).toBeVisible();
    await expect
      .element(pages.getByRole('link', { name: 'Próxima página' }))
      .toHaveAttribute('href', expect.stringContaining('page=2'));
    expect(pages.getByRole('link', { name: 'Página anterior' }).elements()).toHaveLength(0);
  });

  describe('a session whose date has passed', () => {
    const awaiting = { ...running, tableStatus: 'awaiting_confirmation' as const };

    it('asks the GM whether it happened, posting to the table’s manage page and coming back here', async () => {
      await page.viewport(1280, 800);
      show({ playing: [], running: [awaiting] });

      const prompt = page.getByRole('group', { name: 'A sessão de Crônicas de Arton aconteceu?' });
      await expect.element(prompt).toBeVisible();
      const yes = prompt.getByRole('button', { name: 'Sim, aconteceu' });
      const no = prompt.getByRole('button', { name: 'Não aconteceu' });
      expect(yes.element().closest('form')?.getAttribute('action')).toBe(
        '/tables/cronicas/manage?/happened',
      );
      expect(no.element().closest('form')?.getAttribute('action')).toBe(
        '/tables/cronicas/manage?/notHeld',
      );
    });

    it('does not ask about a table that is still open', async () => {
      await page.viewport(1280, 800);
      show({ playing: [], running: [running] });

      expect(page.getByText('aconteceu?').elements()).toHaveLength(0);
    });

    it('shows no table status to a player or a GM: statuses are only for admin', async () => {
      await page.viewport(1280, 800);
      show({
        playing: [{ ...playing, tableStatus: 'concluded' as const }],
        running: [awaiting],
      });

      for (const word of ['Aguardando confirmação', 'Concluída', 'Mesa concluída', 'Desativada']) {
        expect(page.getByText(word).elements()).toHaveLength(0);
      }
    });
  });

  it('offers the calendar download from the title’s 3 dots', async () => {
    await page.viewport(1280, 800);
    show({ playing: [playing], running: [running] });

    await page.getByRole('button', { name: 'Mais ações: Minhas mesas' }).click();

    await expect
      .element(page.getByRole('menuitem', { name: 'Baixar calendário (.ics)' }))
      .toBeVisible();
  });
});
