import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page } from 'vitest/browser';
import { focusManager, onlineManager } from '@tanstack/svelte-query';
import { createQueryClient } from './client';
import { readKey, type ReadSeed } from './keys';
import { invalidateAll } from '$app/navigation';
vi.mock('$app/navigation', () => ({ invalidateAll: vi.fn(async () => {}) }));
import Harness from './QueryHarness.svelte';
const seed = (): ReadSeed => ({
  resource: 'preview',
  params: '',
  viewer: 'public',
  updatedAt: Date.now(),
  fields: ['value'],
});
afterEach(() => {
  vi.restoreAllMocks();
  focusManager.setFocused(undefined);
  onlineManager.setOnline(true);
});
describe('server seeded page queries', () => {
  it('renders loader data without a duplicate request and caches only DTO fields', async () => {
    const request = vi.spyOn(window, 'fetch');
    const client = createQueryClient();
    const readSeed = seed();
    await render(Harness, {
      client,
      data: { value: 'SSR', account: { secret: 'private' }, readSeed },
    });
    await expect.element(page.getByLabelText('value')).toHaveTextContent('SSR');
    expect(request).not.toHaveBeenCalled();
    expect(client.getQueryData(readKey(readSeed))).toEqual({ value: 'SSR' });
  });
  it('deduplicates a shared refetch and leaves an edited field untouched', async () => {
    const request = vi.spyOn(window, 'fetch').mockResolvedValue(Response.json({ value: 'Fresh' }));
    const client = createQueryClient();
    const data = { value: 'SSR', readSeed: seed() };
    const first = await render(Harness, { client, data });
    await render(Harness, { client, data });
    await first.locator.getByLabelText('draft').fill('unsaved');
    await client.invalidateQueries({ queryKey: readKey(data.readSeed) });
    await expect.element(first.locator.getByLabelText('value')).toHaveTextContent('Fresh');
    await expect.element(first.locator.getByLabelText('draft')).toHaveValue('unsaved');
    expect(request).toHaveBeenCalledTimes(1);
  });
  it('reconciles a newer server navigation for the same key', async () => {
    const client = createQueryClient();
    const readSeed = seed();
    const view = await render(Harness, { client, data: { value: 'old', readSeed } });
    await view.rerender({
      data: { value: 'new', readSeed: { ...readSeed, updatedAt: readSeed.updatedAt + 1000 } },
    });
    await expect.element(page.getByLabelText('value')).toHaveTextContent('new');
    expect(client.getQueryData(readKey(readSeed))).toEqual({ value: 'new' });
  });
  it('refreshes stale data on focus and reconnect', async () => {
    const request = vi
      .spyOn(window, 'fetch')
      .mockImplementation(async () =>
        Response.json({ value: 'Fresh ' + request.mock.calls.length }),
      );
    const client = createQueryClient();
    await render(Harness, {
      client,
      data: { value: 'SSR', readSeed: { ...seed(), updatedAt: 1 } },
    });
    focusManager.setFocused(false);
    focusManager.setFocused(true);
    await expect.element(page.getByLabelText('value')).toHaveTextContent('Fresh 1');
    client.setQueryData(readKey(seed()), { value: 'old' }, { updatedAt: 1 });
    onlineManager.setOnline(false);
    onlineManager.setOnline(true);
    await expect.element(page.getByLabelText('value')).toHaveTextContent('Fresh 2');
    expect(request).toHaveBeenCalledTimes(2);
  });
  it('removes a denied private read and rechecks the route without retrying', async () => {
    const request = vi.spyOn(window, 'fetch').mockResolvedValue(new Response('', { status: 403 }));
    const client = createQueryClient();
    const readSeed = { ...seed(), resource: 'detail' as const, viewer: 'ana', params: 'slug=mesa' };
    await render(Harness, { client, data: { value: 'private', readSeed } });
    await page.getByRole('button', { name: 'Refresh' }).click();
    await expect.poll(() => vi.mocked(invalidateAll).mock.calls.length).toBe(1);
    expect(client.getQueryData(readKey(readSeed))).toBeUndefined();
    expect(request).toHaveBeenCalledTimes(1);
  });
});
