import { render } from 'vitest-browser-svelte';
import { describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';
import BottomTabBar from './BottomTabBar.svelte';

describe('BottomTabBar.svelte', () => {
  const nav = () => page.getByRole('navigation', { name: 'Navegação móvel' });

  it('renders base tabs for standard member', async () => {
    render(BottomTabBar, { isAdmin: false });

    await expect.element(nav()).toBeVisible();
    await expect
      .element(nav().getByRole('link', { name: 'Mesas' }))
      .toHaveAttribute('href', '/tables');
    await expect
      .element(nav().getByRole('link', { name: 'Abrir mesa' }))
      .toHaveAttribute('href', '/tables/new');
    await expect
      .element(nav().getByRole('link', { name: 'Minhas mesas' }))
      .toHaveAttribute('href', '/account/tables');
    await expect.element(nav().getByRole('link', { name: 'Admin' })).not.toBeInTheDocument();
  });

  it('renders Admin tab when role is admin', async () => {
    render(BottomTabBar, { isAdmin: true });

    await expect.element(nav()).toBeVisible();
    await expect
      .element(nav().getByRole('link', { name: 'Admin' }))
      .toHaveAttribute('href', '/admin');
  });
  it('uses the new game artwork for every mobile tab', async () => {
    render(BottomTabBar, { isAdmin: true });
    const expected = {
      '/tables': 'game-icons:dice-twenty-faces-twenty',
      '/tables/new': 'game-icons:card-draw',
      '/account/tables': 'game-icons:tabletop-players',
      '/admin': 'game-icons:black-knight-helm',
    };
    for (const [href, icon] of Object.entries(expected)) {
      const svg = document.querySelector<SVGSVGElement>(`a[href="${href}"] svg`);
      expect(svg?.getAttribute('data-icon')).toBe(icon);
      expect(svg?.getAttribute('viewBox')).toBe('0 0 512 512');
      expect(svg?.querySelector('path')?.getBBox().width).toBeGreaterThan(0);
    }
  });
});
