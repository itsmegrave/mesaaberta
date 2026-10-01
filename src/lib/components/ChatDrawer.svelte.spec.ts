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
  vi.mocked(apiRead).mockResolvedValue({ items: [], page: 1, pages: 1 });
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
        '/api/messages/inbox?page=1',
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
});
