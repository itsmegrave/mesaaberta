import '../../routes/layout.css';
import { page } from 'vitest/browser';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { goto } from '$app/navigation';
import AdminProfilesTable from './AdminProfilesTable.svelte';

vi.mock('$app/state', () => ({ page: { url: new URL('http://localhost/admin/users') } }));
vi.mock('$app/navigation', () => ({ goto: vi.fn(), invalidateAll: vi.fn(async () => {}) }));

const row = (over = {}) => ({
  id: '00000000-0000-4000-8000-000000000001',
  username: 'ana',
  name: 'Ana Souza',
  status: 'active' as const,
  standing: 'active' as const,
  createdAt: new Date('2026-09-01T12:00:00Z'),
  avatar: null,
  playing: 2,
  running: 1,
  ...over,
});
const show = (rows = [row()], over = {}) =>
  render(AdminProfilesTable, {
    data: {
      rows,
      total: rows.length,
      page: 1,
      pageSize: 20,
      query: '',
      status: 'all',
      ...over,
    } as never,
  });

describe('AdminProfilesTable', () => {
  beforeEach(async () => {
    await page.viewport(1280, 900);
  });

  it('shows who, their tables, when they joined and how they stand, with no UUID column', async () => {
    show();

    for (const header of ['Usuário', 'Mesas', 'Cadastro', 'Status']) {
      await expect.element(page.getByRole('columnheader', { name: header })).toBeVisible();
    }
    expect(page.getByRole('columnheader', { name: 'ID' }).elements()).toHaveLength(0);
    await expect
      .element(page.getByRole('link', { name: '@ana' }))
      .toHaveAttribute('href', '/u/ana');
    await expect.element(page.getByText('Ana Souza')).toBeVisible();
    await expect.element(page.getByText('2 jogando · 1 mestrando')).toBeVisible();
    await expect.element(page.getByText('Ativo', { exact: true }).first()).toBeVisible();
  });

  it('says "Sem nome" without a name and "Nenhuma ainda" without tables', async () => {
    show([row({ name: null, playing: 0, running: 0 })]);

    await expect.element(page.getByText('Sem nome')).toBeVisible();
    await expect.element(page.getByText('Nenhuma ainda')).toBeVisible();
  });

  it('names a suspended and a banned account in words, apart', async () => {
    show([
      row({ username: 'sus', standing: 'suspended' as const, status: 'suspended' as const }),
      row({
        id: '00000000-0000-4000-8000-000000000002',
        username: 'ban',
        standing: 'banned' as const,
        status: 'suspended' as const,
      }),
    ]);

    await expect.element(page.getByText('Suspenso', { exact: true }).first()).toBeVisible();
    await expect.element(page.getByText('Banido', { exact: true }).first()).toBeVisible();
  });

  it('puts the actions in a 3-dots menu: details, the public profile and the ID', async () => {
    show();

    await page.getByRole('button', { name: 'Mais ações: @ana' }).click();

    await expect.element(page.getByRole('menuitem', { name: 'Ver detalhes' })).toBeVisible();
    await expect
      .element(page.getByRole('menuitem', { name: 'Abrir perfil público' }))
      .toBeVisible();
    await expect.element(page.getByRole('menuitem', { name: 'Copiar ID' })).toBeVisible();
  });

  it('filters by Ativo, Suspenso and Banido', async () => {
    show();

    await page.getByRole('button', { name: 'Abrir a lista: Status' }).click();
    await expect
      .poll(() =>
        page
          .getByRole('option')
          .elements()
          .map((option) => option.textContent?.trim()),
      )
      .toEqual(['Todos', 'Ativo', 'Suspenso', 'Banido']);
  });

  it('counts the users and searches by "Buscar usuário"', async () => {
    show([row(), row({ id: '2', username: 'bia' })], { total: 26 });

    await expect.element(page.getByText('26 usuários')).toBeVisible();
    await expect.element(page.getByLabelText('Buscar usuário')).toBeVisible();
  });

  it('keeps the page when the page size is the one it already has, and starts over for a new one', async () => {
    vi.mocked(goto).mockClear();
    show([row()], { total: 60, page: 2 });

    await page.getByRole('button', { name: 'Abrir a lista: Por página' }).click();
    await page.getByRole('option', { name: '20', exact: true }).click();
    expect(goto).not.toHaveBeenCalled();

    await page.getByRole('button', { name: 'Abrir a lista: Por página' }).click();
    await page.getByRole('option', { name: '50', exact: true }).click();
    await expect.poll(() => String(vi.mocked(goto).mock.calls.at(-1)?.[0])).toContain('size=50');
    expect(String(vi.mocked(goto).mock.calls.at(-1)?.[0])).toContain('page=1');
  });
});
