import { render } from 'vitest-browser-svelte';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import BottomTabBar from './BottomTabBar.svelte';

const location = vi.hoisted(() => ({ pathname: '/' }));
vi.mock('$app/state', () => ({
  page: {
    get url() {
      return new URL(`http://localhost${location.pathname}`);
    },
  },
}));

// The tab that is "on" has a tinted pill behind its icon.
const lit = (href: string) =>
  document.querySelector(`a[href="${href}"] span`)?.classList.contains('bg-surface-200-800');

beforeEach(() => {
  location.pathname = '/';
});

describe('BottomTabBar.svelte, the tab that is on', () => {
  it('lights Minhas mesas on its own pages', () => {
    location.pathname = '/account/tables';
    render(BottomTabBar, { isAdmin: false });

    expect(lit('/account/tables')).toBe(true);
    expect(lit('/tables')).toBe(false);
  });

  it('lights nothing for the profile, which is not one of the tables', () => {
    location.pathname = '/account/profile';
    render(BottomTabBar, { isAdmin: false });

    expect(lit('/account/tables')).toBe(false);
    expect(lit('/tables')).toBe(false);
  });
});
