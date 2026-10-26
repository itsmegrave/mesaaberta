import { page } from 'vitest/browser';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { QueryClient } from '@tanstack/svelte-query';
import ExtensionWidgets from './ExtensionWidgets.svelte';
import Fixture from './widget-fixture.svelte';

const route = vi.hoisted(() => ({ id: '/(tables)/tables' as string | null }));
vi.mock('$app/env', () => ({ browser: true }));
vi.mock('@sentry/sveltekit', () => ({ captureException: vi.fn() }));
vi.mock('$app/state', () => ({
  page: {
    get route() {
      return route;
    },
    url: new URL('https://x.test/tables?page=2'),
  },
}));
const shared = vi.hoisted(() => ({ client: undefined as unknown }));
vi.mock('#lib/query/context.js', async (original) => {
  const actual = await original<typeof import('#lib/query/context.js')>();
  return { ...actual, queryClient: () => shared.client ?? actual.queryClient() };
});
vi.mock('#lib/extensions/panels.js', () => ({
  widgets: { poll: async () => ({ default: Fixture }) },
}));

const poll = (id: string, question: string) => ({
  ext: 'fake',
  widget: { id, kind: 'poll', data: { question } },
});
const serve = (widgets: unknown[]) => {
  const fetch = vi.fn(async () => Response.json({ widgets }));
  vi.stubGlobal('fetch', fetch);
  return fetch;
};
// The host waits 3 s after the page loads before it asks.
const afterDelay = () => new Promise((resolve) => setTimeout(resolve, 3200));

afterEach(() => {
  vi.unstubAllGlobals();
  shared.client = undefined;
  route.id = '/(tables)/tables';
});

describe('ExtensionWidgets', () => {
  it('shows the first widget it has a component for, as a card that posts to its extension', async () => {
    const fetch = serve([
      { ext: 'fake', widget: { id: 'q0', kind: 'quiz', data: {} } },
      poll('p1', 'Qual sistema?'),
    ]);
    render(ExtensionWidgets);
    await afterDelay();

    const card = page.getByRole('region', { name: 'Qual sistema?' });
    await expect.element(card).toHaveAttribute('data-mode', 'card');
    await expect.element(card).toHaveAttribute('data-action', '/fake/w/p1?/respond');
    await expect.element(card).toHaveAttribute('data-next', '/tables?page=2');
    expect(fetch).toHaveBeenCalledWith('/api/widgets?route=%2Ftables', expect.anything());
  });

  it('replaces the card with the answer, and moves on once the widget is done', async () => {
    serve([poll('p1', 'Qual sistema?'), poll('p2', 'Online ou presencial?')]);
    render(ExtensionWidgets);
    await afterDelay();

    await page.getByRole('button', { name: 'Votar' }).click();
    await expect.element(page.getByRole('region', { name: 'Valeu!' })).toBeVisible();
    await page.getByRole('button', { name: 'Agora não' }).click();
    await expect.element(page.getByRole('region', { name: 'Online ou presencial?' })).toBeVisible();
  });

  it('never asks on a page where widgets do not show', async () => {
    route.id = '/(tables)/tables/new';
    const fetch = serve([poll('p1', 'Qual sistema?')]);
    render(ExtensionWidgets);
    await afterDelay();

    expect(fetch).not.toHaveBeenCalled();
    await expect.element(page.getByRole('region')).not.toBeInTheDocument();
  });

  it('drops an answered widget from every page, so it does not come back on the way back', async () => {
    const client = new QueryClient();
    shared.client = client;
    // The home page already listed the same poll before the person came to /t.
    client.setQueryData(['widgets', '/'], { widgets: [poll('p1', 'Qual sistema?')] });
    serve([poll('p1', 'Qual sistema?')]);
    render(ExtensionWidgets);
    await afterDelay();

    await page.getByRole('button', { name: 'Agora não' }).click();
    await expect.element(page.getByRole('region')).not.toBeInTheDocument();
    expect(client.getQueryData(['widgets', '/'])).toEqual({ widgets: [] });
  });
});
