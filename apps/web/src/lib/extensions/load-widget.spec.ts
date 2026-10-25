import * as Sentry from '@sentry/sveltekit';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { observedLoad } from '@mesaaberta/core/server/extensions/observe-load';

const env = vi.hoisted(() => ({ browser: false }));
vi.mock('$app/env', () => ({
  get browser() {
    return env.browser;
  },
}));
vi.mock('@sentry/sveltekit', () => ({ captureException: vi.fn() }));
vi.mock('@mesaaberta/core/server/extensions/observe-load', () => ({
  observedLoad: vi.fn((_type: string, _id: string, load: () => Promise<unknown>) => load()),
}));
const Poll = () => null;
vi.mock('./panels.js', () => ({
  widgets: {
    poll: async () => ({ default: Poll }),
    broken: async () => Promise.reject(new Error('chunk gone')),
  },
}));

const { loadWidget } = await import('./load-widget');

afterEach(() => {
  vi.clearAllMocks();
  env.browser = false;
});

describe('loadWidget', () => {
  it('loads through the observed loader on the server, naming the widget kind', async () => {
    expect(await loadWidget('poll')).toBe(Poll);
    expect(observedLoad).toHaveBeenCalledWith('widget', 'poll', expect.any(Function));
  });

  it('reports a component that fails to load in the browser, with its kind, and rethrows', async () => {
    env.browser = true;
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await expect(loadWidget('broken')).rejects.toThrow('chunk gone');
    expect(Sentry.captureException).toHaveBeenCalledWith(expect.any(Error), {
      tags: { resourceType: 'widget', resourceId: 'broken' },
    });
    expect(observedLoad).not.toHaveBeenCalled();
  });
});
