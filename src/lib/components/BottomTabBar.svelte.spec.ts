import { render } from 'vitest-browser-svelte';
import { describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';
import BottomTabBar from './BottomTabBar.svelte';

describe('BottomTabBar.svelte', () => {
  const nav = () => page.getByRole('navigation', { name: 'Navegação móvel' });

  it('renders base tabs for standard member', async () => {
    render(BottomTabBar);

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

  it('offers the crowdfunding list with a short label and the full name for a screen reader', async () => {
    render(BottomTabBar);

    const tab = nav().getByRole('link', { name: 'Financiamentos coletivos' });
    await expect.element(tab).toHaveAttribute('href', '/crowdfunding');
    await expect.element(tab).toHaveTextContent('FCs');
  });

  it('offers the partners list to everyone', async () => {
    render(BottomTabBar);

    await expect
      .element(nav().getByRole('link', { name: 'Parceiros' }))
      .toHaveAttribute('href', '/partners');
  });

  it('leaves the Admin link to the account menu, so five tabs fit the bar', async () => {
    render(BottomTabBar);

    await expect.element(nav().getByRole('link', { name: 'Admin' })).not.toBeInTheDocument();
    expect(nav().getByRole('link').elements()).toHaveLength(5);
  });
  it('uses the new game artwork for every mobile tab', async () => {
    render(BottomTabBar);
    const expected = {
      '/tables': 'game-icons:tavern-sign',
      '/tables/new': 'game-icons:dice-twenty-faces-twenty',
      '/account/tables': 'game-icons:tabletop-players',
      '/partners': 'game-icons:trade',
    };
    for (const [href, icon] of Object.entries(expected)) {
      const svg = document.querySelector<SVGSVGElement>(`a[href="${href}"] svg`);
      expect(svg?.getAttribute('data-icon')).toBe(icon);
      expect(svg?.getAttribute('viewBox')).toBe('0 0 512 512');
      expect(svg?.querySelector('path')?.getBBox().width).toBeGreaterThan(0);
    }
  });
});
