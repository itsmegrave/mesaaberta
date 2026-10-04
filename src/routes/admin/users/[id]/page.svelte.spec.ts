import '../../../layout.css';
import { page } from 'vitest/browser';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import Page from './+page.svelte';

vi.mock('$app/forms', async (original) => ({
  ...(await original<typeof import('$app/forms')>()),
  applyAction: vi.fn(),
}));

const user = {
  id: '00000000-0000-4000-8000-000000000001',
  username: 'ana',
  name: 'Ana Souza',
  status: 'active' as const,
  city: 'Recife',
  timezone: 'America/Recife',
  createdAt: new Date('2026-08-01T12:00:00Z'),
  updatedAt: new Date('2026-09-01T12:00:00Z'),
};
const show = (over = {}) =>
  render(Page, {
    data: {
      user,
      standing: 'active',
      activity: { playing: 2, running: 1, rating: { score: 4.5, count: 3, isNew: false } },
      avatar: null,
      moderation: { ban: null, canModerate: true, acceptedTableReports: 1 },
      back: '/admin/users',
      history: { entries: [], more: false, retentionDays: 90 },
      viewer: { timezone: 'America/Recife' },
      ...over,
    } as never,
  });
const ban = (until: Date | null) => ({
  at: new Date('2026-09-10T12:00:00Z'),
  until,
  reason: 'Spam',
});

describe('admin user page', () => {
  beforeEach(async () => {
    await page.viewport(1280, 900);
  });

  it('says how the account stands, in a badge and one line of what it means', async () => {
    show();

    await expect.element(page.getByText('Ativo', { exact: true })).toBeVisible();
    await expect.element(page.getByText('Entra, abre mesas e joga normalmente.')).toBeVisible();
  });

  it('says suspended until a date, and banned with no way back', async () => {
    const screen = await show({
      standing: 'suspended',
      moderation: {
        ban: ban(new Date('2026-12-01T12:00:00Z')),
        canModerate: true,
        acceptedTableReports: 0,
      },
    });
    await expect.element(page.getByText('Suspenso', { exact: true })).toBeVisible();
    await expect.element(page.getByText(/Sem acesso até/)).toBeVisible();

    await screen.rerender({
      data: {
        user,
        standing: 'banned',
        activity: { playing: 0, running: 0, rating: { score: null, count: 0, isNew: true } },
        avatar: null,
        moderation: { ban: ban(null), canModerate: true, acceptedTableReports: 0 },
        back: '/admin/users',
        history: { entries: [], more: false, retentionDays: 90 },
        viewer: { timezone: 'America/Recife' },
      } as never,
    });
    await expect.element(page.getByText('Banido', { exact: true })).toBeVisible();
    await expect.element(page.getByText(/sem data para voltar/)).toBeVisible();
  });

  it('has the cards "Dados" and "Atividade", with the ID in the first', async () => {
    show();

    const data = page.getByRole('region', { name: 'Dados' });
    await expect.element(data.getByText(user.id)).toBeVisible();
    const activity = page.getByRole('region', { name: 'Atividade' });
    await expect.element(activity.getByText('Jogando')).toBeVisible();
    await expect.element(activity.getByText('Mestrando')).toBeVisible();
    await expect.element(activity.getByText('4,5 · 3 avaliações')).toBeVisible();
    await expect.element(activity.getByText('Denúncias aceitas')).toBeVisible();
  });

  it('says "Novo mestre" for someone nobody rated', async () => {
    show({ activity: { playing: 0, running: 0, rating: { score: null, count: 0, isNew: true } } });

    await expect.element(page.getByText('Novo mestre')).toBeVisible();
  });

  it('has a "Mandar mensagem" button and puts the rest in the title’s 3 dots', async () => {
    show();

    await expect.element(page.getByRole('button', { name: 'Mandar mensagem' })).toBeVisible();
    await page.getByRole('button', { name: 'Mais ações: @ana' }).click();

    await expect
      .element(page.getByRole('menuitem', { name: 'Abrir perfil público' }))
      .toBeVisible();
    await expect.element(page.getByRole('menuitem', { name: 'Copiar ID' })).toBeVisible();
    const names = page
      .getByRole('menuitem')
      .elements()
      .map((element) => element.textContent?.trim());
    // The decisions come last, each asking first.
    expect(names.slice(-2)).toEqual(['Suspender…', 'Banir…']);
  });

  it('asks how long before suspending, and does not ask for a ban that is permanent', async () => {
    show();

    await page.getByRole('button', { name: 'Mais ações: @ana' }).click();
    await page.getByRole('menuitem', { name: 'Suspender…' }).click();
    const suspend = page.getByRole('alertdialog', { name: 'Suspender @ana?' });
    await expect.element(suspend.getByText('7 dias')).toBeVisible();
    expect(suspend.getByText('Permanente').elements()).toHaveLength(0);
  });

  it('offers "Revogar…" for someone under a ban, not a new one', async () => {
    show({
      standing: 'banned',
      moderation: { ban: ban(null), canModerate: true, acceptedTableReports: 0 },
    });

    await page.getByRole('button', { name: 'Mais ações: @ana' }).click();

    await expect.element(page.getByRole('menuitem', { name: 'Revogar…' })).toBeVisible();
    expect(page.getByRole('menuitem', { name: 'Banir…' }).elements()).toHaveLength(0);
  });

  it('offers no decision to someone who may not be moderated', async () => {
    show({ moderation: { ban: null, canModerate: false, acceptedTableReports: 0 } });

    await page.getByRole('button', { name: 'Mais ações: @ana' }).click();

    expect(page.getByRole('menuitem', { name: 'Banir…' }).elements()).toHaveLength(0);
    expect(page.getByRole('menuitem', { name: 'Suspender…' }).elements()).toHaveLength(0);
  });

  it('lists what happened to the person, with who did it', async () => {
    show({
      history: {
        entries: [
          {
            id: 'e1',
            type: 'AccountBanned',
            at: new Date('2026-09-10T12:00:00Z'),
            actor: { id: 'x', username: 'admin' },
            subject: 'ana',
            table: null,
            removed: false,
            changes: null,
          },
        ],
        more: false,
        retentionDays: 90,
      },
    });

    await expect.element(page.getByRole('heading', { name: 'Histórico' })).toBeVisible();
    await expect.element(page.getByText('@admin')).toBeVisible();
  });
});
