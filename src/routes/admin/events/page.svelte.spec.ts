import '../../layout.css';
import { page } from 'vitest/browser';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import Page from './+page.svelte';

vi.mock('$app/navigation', () => ({ goto: vi.fn(), invalidateAll: vi.fn() }));
vi.mock('$app/state', () => ({
  navigating: { to: null },
  page: {
    get url() {
      return new URL('http://localhost/admin/events');
    },
    route: { id: '/admin/events' },
    data: {
      viewer: { timezone: 'America/Sao_Paulo' },
      adminCounts: { reports: 0, queue: 0, connections: 0, events: 1, partners: 0 },
    },
  },
}));

const row = (over = {}) => ({
  id: '00000000-0000-4000-8000-000000000001',
  type: 'TableCreated',
  payload: { tableId: 'tbl-1', slug: 'mesa', title: 'Mesa' },
  createdAt: new Date('2026-10-01T12:00:00Z'),
  attempts: 8,
  nextAttemptAt: new Date('2026-10-01T12:00:00Z'),
  lastError: 'Error: Resend recusou o envio',
  handledBy: ['invite'],
  failedAt: new Date('2026-10-01T13:00:00Z'),
  processedAt: null,
  actor: 'ana',
  remaining: ['bell'],
  ...over,
});
const show = (queue = {}) =>
  render(Page, {
    data: {
      viewer: { timezone: 'America/Sao_Paulo' },
      queue: {
        status: 'failed',
        type: '',
        types: ['TableCreated'],
        counts: { failed: 1, retrying: 2, pending: 3, running: 0, processed: 40 },
        total: 1,
        page: 1,
        pages: 1,
        pageSize: 20,
        maxAttempts: 8,
        rows: [row()],
        ...queue,
      },
    } as never,
  });

describe('admin events page', () => {
  it('shows each state with its count, opening on the ones that failed', async () => {
    show();

    await expect
      .element(page.getByRole('heading', { name: 'Fila de eventos', level: 1 }))
      .toBeVisible();
    for (const label of [
      /Falhou/,
      /Aguardando nova tentativa/,
      /Pendente/,
      /Em execução/,
      /Processado/,
    ]) {
      expect(page.getByRole('radio', { name: label }).elements()).toHaveLength(1);
    }
    expect(
      (page.getByRole('radio', { name: /Falhou/ }).element() as HTMLInputElement).checked,
    ).toBe(true);
  });

  it('shows what went wrong, the attempts, and which handlers ran and which are left', async () => {
    show();

    const text = () => document.body.textContent ?? '';
    await expect.element(page.getByText('TableCreated').first()).toBeVisible();
    expect(text()).toContain('Tentativas: 8 de 8');
    expect(text()).toContain('Error: Resend recusou o envio');
    expect(text()).toContain('Já rodaram: invite');
    expect(text()).toContain('Faltam: bell');
    expect(text()).toContain('@ana');
  });

  it('offers to run a failed event now, and all the failed ones', async () => {
    show();

    await expect
      .element(page.getByRole('button', { name: /Rodar agora: TableCreated/ }))
      .toBeVisible();
    await expect
      .element(page.getByRole('button', { name: 'Rodar todos os que falharam' }))
      .toBeVisible();
  });

  it('offers nothing to run for an event that is done or running', async () => {
    show({
      status: 'processed',
      rows: [row({ failedAt: null, processedAt: new Date('2026-10-01T12:05:00Z'), remaining: [] })],
    });

    expect(page.getByRole('button', { name: /Rodar agora/ }).elements()).toHaveLength(0);
    expect(
      page.getByRole('button', { name: 'Rodar todos os que falharam' }).elements(),
    ).toHaveLength(0);
  });

  it('keeps the data of the event collapsed', async () => {
    show();

    const details = document.querySelector('details')!;
    expect(details.open).toBe(false);
    expect(details.textContent).toContain('"slug": "mesa"');
  });

  it('says so when there is nothing in the state', async () => {
    show({
      total: 0,
      rows: [],
      counts: { failed: 0, retrying: 0, pending: 0, running: 0, processed: 0 },
    });

    await expect.element(page.getByText('Nenhum evento neste estado.')).toBeVisible();
  });
});
