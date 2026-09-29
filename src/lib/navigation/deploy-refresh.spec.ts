import { describe, expect, it, vi } from 'vitest';
import { reloadIfUpdated } from './deploy-refresh';

const to = (href: string) =>
  ({ to: { url: new URL(href) } }) as Parameters<typeof reloadIfUpdated>[0];

describe('reloadIfUpdated', () => {
  it('lets the navigation run in the page when no new version is out', () => {
    const load = vi.fn();
    expect(reloadIfUpdated(to('https://mesa.test/tables'), false, load)).toBeUndefined();
    expect(load).not.toHaveBeenCalled();
  });

  it('loads the destination from the server once a new version is out', () => {
    const load = vi.fn();
    reloadIfUpdated(to('https://mesa.test/tables?q=ordem#top'), true, load);
    expect(load).toHaveBeenCalledWith('https://mesa.test/tables?q=ordem#top');
  });

  it('holds the client-side navigation while the browser loads the page', async () => {
    const pending = reloadIfUpdated(to('https://mesa.test/tables'), true, vi.fn());
    const settled = await Promise.race([pending, Promise.resolve('open')]);
    expect(settled).toBe('open');
  });

  it('does nothing without a destination', () => {
    const load = vi.fn();
    expect(reloadIfUpdated({ to: null }, true, load)).toBeUndefined();
    expect(load).not.toHaveBeenCalled();
  });
});
