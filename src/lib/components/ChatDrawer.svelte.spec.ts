import { page, userEvent } from 'vitest/browser';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { apiRead } from '$lib/api/http';
import ChatDrawer from './ChatDrawer.svelte';
vi.mock('$lib/api/http', async (original) => ({
  ...(await original<typeof import('$lib/api/http')>()),
  apiRead: vi.fn(),
}));
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(apiRead).mockResolvedValue({
    items: [],
    page: 1,
    pages: 1,
    unreadByKind: { direct: 0, table: 0 },
  });
});
describe('ChatDrawer', () => {
  it('loads only after opening and restores trigger focus on Escape', async () => {
    render(ChatDrawer, { viewerId: 'viewer' });
    const trigger = page.getByRole('button', { name: 'Abrir chat' });
    expect(apiRead).not.toHaveBeenCalled();
    await trigger.click();
    await expect.element(page.getByRole('dialog', { name: 'Mensagens' })).toBeVisible();
    await vi.waitFor(() =>
      expect(apiRead).toHaveBeenCalledWith(
        '/api/messages/inbox?page=1&kind=direct',
        expect.any(AbortSignal),
        'viewer',
      ),
    );
    await userEvent.keyboard('{Escape}');
    await expect.element(trigger).toHaveFocus();
  });
  it('keeps an explicit link to the full messages page', async () => {
    render(ChatDrawer, { viewerId: 'viewer' });
    await page.getByRole('button', { name: 'Abrir chat' }).click();
    await expect
      .element(page.getByRole('link', { name: 'Abrir página de mensagens' }))
      .toHaveAttribute('href', '/messages');
  });

  it('has a tab for direct messages and one for the tables, each saying how many are unread', async () => {
    vi.mocked(apiRead).mockResolvedValue({
      items: [],
      page: 1,
      pages: 1,
      unreadByKind: { direct: 2, table: 0 },
    });
    render(ChatDrawer, { viewerId: 'viewer' });
    await page.getByRole('button', { name: /Abrir chat/ }).click();

    await expect.element(page.getByRole('tab', { name: 'Diretas, 2 não lidas' })).toBeVisible();
    await expect.element(page.getByRole('tab', { name: 'Mesas' })).toBeVisible();
  });

  it('asks for the tables’ conversations when that tab is chosen', async () => {
    render(ChatDrawer, { viewerId: 'viewer' });
    await page.getByRole('button', { name: /Abrir chat/ }).click();

    await page.getByRole('tab', { name: 'Mesas' }).click();

    await vi.waitFor(() =>
      expect(apiRead).toHaveBeenCalledWith(
        '/api/messages/inbox?page=1&kind=table',
        expect.any(AbortSignal),
        'viewer',
      ),
    );
  });

  it('opens on the tables when only they have something unread', async () => {
    vi.mocked(apiRead).mockResolvedValue({
      items: [],
      page: 1,
      pages: 1,
      unreadByKind: { direct: 0, table: 3 },
    });
    render(ChatDrawer, { viewerId: 'viewer' });
    await page.getByRole('button', { name: /Abrir chat/ }).click();

    await expect
      .element(page.getByRole('tab', { name: 'Mesas, 3 não lidas' }))
      .toHaveAttribute('aria-selected', 'true');
  });

  it('says how many conversations are unread on the button that opens it', async () => {
    render(ChatDrawer, { viewerId: 'viewer', unread: 4 });

    await expect
      .element(page.getByRole('button', { name: 'Abrir chat, 4 não lidas' }))
      .toBeVisible();
  });
});
