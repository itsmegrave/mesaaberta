import '../../../routes/layout.css';
import { page } from 'vitest/browser';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import AdminSectionMenu from './AdminSectionMenu.svelte';

vi.mock('$app/navigation', () => ({ goto: vi.fn() }));
vi.mock('$app/state', () => ({
  page: {
    route: { id: '/admin/users' },
    data: { adminCounts: { reports: 3, queue: 0, connections: 1 } },
  },
}));

describe('AdminSectionMenu', () => {
  beforeEach(async () => {
    await page.viewport(390, 844);
  });

  it('is one "Seção: …" button with what waits in total, that opens the sections as a menu', async () => {
    render(AdminSectionMenu);

    // The badge is the total of what waits: 3 reports and 1 connection.
    const button = page.getByRole('button', { name: 'Seção: Usuários 4' });
    await expect.element(button).toBeVisible();
    (button.element() as HTMLElement).click();

    await expect.element(page.getByRole('menuitem', { name: /Fila de aprovação/ })).toBeVisible();
    await expect.element(page.getByRole('menuitem', { name: /Denúncias/ })).toBeVisible();
  });

  it('is hidden from a desktop, where the column does the job', async () => {
    await page.viewport(1280, 900);
    render(AdminSectionMenu);

    await expect.element(page.getByText('Seção: Usuários')).not.toBeVisible();
  });
});
