import '../../routes/layout.css';
import { page } from 'vitest/browser';
import { beforeEach, describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import AdminNav from './AdminNav.svelte';

const counts = { reports: 3, queue: 0, connections: 1, events: 0, partners: 0 };

describe('AdminNav', () => {
  beforeEach(async () => {
    await page.viewport(1280, 900);
  });

  it('groups the sections, marks the one in use and counts what waits', async () => {
    render(AdminNav, { route: '/admin/reports', counts });

    for (const group of ['Visão geral', 'Moderação', 'Conteúdo', 'Comunicação', 'Registro']) {
      await expect.element(page.getByText(group, { exact: true }).first()).toBeVisible();
    }
    const nav = page.getByRole('navigation', { name: 'Seções da administração' });
    await expect
      .element(nav.getByRole('link', { name: /^Denúncias/ }))
      .toHaveAttribute('aria-current', 'page');
    await expect.element(nav.getByRole('link', { name: 'Denúncias 3' })).toBeVisible();
    await expect.element(nav.getByRole('link', { name: 'Conexões 1' })).toBeVisible();
    // Nothing waiting: no badge.
    await expect.element(nav.getByRole('link', { name: 'Fila de aprovação' })).toBeVisible();
    await expect
      .element(nav.getByRole('link', { name: 'Mesas' }))
      .toHaveAttribute('href', '/admin/tables');
  });
});
