import { describe, expect, it, vi } from 'vitest';
import type { RequestEvent } from '@sveltejs/kit';
import { reroute } from '../../hooks';
import { handleCanonicalRoutes } from './canonical-routes';

const eventFor = (path: string, method = 'GET', body?: string) => {
  const url = new URL(path, 'https://mesaaberta.app');
  return { url, request: new Request(url, { method, ...(body ? { body } : {}) }) } as RequestEvent;
};

describe('canonical web routing', () => {
  it.each(['GET', 'HEAD'])('redirects a legacy %s before loading the resource', async (method) => {
    const resolve = vi.fn();
    const response = await handleCanonicalRoutes({
      event: eventFor('/en/tables/dragon/manage?page=2&tag=a%2Fb', method),
      resolve,
    });
    expect(response.status).toBe(308);
    expect(response.headers.get('location')).toBe('/t/dragon/manage?page=2&tag=a%2Fb');
    expect(resolve).not.toHaveBeenCalled();
  });

  it('passes a legacy named action through with the original POST body', async () => {
    const event = eventFor('/account/profile?/save', 'POST', 'name=Ana&username=ana');
    const route = await reroute({ url: event.url, fetch });
    const resolve = vi.fn(async (routed: RequestEvent) => {
      expect(route).toBe('/u/profile/edit');
      expect(routed.request.method).toBe('POST');
      expect(routed.url.search).toBe('?/save');
      expect(await routed.request.text()).toBe('name=Ana&username=ana');
      return new Response('saved');
    });
    const response = await handleCanonicalRoutes({ event, resolve });
    expect(await response.text()).toBe('saved');
    expect(resolve).toHaveBeenCalledOnce();
  });

  it.each([
    '/u/ana',
    '/u/tables',
    '/u/profile/edit',
    '/admin/tables',
    '/api/messages/inbox',
    '/healthz',
  ])('leaves the canonical or separate contract %s to its own handler', async (path) => {
    const resolve = vi.fn(async () => new Response('own handler'));
    const response = await handleCanonicalRoutes({ event: eventFor(path), resolve });
    expect(await response.text()).toBe('own handler');
    expect(resolve).toHaveBeenCalledOnce();
  });
});
