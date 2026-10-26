import '../../layout.css';
import { page } from 'vitest/browser';
import { beforeEach, describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import type { TableStatus } from '#lib/tables/status.js';
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
  tableStatus: 'active' as TableStatus,
  timezone: 'America/Sao_Paulo',
  startsAt: new Date('2026-10-10T22:00:00Z'),
  canRate: false,
  rating: null,
};
const running = {
  slug: 'cronicas',
  title: 'Crônicas de Arton',
  tableStatus: 'active' as TableStatus,
  capacity: 4,
  timezone: 'America/Sao_Paulo',
  startsAt: new Date('2026-10-10T22:00:00Z'),
  players: [person(1, 'Bruno')],
  requests: [] as ReturnType<typeof person>[],
};

type Running = typeof running;
type Invitation = {
  id: string;
  status: 'pending' | 'accepted' | 'declined' | 'expired' | 'cancelled';
  expiresAt: Date;
  gmUsername: string;
  table: { slug: string; title: string; timezone: string };
};
type Data = {
  playing: (typeof playing)[];
  running: Running[];
  invitations?: Invitation[];
  page?: number;
  pages?: number;
};
/** The page's own data, worked out as the server read does; the layout's is not used here. */
const show = ({ page = 1, pages = 1, invitations = [], ...data }: Data) => {
  const waiting = data.running.filter((table) => table.requests.length > 0);
  return render(Page, {
    data: {
      ...data,
      invitations,
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
  it('offers permanent deletion for a draft and explains the irreversible action before posting', async () => {
    show({ playing: [], running: [{ ...running, tableStatus: 'draft' }] });
    await page.getByRole('button', { name: `Mais ações: ${running.title}` }).click();
    await page.getByRole('menuitem', { name: 'Excluir rascunho…' }).click();
    const dialog = page.getByRole('alertdialog');
    await expect.element(dialog.getByText(/não pode ser desfeita/)).toBeVisible();
    await expect.element(dialog.getByRole('button', { name: 'Cancelar' })).toHaveFocus();
    expect(
      dialog
        .getByRole('button', { name: 'Excluir rascunho', exact: true })
        .element()
        .closest('form')
        ?.getAttribute('action'),
    ).toBe('/t/cronicas/manage?/deleteDraft');
    await dialog.getByRole('button', { name: 'Cancelar' }).click();
    await expect.element(dialog).not.toBeInTheDocument();
  });
  it('offers closing a published table while explaining that its history is preserved', async () => {
    show({ playing: [], running: [running] });
    await page.getByRole('button', { name: `Mais ações: ${running.title}` }).click();
    await page.getByRole('menuitem', { name: 'Encerrar mesa…' }).click();
    const dialog = page.getByRole('alertdialog');
    await expect.element(dialog.getByText(/histórico será preservado/)).toBeVisible();
    expect(
      dialog
        .getByRole('button', { name: 'Encerrar mesa', exact: true })
        .element()
        .closest('form')
        ?.getAttribute('action'),
    ).toBe('/t/cronicas/manage?/close');
  });
  it('lists only pending, unexpired invitations, with a count and "Responder" for each', async () => {
    const pending: Invitation = {
      id: '00000000-0000-4000-8000-000000000001',
      status: 'pending',
      expiresAt: new Date(Date.now() + 3600000),
      gmUsername: 'ana',
      table: { slug: 'convite-atual', title: 'Convite atual', timezone: 'America/Sao_Paulo' },
    };
    show({
      playing: [],
      running: [],
      invitations: [
        pending,
        {
          ...pending,
          id: 'expired',
          expiresAt: new Date(0),
          table: { ...pending.table, slug: 'expired', title: 'Expirado' },
        },
        {
          ...pending,
          id: 'accepted',
          status: 'accepted',
          table: { ...pending.table, slug: 'accepted', title: 'Aceito' },
        },
      ],
    });
    await expect
      .element(page.getByRole('link', { name: 'Responder ao convite para Convite atual' }))
      .toHaveAttribute('href', '/u/profile/invitations/00000000-0000-4000-8000-000000000001');
    await expect.element(page.getByText('1 convite aguardando resposta')).toBeInTheDocument();
    await expect.element(page.getByText('@ana convidou você', { exact: false })).toBeVisible();
    expect(page.getByRole('link', { name: /Responder/ }).elements()).toHaveLength(1);
  });

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
    const awaiting = { ...running, tableStatus: 'awaiting_confirmation' as TableStatus };

    it('asks the GM whether it happened: yes opens the attendance step, no posts and comes back', async () => {
      await page.viewport(1280, 800);
      show({ playing: [], running: [awaiting] });

      const prompt = page.getByRole('group', { name: 'A sessão de Crônicas de Arton aconteceu?' });
      await expect.element(prompt).toBeVisible();
      const no = prompt.getByRole('button', { name: 'Não aconteceu' });
      await expect
        .element(prompt.getByRole('link', { name: 'Sim, aconteceu' }))
        .toHaveAttribute('href', '/t/cronicas/manage?etapa=presenca#session-confirmation');
      expect(no.element().closest('form')?.getAttribute('action')).toBe(
        '/t/cronicas/manage?/notHeld',
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
        playing: [{ ...playing, tableStatus: 'concluded' as TableStatus }],
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
