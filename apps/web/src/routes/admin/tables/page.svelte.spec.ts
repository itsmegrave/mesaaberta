import '../../layout.css';
import { page } from 'vitest/browser';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import Page from './+page.svelte';

vi.mock('$app/navigation', () => ({ goto: vi.fn(), invalidateAll: vi.fn() }));
vi.mock('$app/state', () => ({
  navigating: { to: null },
  page: {
    get url() {
      return new URL('http://localhost/admin/tables');
    },
    route: { id: '/admin/tables' },
    data: {
      viewer: { timezone: 'America/Sao_Paulo' },
      adminCounts: { reports: 0, queue: 0, connections: 0, events: 0, partners: 0 },
    },
  },
}));
vi.mock('$lib/query/page.svelte', () => ({
  pageQuery: (read: () => unknown) => ({
    get data() {
      return read();
    },
    isFetching: false,
    isError: false,
    refetch: vi.fn(),
  }),
}));

const row = (over = {}) => ({
  id: '1',
  slug: 'delfos',
  title: 'Delfos',
  status: 'active',
  system: 'D&D 5.5e',
  gm: 'mestre',
  gmId: 'g',
  cover: null,
  capacity: 5,
  seats: 3,
  startsAt: new Date('2026-10-10T22:00:00Z'),
  timezone: 'America/Sao_Paulo',
  instagramStatus: 'published',
  ...over,
});
const show = (rows: unknown[], sort = { id: 'created', dir: 'desc' }) =>
  render(Page, {
    data: {
      instagramAvailable: true,
      tables: {
        rows,
        total: rows.length,
        page: 1,
        pageSize: 20,
        query: '',
        status: 'all',
        instagram: 'all',
        sort,
        counts: {
          all: 2,
          active: 1,
          disabled: 1,
          awaiting_confirmation: 0,
          concluded: 0,
          not_held: 0,
        },
      },
    } as never,
  });

describe('admin tables', () => {
  beforeEach(async () => {
    await page.viewport(1280, 900);
  });

  it('shows the table status as a badge and the Instagram post as a line under it', async () => {
    show([row(), row({ id: '2', slug: 'b', instagramStatus: 'failed' })]);

    const status = page.getByText('Ativa').first().element();
    // The design system's StatusBadge: a 28px pill with a hairline border.
    expect(status.className).toMatch(/\bh-7\b/);
    expect(status.className).toContain('rounded-full');
    expect(status.className).toContain('border');
    const post = page.getByText('Publicado').first().element();
    expect(post.className).not.toContain('rounded-full');
    expect(post.querySelector('svg')).not.toBeNull();
    // Red only when it needs action.
    expect(page.getByText('Falhou').first().element().className).toContain('text-error');
    await expect.element(page.getByText('3/5').first()).toBeVisible();
  });

  it('offers "Fechar a mesa…" only for an active table, and asks for a justification', async () => {
    show([row(), row({ id: '2', title: 'Antiga', status: 'disabled', slug: 'antiga' })]);

    await page
      .getByRole('button', { name: /Ações da mesa: Antiga/ })
      .first()
      .click();
    await expect.element(page.getByRole('menuitem', { name: 'Ver a mesa' })).toBeVisible();
    await expect
      .element(page.getByRole('menuitem', { name: /Fechar a mesa/ }))
      .not.toBeInTheDocument();
    await page.getByRole('menuitem', { name: 'Ver a mesa' }).click();

    await page
      .getByRole('button', { name: /Ações da mesa: Delfos/ })
      .first()
      .click();
    await page.getByRole('menuitem', { name: 'Fechar a mesa…' }).click();
    await expect.element(page.getByRole('alertdialog', { name: 'Fechar "Delfos"?' })).toBeVisible();
    await expect.element(page.getByLabelText('Justificativa para o mestre')).toBeVisible();
  });

  it('sorts by the next session from its header', async () => {
    show([row()], { id: 'next', dir: 'asc' });

    await expect
      .element(page.getByRole('columnheader', { name: 'Próxima sessão' }))
      .toHaveAttribute('aria-sort', 'ascending');
  });
});
