import '../layout.css';
import { page } from 'vitest/browser';
import { beforeEach, describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import Page from './+page.svelte';

const show = (over = {}) =>
  render(Page, {
    data: {
      people: { total: 26, active: 20, suspended: 4, banned: 2, new30d: 3 },
      tables: {
        total: 8,
        active: 8,
        disabled: 0,
        awaiting: 0,
        concluded: 0,
        notHeld: 0,
        online: 6,
        inPerson: 2,
        gms: 3,
      },
      seats: { confirmed: 12, pending: 0 },
      queue: { pending: 1, failed: 0 },
      suggestions: { platforms: 0, tags: 0 },
      updatedAt: new Date('2026-10-02T12:00:00Z'),
      viewer: { timezone: 'America/Sao_Paulo' },
      ...over,
    } as never,
  });

describe('admin overview', () => {
  beforeEach(async () => {
    await page.viewport(1280, 900);
  });

  it('counts banned profiles apart from suspended ones', async () => {
    show();

    await expect.element(page.getByText('Perfis suspensos')).toBeVisible();
    await expect.element(page.getByText('Perfis banidos')).toBeVisible();
  });

  it('lists the tables by every status', async () => {
    show();

    for (const label of [
      'Ativas',
      'Aguardando confirmação',
      'Concluídas',
      'Não realizadas',
      'Desativadas',
    ]) {
      await expect.element(page.getByText(label, { exact: true })).toBeVisible();
    }
  });

  it('says it plainly: "Vagas confirmadas", "Todas ativas" and the requests waiting on the GM', async () => {
    show();

    await expect.element(page.getByText('Vagas confirmadas')).toBeVisible();
    await expect.element(page.getByText('Todas ativas')).toBeVisible();
    await expect.element(page.getByText('Nenhum pedido esperando o mestre')).toBeVisible();
  });

  it('counts the events in the queue and the ones that failed', async () => {
    show();

    await expect.element(page.getByText('Eventos na fila')).toBeVisible();
    await expect.element(page.getByText('Eventos que falharam')).toBeVisible();
  });

  it('counts the active tables when some are not', async () => {
    show({
      tables: {
        total: 8,
        active: 5,
        disabled: 1,
        awaiting: 1,
        concluded: 1,
        notHeld: 0,
        online: 6,
        inPerson: 2,
        gms: 3,
      },
    });

    await expect.element(page.getByText('5 ativas')).toBeVisible();
  });

  it('puts "Ver plataforma" in the title’s 3 dots', async () => {
    show();

    await page.getByRole('button', { name: 'Mais ações: Visão geral da plataforma' }).click();

    await expect.element(page.getByRole('menuitem', { name: 'Ver plataforma' })).toBeVisible();
  });
});
