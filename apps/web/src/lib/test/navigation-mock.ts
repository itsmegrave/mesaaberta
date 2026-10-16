import { vi } from 'vitest';

/**
 * Every export of SvelteKit 3's `$app/navigation`, as no-ops, with what a spec watches on top. A
 * partial mock is not enough: the real module is not loadable in a component test (it needs an
 * initialized app), and anything in the page that imports another export would fail to link.
 */
export const navigationMock = (watched: Record<string, unknown> = {}) => ({
  afterNavigate: vi.fn(),
  beforeNavigate: vi.fn(),
  disableScrollHandling: vi.fn(),
  goto: vi.fn(),
  invalidate: vi.fn(),
  invalidateAll: vi.fn(),
  refreshAll: vi.fn(async () => {}),
  onNavigate: vi.fn(),
  preloadCode: vi.fn(),
  preloadData: vi.fn(),
  pushState: vi.fn(),
  replaceState: vi.fn(),
  snapshot: {},
  ...watched,
});
