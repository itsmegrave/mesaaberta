import { page } from 'vitest/browser';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import NotificationBell from './NotificationBell.svelte';

const state = vi.hoisted(() => ({
  updated: { current: false },
  afterNavigate: [] as ((navigation: { type: string }) => void)[],
}));
vi.mock('$app/navigation', () => ({
  refreshAll: vi.fn(),
  afterNavigate: (callback: (navigation: { type: string }) => void) =>
    state.afterNavigate.push(callback),
}));
vi.mock('$app/state', () => ({
  page: { url: new URL('http://localhost/tables?q=dragao') },
  updated: state.updated,
}));

describe('NotificationBell', () => {
  beforeEach(() => {
    state.updated.current = false;
    state.afterNavigate.length = 0;
  });

  it('pins one new-version item atop the list, apart from the unread count', async () => {
    state.updated.current = true;
    render(NotificationBell, { unread: 0, latest: [] });

    const bell = page.getByRole('button', { name: 'Notificações, nova versão disponível' });
    await expect.element(bell).toBeVisible();
    await expect.element(page.getByTestId('notification-count')).not.toBeInTheDocument();
    await expect.element(page.getByTestId('app-update-dot')).toBeInTheDocument();

    await bell.click();
    await expect.element(page.getByText('Nova versão disponível')).toBeVisible();
    expect(page.getByTestId('app-update-notice').elements()).toHaveLength(1);
    await expect.element(page.getByRole('button', { name: 'Atualizar agora' })).toBeVisible();
  });

  it('shows the count, not the dot, when there are unread notifications too', async () => {
    state.updated.current = true;
    render(NotificationBell, { unread: 2, latest: [] });

    await expect.element(page.getByTestId('notification-count')).toBeInTheDocument();
    await expect.element(page.getByTestId('app-update-dot')).not.toBeInTheDocument();
  });

  it('has no new-version item on the current build', async () => {
    render(NotificationBell, { unread: 0, latest: [] });

    await page.getByRole('button', { name: 'Notificações' }).click();
    await expect.element(page.getByText('Nada por aqui ainda.')).toBeVisible();
    await expect.element(page.getByTestId('app-update-notice')).not.toBeInTheDocument();
  });

  it('closes when the page moves on, so it does not stay open over the next page', async () => {
    render(NotificationBell, { unread: 0, latest: [] });

    await page.getByRole('button', { name: 'Notificações' }).click();
    await expect.element(page.getByText('Nada por aqui ainda.')).toBeVisible();

    for (const callback of state.afterNavigate) callback({ type: 'goto' });
    await expect.element(page.getByText('Nada por aqui ainda.')).not.toBeInTheDocument();
  });
});
